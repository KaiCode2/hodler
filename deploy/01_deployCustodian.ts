
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
// @ts-ignore
import { poseidon } from "circomlibjs";


const deployCustodian: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {

    const { ethers, deployments } = hre;
    const accounts = await ethers.getSigners();

    const recoveryNullifier = ethers.utils.hexZeroPad(poseidon([0]), 32);
    const unlockNullifier  = ethers.utils.hexZeroPad(poseidon([1]), 32);

    const verifierDeployment = await deployments.get("Verifier");

    const deployResults = await deployments.deploy("Custodian", {
        from: accounts[0].address,
		args: [recoveryNullifier, unlockNullifier, accounts[1].address, verifierDeployment.address],
        log: true,
    });
    console.log(`Deployed Custodian to: ${deployResults.address}`);
};

export default deployCustodian;
deployCustodian.tags = ['Custodian'];
