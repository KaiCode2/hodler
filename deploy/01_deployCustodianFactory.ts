
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
// @ts-ignore
import { poseidon } from "circomlibjs";


const deployCustodianFactory: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {

    const { ethers, deployments } = hre;
    const accounts = await ethers.getSigners();

    const verifierDeployment = await deployments.get("Verifier");

    const deployResults = await deployments.deploy("CustodianFactory", {
        from: accounts[0].address,
		args: [verifierDeployment.address],
        log: true,
    });
    console.log(`Deployed Custodian Factory to: ${deployResults.address}`);
};

export default deployCustodianFactory;
deployCustodianFactory.tags = ['CustodianFactory'];
