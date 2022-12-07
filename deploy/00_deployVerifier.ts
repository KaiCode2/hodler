
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";


const deployVerifier: DeployFunction = async function (
    hre: HardhatRuntimeEnvironment
) {
    const { ethers, deployments } = hre;
    const accounts = await ethers.getSigners();

    const deployResults = await deployments.deploy("Verifier", {
        from: accounts[0].address,
		args: [],
        log: true,
    });
    console.log(`Deployed Verifier to: ${deployResults.address}`);
};

export default deployVerifier;
deployVerifier.tags = ['Verifier'];
