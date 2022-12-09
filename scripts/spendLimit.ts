import { HardhatRuntimeEnvironment } from "hardhat/types";
// import hre, { ethers, config } from "hardhat";
// @ts-ignore
import { poseidon } from "circomlibjs";
// @ts-ignore
import { groth16 } from 'snarkjs';
import fs from "fs/promises";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

export async function setSpendLimit(
    hre: HardhatRuntimeEnvironment,
    token?: string,
    unlockPassword: string = "1",
) {
    const { ethers, config } = hre;
    const signers = await ethers.getSigners();
    const primarySigner = signers[0];
    const custodianDeployment = await hre.deployments.get("Custodian");
    let custodian = await ethers.getContractAt("Custodian", custodianDeployment.address);

    // const address = "0x1234567890123456789012345678901234567890";
    // await impersonateAccount(address);
    // const impersonatedSigner = await ethers.getSigner(address);

    const unlockedUntil = BigInt(await custodian.unlockedUntil());
    if (unlockedUntil < (Date.now() + 6_000)) {
        await hre.run("unlock");
    }

    const hash  = BigInt(ethers.utils.hexZeroPad(poseidon([parseInt(unlockPassword)]), 32));
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
        const setLimitTx = await custodian.setTokenSpendLimit(token ?? custodian.address, ethers.utils.parseEther("5.0"), proofForTx, publicSignals[0]);
        console.log(`Eth limit set at tx: ${setLimitTx.hash}`);
        // await setLimitTx.wait();
        // const returnEthTx = await custodian.sendEth(ethers.utils.parseEther("4.0"), "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
        // await returnEthTx.wait();
        // const returnEthTx2 = await custodian.sendEth(ethers.utils.parseEther("4.0"), "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
        // await returnEthTx2.wait();
    } else {
        console.log("Invalid proof");
    }
}

export async function getSpendLimit(
    hre: HardhatRuntimeEnvironment,
    token?: string
) {
    const { ethers } = hre;
    const custodianDeployment = await hre.deployments.get("Custodian");
    let custodian = await ethers.getContractAt("Custodian", custodianDeployment.address);
    const result = await custodian.getTokenLimit(token ?? custodian.address);

    const { exists, limit } = result;
    if (exists) {
        console.log(`Limit is: ${token ? limit : ethers.utils.formatEther(limit).concat(" Eth")}`);
    } else {
        console.log("No limit set");
    }

    return result;
}

if (process.env.HARDHAT_VERSION !== undefined) {
    import("hardhat").then((hre) => {
        setSpendLimit(hre).catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
    });
}
