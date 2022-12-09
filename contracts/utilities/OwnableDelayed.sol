// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (access/Ownable2Step.sol)

pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Extends Ownable2Step with a time delay which can be cancelled internally
 * Doesn't implement Ownable2Step due to the lack of virtual on acceptOwnership.
 */
abstract contract OwnableDelayed is Ownable {
    uint256 private _eligibleTime;
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner, uint256 indexed eligibleTime);

    /**
     * @dev Returns the address of the pending owner.
     */
    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    function isTransferEligible() public view virtual returns (bool) {
        return _eligibleTime != 0 && block.timestamp >= _eligibleTime;
    }

    function ownerTransferEligibleTime() public view virtual returns (uint256) {
        return _eligibleTime;
    }

    function _nominateOwner(address newOwner, uint256 eligibleTime) internal virtual {
        require(pendingOwner() == address(0x0), "OwnableDelayed: Transfer already initiated");
        _eligibleTime = eligibleTime;
        _pendingOwner = newOwner;

        emit OwnershipTransferStarted(owner(), newOwner, eligibleTime);
    }

    function _cancelNomination() internal virtual {
        require(_pendingOwner != address(0x0), "OwnableDelayed: Transfer already initiated");
        _transferOwnership(owner());
    }

    function _setEligibleTime(uint256 eligibleTime) internal {
        require(_pendingOwner != address(0x0), "OwnableDelayed: No transfer initiated");
        _eligibleTime = eligibleTime;
    }

    /**
     * @dev Starts the ownership transfer of the contract to a new account. Replaces the pending transfer if there is one.
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual override onlyOwner {
        _pendingOwner = newOwner;
        _eligibleTime = 0;

        emit OwnershipTransferStarted(owner(), newOwner, 0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`) and deletes any pending owner.
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual override {
        delete _eligibleTime;
        delete _pendingOwner;
        super._transferOwnership(newOwner);
    }

    /**
     * @dev The new owner accepts the ownership transfer.
     */
    function acceptOwnership() public virtual {
        address sender = _msgSender();
        require(pendingOwner() == sender, "Ownable2Step: caller is not the new owner");
        require(isTransferEligible(), "OwnableDelayed: Transfer not eligible at current time");
        _transferOwnership(sender);
    }
}
