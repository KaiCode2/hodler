import { HardhatUserConfig, task, types } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-circom";
import "hardhat-deploy";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import "tsconfig-paths/register";
// @ts-ignore
import { encodeMessage } from "./scripts/encodeStrings";
import { config as configEnv } from "dotenv";

configEnv();

task("encode", "Encode a string to big number")
  .addPositionalParam("input", "string to encode")
  .setAction(async ({ input }) => console.log(encodeMessage(input)));

task("unlock", "Unlock deployed custodian with primary signer")
  .addOptionalPositionalParam("unlockPassword", "The password used to unlock the custodian", process.env.UNLOCKPASSWORD ?? "1", types.string)
  .setAction(async (taskArguments, hre) => {
    const { unlockPassword } = taskArguments;
    const { unlockCustodian } = await import("./scripts/unlock");
    await unlockCustodian(hre, unlockPassword);
  });

task("limit", "Unlock deployed custodian with primary signer")
  .addPositionalParam("method", "Either get or set", "get", types.string)
  .addOptionalPositionalParam("token", "Token to apply limit for", undefined, types.string)
  .addOptionalPositionalParam("unlockPassword", "The password used to unlock the custodian", process.env.UNLOCKPASSWORD ?? "1", types.string)
  .setAction(async (taskArguments, hre) => {
    const { method, token, unlockPassword } = taskArguments;
    if (method == "get") {
      const { getSpendLimit } = await import("./scripts/spendLimit");
      await getSpendLimit(hre, token);
    } else if (method == "set") {
      const { setSpendLimit } = await import("./scripts/spendLimit");
      await setSpendLimit(hre, token, unlockPassword);
    } else {
      console.log(`Invalide method given: ${method}. Must use either get or set.`);
    }
  });

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const MNEMONIC = process.env.MNEMONIC
const testnetAccounts = {
  mnemonic: MNEMONIC,
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 10,
  passphrase: "",
};

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      loggingEnabled: true,
      gasPrice: 1000000000,
      initialBaseFeePerGas: 900000000,
      forking: {
        url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
        // blockNumber: 16380803
      }
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: testnetAccounts,
      chainId: 5
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      // accounts: testnetAccounts,
      chainId: 1
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        },
      },
      {
        version: "0.6.11", // for verified circuit compilations
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        },
      },
    ],
  },
  circom: {
    inputBasePath: "./circuits",
    ptau: "https://hermezptau.blob.core.windows.net/ptau/powersOfTau28_hez_final_15.ptau",
    circuits: [
      {
        name: "unlock",
        // Explicitly generate groth16
        // protocol: "groth16",
      },
    ],
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
};

export default config;
