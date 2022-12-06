// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kaialdag@icloud.com>
// Date: December 6th, 2022
// Purpose: Custodial contract for tokens, unlockable with zk proofs

pragma solidity ^0.8.17;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


contract Custodian is Ownable {
    bytes32 private recoveryCommitment;
    bytes32 private unlockCommitment;
    uint256 public nonce;

    event Unlocked(uint256 at);

    constructor(bytes32 _recoveryCommitment, bytes32 _unlockCommitment) payable 
        Ownable() 
    {
        recoveryCommitment = _recoveryCommitment;
        unlockCommitment = _unlockCommitment;
        nonce = 0;
    }

    function unlockAccount() public {
        
    }

    // TODO: override ownable
}
