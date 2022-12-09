import { HardhatRuntimeEnvironment } from "hardhat/types";
// @ts-ignore
import { poseidon } from "circomlibjs";
// @ts-ignore
import { groth16 } from 'snarkjs';
import fs from "fs/promises";

export async function unlockCustodian(
    hre: HardhatRuntimeEnvironment,
    unlockPassword: string = "1",
) {
    const { ethers, config } = hre;
    const custodianDeployment = await hre.deployments.get("Custodian");
    let contract = await ethers.getContractAt("Custodian", custodianDeployment.address);
    const signers = await ethers.getSigners();
    const hash  = BigInt(ethers.utils.hexZeroPad(poseidon([parseInt(unlockPassword)]), 32));
    const nonce = await contract.currentNonce();
    console.log(nonce)
    // const nonce = 0
    const circuitInputs = {
        hash,
        nonce: BigInt(nonce),
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

// Determines if this is called from hardhat config or via hardhat run / node. 
// If in config, hardhat cannot be imported yet and must be lazy loaded
if (process.env.HARDHAT_VERSION !== undefined) {
    import("hardhat").then((hre) => {
        unlockCustodian(hre).catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
    });
}
