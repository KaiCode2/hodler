// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kaialdag@icloud.com>
// Date: December 8th, 2022
// Purpose: Contract containing a nonce logic

pragma solidity ^0.8.0;


/**
 * @title Nonce
 *
 * @dev Contains useful functionality for contracts that require a contract wide
 * nonce system.
 *
 * @custom:security-contact kaialdag@icloud.com
 */
abstract contract Nonce {
    uint256 private _nonce;

    function currentNonce() public view returns(uint256 nonce) {
        return _nonce;
    }

    function _incrementNonce() internal virtual returns(uint256 newNonce) {
        _nonce++;
        return _nonce;
    }

    modifier nonceIncrementing() {
        _;
        _nonce++;
    }
}