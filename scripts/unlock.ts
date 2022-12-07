import hre, { ethers, config } from "hardhat";
// @ts-ignore
import { poseidon } from "circomlibjs";
// @ts-ignore
import { groth16 } from 'snarkjs';
import fs from "fs/promises";

export async function createUnlockCalldata() {
    const custodianDeployment = await hre.deployments.get("Custodian");
    let contract = await ethers.getContractAt("Custodian", custodianDeployment.address);
    const unlockPassword = 1;
    const signers = await ethers.getSigners();
    const hash  = BigInt(ethers.utils.hexZeroPad(poseidon([unlockPassword]), 32));
    const nonce = BigInt((await contract.nonce()).toNumber());
    const circuitInputs = {
        hash,
        nonce,
        address: BigInt(signers[0].address),
        preimage: BigInt(unlockPassword),
    };

    const { proof, publicSignals } = await groth16.fullProve(circuitInputs, "./circuits/unlock.wasm", "./circuits/unlock.zkey");

    const vKeyTxt = await fs.readFile("./circuits/unlock.vkey.json");
    const vKey = JSON.parse(vKeyTxt.toString());

    const res = await groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
        const proofForTx = [
            proof.pi_a[0],
            proof.pi_a[1],
            proof.pi_b[0][1],
            proof.pi_b[0][0],
            proof.pi_b[1][1],
            proof.pi_b[1][0],
            proof.pi_c[0],
            proof.pi_c[1],
        ];
        const unlockTx = await contract.unlockAccount(proofForTx, publicSignals[0]);
        console.log(`Unlocking account at tx: ${unlockTx.hash}`);
    } else {
        console.log("Invalid proof");
    }
}

createUnlockCalldata().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
