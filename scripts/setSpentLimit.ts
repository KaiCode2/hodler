import hre, { ethers, config } from "hardhat";
// @ts-ignore
import { poseidon } from "circomlibjs";
// @ts-ignore
import { groth16 } from 'snarkjs';
import fs from "fs/promises";

export async function createUnlockCalldata() {
    const signers = await ethers.getSigners();
    const primarySigner = signers[0];
    const custodianDeployment = await hre.deployments.get("Custodian");
    let custodian = await ethers.getContractAt("Custodian", custodianDeployment.address);

    const unlockedUntil = BigInt(await custodian.unlockedUntil());
    if (unlockedUntil < (Date.now() + 6_000)) {
        // TODO: run unlock.ts
    }

    const unlockPassword = 1;
    const hash  = BigInt(ethers.utils.hexZeroPad(poseidon([unlockPassword]), 32));
    const nonce = BigInt((await custodian.nonce()).toNumber());
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
        const sendEthToContract = await primarySigner.sendTransaction({
            to: custodian.address,
            value: ethers.utils.parseEther("10.0")
        });
        await sendEthToContract.wait();
        const setLimitTx = await custodian.setSpendLimit(custodian.address, ethers.utils.parseEther("5.0"), proofForTx, publicSignals[0]);
        console.log(`Eth limit set at tx: ${setLimitTx.hash}`);
        await setLimitTx.wait();
        const returnEthTx = await custodian.sendEth(ethers.utils.parseEther("4.0"), "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
        await returnEthTx.wait();
        const returnEthTx2 = await custodian.sendEth(ethers.utils.parseEther("4.0"), "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
        await returnEthTx2.wait();
    } else {
        console.log("Invalid proof");
    }
}

createUnlockCalldata().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});