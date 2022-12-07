// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kaialdag@icloud.com>
// Date: December 6th, 2022
// Purpose: Custodial contract for tokens, unlockable with zk proofs

pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IVerifier} from "./IVerifier.sol";

contract Custodian is Ownable {
    bytes32 private recoveryCommitment;
    bytes32 private unlockCommitment;
    uint256 public nonce;

    IVerifier public verifier;

    event Unlocked(uint256 at);

    constructor(bytes32 _recoveryCommitment, bytes32 _unlockCommitment, IVerifier _verifier) payable 
        Ownable() 
    {
        recoveryCommitment = _recoveryCommitment;
        unlockCommitment = _unlockCommitment;
        verifier = _verifier;
        nonce = 0;
    }

    function unlockAccount(uint256[8] memory proof, uint256 nullifier) public view returns (bool) {
        return verifier.verifyProof(
                [proof[0], proof[1]], [[proof[2], proof[3]], [proof[4], proof[5]]], [proof[6], proof[7]], 
                [nullifier, uint256(unlockCommitment), nonce, uint256(uint160(msg.sender))]
            );
    }

    // TODO: override ownable
}
