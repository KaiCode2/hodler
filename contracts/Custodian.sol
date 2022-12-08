// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kai.aldag@everyrealm.com>
// Date: December 6th, 2022
// Purpose: Custodial contract for tokens, unlockable with zk proofs

pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC777Recipient} from "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IVerifier} from "./IVerifier.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

error Locked();
error Overspent(address token, uint256 limit, uint256 postExecutionBalance);
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
 * * @custom:security-contact kai.aldag@everyrealm.com
 */
contract Custodian is Ownable, ERC721Holder, ERC1155Holder, IERC777Recipient {
    using Address for address;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

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

    /// @notice used to set minimum balances for ERC-20 tokens
    EnumerableMap.AddressToUintMap private spendLimits;

    // TODO: add ERC-721 mapping for tokens that require new unlocks to transfer

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
        uint256[8] calldata proof,
        uint256 unlockNullifier,
        uint256 until
    ) public onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest {
        require(
            until - block.timestamp < 7 days,
            "Custodian: Cannot unlock for more than 1 week"
        );

        emit Unlocked(block.timestamp, nonce);

        unlockedUntil = until;
        nonce++;
    }

    function unlockAccount(
        uint256[8] calldata proof,
        uint256 unlockNullifier
    ) external {
        unlockAccountUntil(proof, unlockNullifier, block.timestamp + unlockPeriod);
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
        uint256[8] calldata proof,
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
    // Limit Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    /**
     * @notice sets a minimum balance that must be held by the custodian contract. Used
     * to prevent the custodian from being drained while unlocked - or to require user
     * explicitly extend the spend limit for more deliberate spending.
     * 
     * @param forToken address of ERC-20 to set limit for. Must support ERC-20's interface
     * verified using ERC-165. NOTE: if address is contract address, a limit is set on
     * contract's Ether balance
     * 
     */
    function setSpendLimit(
        address forToken, 
        uint256 unlockSpendLimit, 
        uint256[8] calldata proof, 
        uint256 unlockNullifier
    ) public onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest {
        // 1. Check if user is setting Eth balance for contract or an ERC-20
        if (forToken == address(this)) {
            // 2. Ensure custodian has more balance than minimum, if so, set new limit
            require(
                address(this).balance >= unlockSpendLimit,
                "Custodian: Spend limit must be less than or equal to Custodian's current balance"
            );
        } else {
            // 2. Ensure forToken conforms to ERC-20, custodian has enough balance, then set limit
            require(
                IERC165(forToken).supportsInterface(type(IERC20).interfaceId),
                "Custodian: Address does not support ERC20"
            );
            require(
                IERC20(forToken).balanceOf(address(this)) >= unlockSpendLimit,
                "Custodian: Address does not support ERC20"
            );
        }

        // 3. If limit is not zero, set value. If zero, remove limit
        if (unlockSpendLimit != 0) {
            spendLimits.set(forToken, unlockSpendLimit);
        } else {
            spendLimits.remove(forToken);
        }

        nonce++;
    }

    function getSpendLimit(address token) external view returns(bool exists, uint256 limit) {
        return spendLimits.tryGet(token);
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Interaction Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    // TODO: Add ERC1155 support

    function sendEth(
        uint256 amount,
        address payable to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest returns(bool success, bytes memory data) {
        require(
            address(this).balance >= amount,
            "Custodian: Insufficient funds"
        );
        (bool hasLimit, uint256 limit) = spendLimits.tryGet(address(this));
        if (hasLimit) {
            require(
                address(this).balance - amount >= limit,
                "Custodian: Amount would exceed spend limit"
            );
        }
        (success, data) = to.call{value: amount}("");
        require(success, "Custodian: Failed to send Ether");

        verifySpendLimit(address(this));

        return (success, data);
    }

    function transferTokens(
        address tokenContract,
        uint256 amount,
        address to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest returns(bool success) {
        require(
            IERC165(tokenContract).supportsInterface(type(IERC20).interfaceId),
            "Custodian: Address does not support ERC20"
        );

        success = IERC20(tokenContract).transfer(to, amount);
        require(success, "Custodian: Transfer failed");

        verifySpendLimit(tokenContract);

        return success;
    }

    function transferNFT(
        address tokenContract,
        uint256 tokenId,
        address to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest {
        require(
            IERC165(tokenContract).supportsInterface(type(IERC721).interfaceId),
            "Custodian: Address does not support IERC721"
        );
        address owner = IERC721(tokenContract).ownerOf(tokenId);
        require(
            owner != address(0x0), 
            "Custodian: No owner for token"
        );
        require(
            owner == address(this) || IERC721(tokenContract).isApprovedForAll(owner, address(this)) || IERC721(tokenContract).getApproved(tokenId) == address(this),
            "Custodian: Custodian is not authorized for given token"
        );
        IERC721(tokenContract).safeTransferFrom(address(this), to, tokenId);
    }

    function proxyCall(
        address to,
        bytes4 selector,
        bytes calldata payload
    ) external onlyOwner requireUnlocked requireNoRecoverRequest returns (bool, bytes memory) {
        (bool success, bytes memory retData) = to.delegatecall(
            abi.encodePacked(selector, payload)
        );
        require(success, "Custodian: Call failed");

        verifyAllSpendLimits();

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

    //  ────────────────────────────  Proof Verifiers  ────────────────────────────  \\

    function verifyUnlockProof(uint256[8] calldata proof, uint256 unlockNullifier) private view returns(bool) {
        return verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [
                    unlockNullifier,
                    uint256(unlockCommitment),
                    nonce,
                    uint256(uint160(owner()))
                ]
            );
    }

    //  ───────────────────────────  State Enforcement  ───────────────────────────  \\

    /**
     * @dev called after any external calls are made to enfore spend limits
     */
    function verifyAllSpendLimits() private view {
        uint256 length = spendLimits.length();
        for (uint256 i = 0; i < length; i++) {
            (address token, ) = spendLimits.at(i);
            verifySpendLimit(token);
        }
    }

    /**
     * @dev Verifies custodian has more than limit for specific token
     */
    function verifySpendLimit(address token) private view {
        // Try getting balance of token then check less than limit.
        // If revert, check if address is contract, if so, check eth balance within limit
        uint256 limit = spendLimits.get(token);
        try IERC20(token).balanceOf(address(this)) returns(uint256 balance) {
            if (balance < limit) {
                revert Overspent(token, limit, balance);
            }
        } catch {
            if (token == address(this) && address(this).balance < limit) {
                revert Overspent(token, limit, address(this).balance);
            }
        }
    }

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

    modifier validUnlock(uint256[8] calldata proof, uint256 nullifier) {
        if (verifyUnlockProof(proof, nullifier)) {
            _;
        } else {
            revert InvalidProof();
        }
    }

    // TODO: override ownable
}
