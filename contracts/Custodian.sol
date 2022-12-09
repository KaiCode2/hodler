// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kai.aldag@everyrealm.com>
// Date: December 6th, 2022
// Purpose: Custodial contract for tokens, unlockable with zk proofs

pragma solidity ^0.8.17;

import {OwnableDelayed} from "./utilities/OwnableDelayed.sol";
import {Nonce} from "./utilities/Nonce.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC777Recipient} from "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IVerifier} from "./IVerifier.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Timers} from "@openzeppelin/contracts/utils/Timers.sol";
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
 * @custom:security-contact kai.aldag@everyrealm.com
 */
contract Custodian is OwnableDelayed, Nonce, ERC721Holder, ERC1155Holder, IERC777Recipient, ReentrancyGuard {
    using Address for address;
    using EnumerableMap for EnumerableMap.Bytes32ToUintMap;
    using SafeCast for uint256;
    using Timers for Timers.Timestamp;

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
    address public recoveryTrustee;

    /** 
     * @notice mapping to set token limitations
     * 
     * @dev Key-value system is as follows:
     * 1) For fungible tokens, bytes32 is cast of address
     * 2) For multi tokens (1155s), bytes32 is keccak256 of address and token ID
     * 3) For non-fungible tokens, bytes32 is keccak256 of address and token ID
     * 
     * 1&2) For fungible and multi tokens, value will be max allowance.
     * 3)   For non-fungible tokens, value will be 1 to indicate a limit exists.
    */
    EnumerableMap.Bytes32ToUintMap private spendLimits;

    Timers.Timestamp public unlockTimer;

    uint96 internal constant unlockPeriod = (1 days / 2);
    uint96 internal constant recoveryBlockPeriod = 5 days;

    // ────────────────────────────────────────────────────────────────────────────────
    // Setup Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    constructor(
        bytes32 _recoveryCommitment,
        bytes32 _unlockCommitment,
        address _recoveryTrustee,
        IVerifier _verifier
    ) payable OwnableDelayed() {
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
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Locking Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function unlockAccountUntil(
        uint256[8] calldata proof,
        uint256 unlockNullifier,
        uint256 until
    ) public onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest nonceIncrementing {
        require(
            until - block.timestamp < 7 days,
            "Custodian: Cannot unlock for more than 1 week"
        );

        emit Unlocked(block.timestamp, currentNonce());

        unlockTimer.setDeadline(until.toUint64());
    }

    function unlockAccount(
        uint256[8] calldata proof,
        uint256 unlockNullifier
    ) external {
        unlockAccountUntil(proof, unlockNullifier, block.timestamp + unlockPeriod);
    }

    function lock() public onlyOwner {
        unlockTimer.reset();
    }

    function isUnlocked() external view returns(bool unlocked, uint64 until) {
        if (unlockTimer.isPending()) {
            return (true, unlockTimer.getDeadline());
        } else {
            return (false, 0);
        }
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Recover Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function initiateAccountRecovery(
        uint256[8] memory proof,
        uint256 nullifier,
        address recoveryRecipient
    ) external requireNoRecoverRequest nonceIncrementing {
        // 1. Verify the recovery nullifier is valid given the recoveryCommitment and the recipient. Recipient cannot be zero address.
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
                    currentNonce(),
                    uint256(uint160(recoveryRecipient))
                ]
            )
        ) {
            revert InvalidProof();
        }

        // 2. If a recovery trustee is set, require a delay where trustee may intervene to block a reset
        // If no trustee, account is immediately recoverable
        uint256 recoverableAfter;
        if (recoveryTrustee == address(0x0)) {
            recoverableAfter = block.timestamp;
        } else {
            recoverableAfter = block.timestamp + recoveryBlockPeriod;
        }
        
        // 3. Nominate owner and lock custodian
        _nominateOwner(recoveryRecipient, recoverableAfter.toUint64());
        unlockTimer.reset();
        unlockCommitment = bytes32(0x0);

        emit RecoveryInitiated(recoverableAfter);
    }

    function recoverAccount(
        bytes32 newRecoveryCommitment,
        bytes32 newUnlockCommitment
    ) external nonceIncrementing {
        // 1. Require recovery period to have elapsed, not be zero and msg.sender to be new owner
        acceptOwnership();
        
        require(
            recoveryCommitment != newRecoveryCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            newRecoveryCommitment != bytes32(0x0),
            "Custodian: New recovery commitment cannot be empty"
        );
        require(
            unlockCommitment != newUnlockCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            newUnlockCommitment != bytes32(0x0),
            "Custodian: New unlock commitment cannot be empty"
        );

        recoveryCommitment = newRecoveryCommitment;
        unlockCommitment = newUnlockCommitment;

        emit RecoveryOccured(_msgSender());
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
    ) external nonceIncrementing {
        // 1. Ensure a recovery is active, a valid proof was given, new commitment to not be current values and that the signature is from the account recovery trustee
        require(ownerTransferEligibleTime() != 0, "Custodian: Recovery not initiated");
        require(
            recoveryCommitment != newRecoveryCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            newRecoveryCommitment != bytes32(0x0),
            "Custodian: New recovery commitment cannot be empty"
        );
        require(
            unlockCommitment != newUnlockCommitment,
            "Custodian: New recovery commitment cannot be current value"
        );
        require(
            newUnlockCommitment != bytes32(0x0),
            "Custodian: New unlock commitment cannot be empty"
        );
        if (
            !verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [
                    nullifier,
                    uint256(recoveryCommitment),
                    currentNonce(),
                    uint256(uint160(recoveryRecipient))
                ]
            )
        ) {
            revert InvalidProof();
        }
        // TODO: Migrate to ERC712 sig for wallet compatibility
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
        _transferOwnership(recoveryRecipient);
        unlockCommitment = newUnlockCommitment;
        recoveryCommitment = newRecoveryCommitment;
    }


    // ────────────────────────────────────────────────────────────────────────────────
    // Limit Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    /**
     * @notice sets a minimum balance that must be held by the custodian contract. Used
     * to add further safeguards on important tokens by requiring explicit user
     * authorization for using funds beyond threshold
     * 
     * @param token address of the ERC-20 contract for which the limit will be set. Must
     * support ERC-20's interface, verified using ERC-165. 
     * NOTE: if token is custodian contract's address, a limit is set on contract's Ether balance.
     * 
     * @param unlockSpendLimit Maximum spend limit of the contract while it is unlocked.
     *                         Set to zero to remove limit.
     * 
     */
    function setTokenSpendLimit(
        address token, 
        uint256 unlockSpendLimit, 
        uint256[8] calldata proof, 
        uint256 unlockNullifier
    ) public onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest nonceIncrementing {
        // 1. Check if user is setting Eth balance for contract or an ERC-20
        if (token == address(this)) {
            // 2. Ensure custodian has more balance than minimum, if so, set new limit
            require(
                address(this).balance >= unlockSpendLimit,
                "Custodian: Spend limit must be less than or equal to Custodian's current balance"
            );
        } else {
            // 2. Ensure token conforms to ERC-20, custodian has enough balance, then set limit
            require(
                IERC165(token).supportsInterface(type(IERC20).interfaceId),
                "Custodian: Address does not support ERC20"
            );
            require(
                IERC20(token).balanceOf(address(this)) >= unlockSpendLimit,
                "Custodian: Spend limit must be less than or equal to Custodian's current balance"
            );
        }

        // 3. Set limit
        setLimit(getTokenLimitKey(token), unlockSpendLimit);
    }

    /**
     * @notice sets a minimum balance that must be held by the custodian contract for an 
     *  ERC-1155 token. Used to add further safeguards on important tokens.
     * 
     * @param token address of the ERC-1155 contract for which the limit will be set. Must
     * support ERC-1155's interface, verified using ERC-165. 
     * 
     * @param tokenId Multi token ID to apply limit to.
     * 
     * @param unlockSpendLimit Maximum spend limit of the contract while it is unlocked.
     *                         Set to zero to remove limit.
     * 
     */
    function setMultiTokenLimit(
        address token, 
        uint256 tokenId, 
        uint256 unlockSpendLimit, 
        uint256[8] calldata proof, 
        uint256 unlockNullifier
    ) public onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest nonceIncrementing {
        // 1. Ensure token conforms to ERC-1155, custodian has enough balance, then set limit
        require(
            IERC165(token).supportsInterface(type(IERC1155).interfaceId),
            "Custodian: Address does not support IERC1155"
        );
        require(
            IERC1155(token).balanceOf(address(this), tokenId) >= unlockSpendLimit,
            "Custodian: Spend limit must be less than or equal to Custodian's current balance"
        );
        setLimit(getMultiTokenLimitKey(token, tokenId), unlockSpendLimit);
    }

    /**
     * @notice Restricts transfers for an NFT while account is unlocked. This requires an
     * explicit and unique unlock to transfer the NFT. Use to add highest amount of security
     * to valuable NFTs.
     * 
     * @param token address of the ERC-721 contract for which the limit will be set. Must
     * support ERC-721's interface, verified using ERC-165. 
     * 
     * @param tokenId Multi token ID to apply limit to.
     * 
     * @param hasLimit Set to true if applying a limit, false is removing limit.
     * 
     */
    function setNFTLimit(
        address token, 
        uint256 tokenId, 
        bool hasLimit,
        uint256[8] calldata proof, 
        uint256 unlockNullifier
    ) public onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest nonceIncrementing {
        // 1. Ensure token conforms to ERC-721, custodian owns the NFT, then set limit
        require(
            IERC165(token).supportsInterface(type(IERC721).interfaceId),
            "Custodian: Address does not support IERC721"
        );
        require(
            IERC721(token).ownerOf(tokenId) == address(this),
            "Custodian: Custodian does not own given token"
        );
        setLimit(getNFTLimitKey(token, tokenId), hasLimit ? 1 : 0);
    }


    // ────────────────────────────────────────────────────────────────────────────────
    // Interaction Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function sendEth(
        uint256 amount,
        address payable to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest nonReentrant returns(bool success, bytes memory data) {
        require(
            address(this).balance >= amount,
            "Custodian: Insufficient funds"
        );
        (, uint256 limit) = getTokenLimit(address(this));
        require(
            address(this).balance - amount >= limit,
            "Custodian: Amount would exceed balance or spend limit"
        );
        (success, data) = to.call{value: amount}("");
        require(success, "Custodian: Failed to send Ether");

        verifySpendLimit(address(this));

        return (success, data);
    }

    function transferTokens(
        address tokenContract,
        uint256 amount,
        address to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest nonReentrant returns(bool success) {
        require(
            IERC165(tokenContract).supportsInterface(type(IERC20).interfaceId),
            "Custodian: Address does not support ERC20"
        );
        (, uint256 limit) = getTokenLimit(tokenContract);
        uint256 balance = IERC20(tokenContract).balanceOf(address(this));
        require(
            balance - limit >= amount, 
            "Custodian: Amount would exceed balance or spend limit"
        );

        success = IERC20(tokenContract).transfer(to, amount);
        require(success, "Custodian: Transfer failed");

        verifySpendLimit(tokenContract);

        return success;
    }

    function transferMultiToken(
        address tokenContract,
        uint256 tokenId,
        uint256 amount,
        address to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest nonReentrant {
        require(
            IERC165(tokenContract).supportsInterface(type(IERC1155).interfaceId),
            "Custodian: Address does not support IERC721"
        );
        (, uint256 limit) = getMultiTokenLimit(tokenContract, tokenId);
        uint256 balance = IERC1155(tokenContract).balanceOf(address(this), tokenId);
        require(
            balance - limit >= amount, 
            "Custodian: Amount would exceed balance or spend limit"
        );
        IERC1155(tokenContract).safeTransferFrom(address(this), to, tokenId, amount, "");
    }

    function transferNFT(
        address tokenContract,
        uint256 tokenId,
        address to
    ) external onlyOwner requireUnlocked requireNoRecoverRequest nonReentrant {
        require(
            IERC165(tokenContract).supportsInterface(type(IERC721).interfaceId),
            "Custodian: Address does not support IERC721"
        );
        (bool hasLimit,) = getNFTLimit(tokenContract, tokenId);
        require(!hasLimit, "Custodian: Unable to transfer lock-protected NFT");
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

    function transferNFT(
        address tokenContract,
        uint256 tokenId,
        address to,
        uint256[8] calldata proof, 
        uint256 unlockNullifier
    ) external onlyOwner validUnlock(proof, unlockNullifier) requireNoRecoverRequest nonceIncrementing nonReentrant {
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

        // If NFT has a limit, remove once transferred
        (bool hasLimit,) = getNFTLimit(tokenContract, tokenId);
        if (hasLimit) {
            setLimit(getNFTLimitKey(tokenContract, tokenId), 0);
        }
    }

    function proxyCall(
        address to,
        bytes4 selector,
        bytes calldata payload
    ) external onlyOwner requireUnlocked requireNoRecoverRequest nonReentrant returns (bool, bytes memory) {
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
                    currentNonce(),
                    uint256(uint160(owner()))
                ]
            );
    }

    //  ───────────────────────────  State Enforcement  ───────────────────────────  \\

    /**
     * @dev called after any external calls are made to enfore spend limits
     */
    function verifyAllSpendLimits() private view {
        // TODO: This is gonna be difficult to implement given the new bytes32 mapping...
        // Leaving this for now
        uint256 length = spendLimits.length();
        for (uint256 i = 0; i < length; i++) {
            // (address token, ) = spendLimits.at(i);
            // verifySpendLimit(token);
        }
    }

    /**
     * @dev Verifies custodian has more than limit for specific token
     */
    function verifySpendLimit(address token) private view {
        // Try getting balance of token then check less than limit.
        // If revert, check if address is contract, if so, check eth balance within limit
        (bool hasLimit, uint256 limit) = getTokenLimit(token);
        if (hasLimit) {
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
    }

    //  ──────────────────────────  Function Modifiers  ───────────────────────────  \\

    modifier requireNoRecoverRequest() {
        require(pendingOwner() == address(0x0), "Custodian: Recovery initiated");
        _;
    }

    modifier requireUnlocked() {
        if (unlockTimer.isPending()) {
            _;
        } else {
            revert Locked();
        }
    }

    /**
     * @dev Checks if an unlock proof is valid and increments nonce. 
     * Throws InvalidProof if verification fails
     */
    modifier validUnlock(uint256[8] calldata proof, uint256 nullifier) {
        if (verifyUnlockProof(proof, nullifier)) {
            _;
        } else {
            revert InvalidProof();
        }
    }

    //  ───────────────────────────  Utility Functions  ───────────────────────────  \\

    /**
     * @dev used to get ERC20 spend limit key
     */
    function getTokenLimitKey(address token) private pure returns(bytes32 key) {
        return addressToBytes32(token);
    }

    /**
     * @dev used to set ERC1155 spend limit key
     */
    function getMultiTokenLimitKey(address token, uint256 tokenId) private pure returns(bytes32 key) {
        return keccak256(abi.encodePacked(token, tokenId));
    }

    /**
     * @dev used to get ERC721 spend limit key
     */
    function getNFTLimitKey(address token, uint256 tokenId) private pure returns(bytes32 key) {
        return keccak256(abi.encodePacked(token, tokenId));
    }

    /**
     * @dev used to set ERC20 spend limits. Set limit to 0 to remove limit
     */
    function getTokenLimit(address token) public view returns(bool exists, uint256 limit) {
        return spendLimits.tryGet(getTokenLimitKey(token));
    }

    /**
     * @dev used to set ERC1155 spend limits. Set limit to 0 to remove limit
     */
    function getMultiTokenLimit(address token, uint256 tokenId) public view returns(bool exists, uint256 limit) {
        return spendLimits.tryGet(getMultiTokenLimitKey(token, tokenId));
    }

    /**
     * @dev used to set ERC721 spend limits. Set limit to 0 to remove limit
     */
    function getNFTLimit(address token, uint256 tokenId) public view returns(bool exists, uint256 limit) {
        return spendLimits.tryGet(getNFTLimitKey(token, tokenId));
    }

    /**
     * @dev Convenience function for setting and removing spend limits
     */
    function setLimit(bytes32 key, uint256 limit) private {
        if (limit != 0) {
            spendLimits.set(key, limit);
        } else {
            spendLimits.remove(key);
        }
    }

    function addressToBytes32(address addr) private pure returns(bytes32) {
        return bytes32(uint256(uint160(addr)) << 96);
    }

    
    //  ───────────────────────────  Ownable Override  ────────────────────────────  \\

    function renounceOwnership() public view override onlyOwner {
        revert("Custodian: Renouncing ownership not permitted");
    }
}
