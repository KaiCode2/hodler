import { ethers, config } from "hardhat";
// @ts-ignore
import { poseidon, mimcsponge } from "circomlibjs";
// @ts-ignore
import { groth16 } from 'snarkjs';
import fs from "fs/promises";

export async function createUnlockCalldata(/*nullifier: string, nonce: number, sender: string*/) {
    const circuitInputs = {
        hash: BigInt('19014214495641488759237505126948346942972912379615652741039992445865937985820'),
        nonce: BigInt(0),
        address: BigInt("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
        preimage: BigInt(0),
    };

    const { proof, publicSignals } = await groth16.fullProve(circuitInputs, "./circuits/unlock.wasm", "./circuits/unlock.zkey");

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

    const proofAsStr = JSON.stringify(
        proofForTx.map((x) => BigInt(x).toString(10)),
    ).split('\n').join().replaceAll('"', '');
    console.log(proofAsStr, publicSignals)

    console.log("Proof: ");
    console.log(JSON.stringify(proof, null, 1));

    const vKeyTxt = await fs.readFile("./circuits/unlock.vkey.json");
    const vKey = JSON.parse(vKeyTxt.toString());

    const res = await groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }
}

createUnlockCalldata().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
