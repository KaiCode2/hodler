import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-circom";
import "hardhat-deploy";
import { encodeMessage } from "./scripts/encodeStrings";
import { config as configEnv } from "dotenv";

configEnv();

task("encode", "Encode a string to big number")
  .addPositionalParam("input", "string to encode")
  .setAction(async ({ input }) => console.log(encodeMessage(input)));



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
      // accounts: testnetAccounts,
      loggingEnabled: true,
      // forking: {
      //   url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      //   blockNumber: 7378872
      // }
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: testnetAccounts,
      chainId: 5
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
