// SPDX-License-Identifier: MIT
// Author: Kai Aldag <kaialdag@icloud.com>
// Date: February 10th, 2023
// Purpose: Manage the deployment of Custodian contracts

pragma solidity ^0.8.17;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import {Custodian} from "./Custodian.sol";

/**
 * @title Custodian Factory
 * @author Kai Aldag <kaialdag@icloud.com>
 * @notice Convenience contract for deploying custodians
 */
contract CustodianFactory is Ownable2Step {
    // ────────────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────────────

    event CustodianDeployed(address newCustodian, address deployer);

    event VerifierUpdate(address newVerifier);

    // ────────────────────────────────────────────────────────────────────────────────
    // Fields
    // ────────────────────────────────────────────────────────────────────────────────

    IVerifier public verifier;

    mapping(address => address) public deployments;

    // ────────────────────────────────────────────────────────────────────────────────
    // Setup
    // ────────────────────────────────────────────────────────────────────────────────

    constructor(IVerifier _verifier) {
        verifier = _verifier;
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Deployment Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function safeDeploy(
        bytes32 _recoveryCommitment,
        bytes32 _unlockCommitment,
        address _recoveryTrustee
    ) external payable returns(address newVaultAddress) {
        require(
            deployments[msg.sender] == address(0x0), 
            "CustodianFactory: User already has custodian deployed"
        );
        return deploy(_recoveryCommitment, _unlockCommitment, _recoveryTrustee);
    }

    function deploy(
        bytes32 _recoveryCommitment,
        bytes32 _unlockCommitment,
        address _recoveryTrustee
    ) public payable returns(address newVaultAddress) {
        Custodian newCustodian = new Custodian
            { value: msg.value }(
            _recoveryCommitment,
            _unlockCommitment,
            _recoveryTrustee,
            verifier
        );
        deployments[msg.sender] = address(newCustodian);

        emit CustodianDeployed(address(newCustodian), msg.sender);

        return address(newCustodian);
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Admin Functionality
    // ────────────────────────────────────────────────────────────────────────────────

    function updateVerifier(IVerifier _verifier) external onlyOwner {
        require(
            address(_verifier) != address(0x0),
            "CustodianFactory: New verifier cannot be 0 address"
        );
        verifier = _verifier;
    }
}
