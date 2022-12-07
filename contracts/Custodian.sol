// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kaialdag@icloud.com>
// Date: December 6th, 2022
// Purpose: Custodial contract for tokens, unlockable with zk proofs

pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC777Recipient} from "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IVerifier} from "./IVerifier.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

error Locked();
error Unauthorized();
error InvalidProof();

/**
 * @title Custodian
 *
 * @notice The Custodian smart contract holds tokens on behalf of a user an unlocks access to their holding
 * by providing proof of a password.
 *
 * Additionally, it permits users to recover their holdings in the event of a lost or compromised key.
 *
 * * @custom:security-contact kaialdag@icloud.com
 */
contract Custodian is Ownable, ERC721Holder, ERC1155Holder, IERC777Recipient {
    using Address for address;

    // ────────────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────────────

    /// @notice Emitted whenever the contract is unlocked by the owner
    event Unlocked(uint256 indexed at, uint256 indexed nonce);

    /// @notice Emitted whenever the contract is unlocked by the owner
    event RecoveryInitiated(uint256 indexed timeLockedUntil);

    /// @notice Emitted whenever an account recovery was successful
    event RecoveryOccured(address indexed newOwner);

    // ────────────────────────────────────────────────────────────────────────────────
    // Fields
    // ────────────────────────────────────────────────────────────────────────────────

    IVerifier public verifier;

    bytes32 private recoveryCommitment;
    bytes32 private unlockCommitment;
    uint256 public nonce;
    address public recoveryTrustee;
    address public recoveryAddress;

    uint256 public unlockedUntil;
    uint256 public recoverableAfter;

    uint96 internal constant unlockPeriod = (1 days / 2);
    uint96 internal constant recoveryBlockPeriod = 3 days;

    // ────────────────────────────────────────────────────────────────────────────────
    // Setup Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    constructor(
        bytes32 _recoveryCommitment,
        bytes32 _unlockCommitment,
        address _recoveryTrustee,
        IVerifier _verifier
    ) payable Ownable() {
        require(
            _recoveryCommitment != _unlockCommitment,
            "Custodian: Recovery and unlock cannot be the same"
        );
        require(
            address(_verifier).isContract(),
            "Custodian: Verifier must be a contract"
        );
        require(
            _recoveryTrustee != msg.sender,
            "Custodian: Recovery trustee cannot be owner"
        );
        recoveryCommitment = _recoveryCommitment;
        unlockCommitment = _unlockCommitment;
        recoveryTrustee = _recoveryTrustee;
        verifier = _verifier;
        nonce = 0;
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Locking Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function unlockAccountUntil(
        uint256[8] memory proof,
        uint256 nullifier,
        uint256 until
    ) public onlyOwner validUnlock(proof, nullifier) requireNoRecoverRequest {
        require(
            until - block.timestamp < 7 days,
            "Custodian: Cannot unlock for more than 1 week"
        );

        emit Unlocked(block.timestamp, nonce);

        unlockedUntil = until;
        nonce++;
    }

    function unlockAccount(
        uint256[8] memory proof,
        uint256 nullifier
    ) external {
        unlockAccountUntil(proof, nullifier, block.timestamp + unlockPeriod);
    }

    function lock() public onlyOwner {
        unlockedUntil = 0;
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Recover Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function initiateAccountRecovery(
        uint256[8] memory proof,
        uint256 nullifier,
        address recoveryRecipient
    ) external requireNoRecoverRequest {
        // 1. Verify the recovery nullifier is valid given the recoveryCommitment and the recipient. Recipient cannot be zero address.
        // NOTE: nonce omitted
        require(
            recoveryRecipient != address(0x0),
            "Custodian: Recovery recipient cannot be zero address"
        );
        require(
            recoveryRecipient != owner(),
            "Custodian: Recovery recipient cannot be current owner"
        );
        require(
            recoveryRecipient != recoveryTrustee,
            "Custodian: Recovery recipient cannot be recovery trustee"
        );
        if (
            !verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [
                    nullifier,
                    uint256(recoveryCommitment),
                    0,
                    uint256(uint160(recoveryRecipient))
                ]
            )
        ) {
            revert InvalidProof();
        }

        // 2. If a recovery trustee is set, require a 3 day delay where trustee may intervene to block a reset
        // If no trustee, account is immediately recoverable
        if (recoveryTrustee == address(0x0)) {
            recoverableAfter = block.timestamp;
        } else {
            recoverableAfter = block.timestamp + 5 days;
        }

        // 3. Lock account and set recoveryAddress
        unlockedUntil = 0;
        recoveryAddress = recoveryRecipient;

        emit RecoveryInitiated(recoverableAfter);
    }

    function recoverAccount(
        bytes32 newRecoveryCommitment,
        bytes32 newUnlockCommitment
    ) external {
        // 1. Require recovery period to have elapsed, not be zero and msg.sender to be new owner
        require(recoverableAfter != 0, "Custodian: Recovery not initiated");
        require(
            recoverableAfter <= block.timestamp,
            "Custodian: Recovery not possible at current time"
        );
        require(
            recoveryCommitment != newRecoveryCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            unlockCommitment != newUnlockCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            _msgSender() == recoveryAddress,
            "Custodian: Only new owner may recover the account"
        );

        recoverableAfter = 0;
        transferOwnership(recoveryAddress);

        emit RecoveryOccured(owner());
    }

    /**
     * @notice Used if a recoveryTrustee is set and the recovery password becomes compromised. Holder of the
     * recovery password must create a proof to assign a new owner - as with the initiateAccountRecovery.
     * Secondly, the user must get the recoveryTrustee address to sign the keccak256 of the encoded arguments.
     *
     * In effect, this allows immediate account recovery if the password holder and recoveryTrustee both
     * agree on the same new owner.
     */
    function blockRecovery(
        uint256[8] memory proof,
        uint256 nullifier,
        address recoveryRecipient,
        bytes32 newRecoveryCommitment,
        bytes32 newUnlockCommitment,
        bytes calldata signature
    ) external {
        // 1. Ensure a recovery is active, a valid proof was given, new commitment to not be current values and that the signature is from the account recovery trustee
        require(recoverableAfter != 0, "Custodian: Recovery not initiated");
        require(
            recoveryCommitment != newRecoveryCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            unlockCommitment != newUnlockCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        if (
            !verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [
                    nullifier,
                    uint256(recoveryCommitment),
                    0,
                    uint256(uint160(recoveryRecipient))
                ]
            )
        ) {
            revert InvalidProof();
        }
        bytes32 digest = keccak256(
            abi.encodePacked(proof, nullifier, recoveryRecipient)
        );
        require(
            SignatureChecker.isValidSignatureNow(
                recoveryTrustee,
                digest,
                signature
            ),
            "Custodian: Signature does not match recoveryTrustee"
        );

        // 2. Permit recovery
        recoverableAfter = 0;
        recoveryAddress = address(0x0);
        unlockCommitment = newUnlockCommitment;
        recoveryCommitment = newRecoveryCommitment;
        _transferOwnership(recoveryRecipient);
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Interaction Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function transfer(
        address tokenContract,
        uint256 tokenId
    ) external onlyOwner requireUnlocked requireNoRecoverRequest {}

    function proxyCall(
        address to,
        bytes4 selector,
        bytes calldata payload
    ) external onlyOwner requireUnlocked requireNoRecoverRequest returns (bool, bytes memory) {
        (bool success, bytes memory retData) = address(this).delegatecall(
            abi.encodePacked(selector, payload)
        );
        require(success, "Call failed");

        return (success, retData);
    }

    /// @dev required so contract can receive ETH
    receive() external payable {}

    // TODO: implement
    fallback() external payable {}

    /// @dev required implementation for IERC777Recipient
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {}

    // ────────────────────────────────────────────────────────────────────────────────
    // Internal Methods
    // ────────────────────────────────────────────────────────────────────────────────

    //  ──────────────────────────  Function Modifiers  ───────────────────────────  \\

    modifier requireNoRecoverRequest() {
        require(recoverableAfter == 0, "Custodian: Recovery initiated");
        _;
    }

    modifier requireUnlocked() {
        if (unlockedUntil > block.timestamp) {
            _;
        } else {
            revert Locked();
        }
    }

    modifier validUnlock(uint256[8] memory proof, uint256 nullifier) {
        if (
            verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [
                    nullifier,
                    uint256(unlockCommitment),
                    nonce,
                    uint256(uint160(msg.sender))
                ]
            )
        ) {
            _;
        } else {
            revert InvalidProof();
        }
    }

    // TODO: override ownable
}
