
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";


const deployVerifier: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
    const { ethers } = hre;

    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.deployed();
    console.log(`Verifier deployed to: ${verifier.address}`);
};

export default deployVerifier;
