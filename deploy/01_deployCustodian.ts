
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
// @ts-ignore
import { poseidon, mimcsponge } from "circomlibjs";


const deployCustodian: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
    const { ethers } = hre;

    const Custodian = await ethers.getContractFactory("Custodian");
    const nullifier = ethers.utils.hexZeroPad(poseidon([0]), 32);
    const custodian = await Custodian.deploy(nullifier, nullifier, "0x5FbDB2315678afecb367f032d93F642f64180aa3");
    await custodian.deployed();
    console.log(`Custodian deployed to: ${custodian.address}`);
};

export default deployCustodian;
