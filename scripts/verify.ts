import { deployments, run, network } from "hardhat";

export async function verifyContracts() {
  const verifierDeployment = await deployments.get("Verifier");
  const custodianDeployment = await deployments.get("CustodianFactory");
  console.log(verifierDeployment, custodianDeployment)

  // 5. Verify on Etherscan
  if (network.name == "mainnet" || network.name == "goerli") {
    await run("verify:verify", {
      address: "0xcb698d9546cdfc62096466475cc9c69e27294886",
      constructorArguments: [],
    });

    await run("verify:verify", {
        address: custodianDeployment.address,
        constructorArguments: [
          verifierDeployment
        ],
      });
  }
}

verifyContracts().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
