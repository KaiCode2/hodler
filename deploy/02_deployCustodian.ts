
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

    const factoryDeployment = await deployments.get("CustodianFactory");
    const CustodianFactory = await ethers.getContractFactory("CustodianFactory");
    const custodianFactory = CustodianFactory.attach(factoryDeployment.address);

    const deployTx = await custodianFactory.deploy(recoveryNullifier, unlockNullifier, accounts[1].address);
    const deployResult = await deployTx.wait();

    console.log(`Deployed Custodian to: ${deployResult.events?.at(0)?.topics[0]}`);
};

export default deployCustodian;
deployCustodian.tags = ['Custodian'];
