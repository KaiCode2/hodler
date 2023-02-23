import React, { useState, useEffect } from "react";
import {wrapContract, useCustodianFactoryContract } from "./useContract";

// hooks
import { useWallet } from "@/components/WalletContext/WalletContext";

// contracts
import { Custodian, Custodian__factory } from "@/typechain-types";
import { Contract, ethers } from "ethers";
import { poseidonHashHex } from "@/utils/poseidon";
// @ts-ignore
import { groth16 } from 'snarkjs';
import * as vKey from '@/circuits/unlock.vkey.json';

function useCustodian() {
  const { address, signer, provider } = useWallet();
  const custodianFactory = useCustodianFactoryContract();
  const [custodianAddress, setCustodianAddress] = useState<string | undefined>();
  const [custodian, setCustodian] = useState<Custodian>();

  useEffect(() => {
    getCustodian();
  }, [address, custodianFactory]);

  useEffect(() => {
    if (custodianAddress) {
      setCustodian(wrapContract(new Contract(custodianAddress, Custodian__factory.abi, signer ?? provider)) as Custodian);
    }
  }, [custodianAddress]);

  const getCustodian = async () => {
    if (address && custodianFactory) {
      const userCustodian = await custodianFactory.deployments(address);
      if (userCustodian !== ethers.constants.AddressZero) {
        setCustodianAddress(userCustodian);
      }
    }
  };

  const deployCustodian = async (
    unlock: string,
    recovery: string,
    recoveryTrustee: string
  ) => {
    if (custodianFactory) {
      const unlockNullifier = await poseidonHashHex(unlock);
      const recoveryNullifier = await poseidonHashHex(recovery);
      const deployTx = await custodianFactory.safeDeploy(
        recoveryNullifier,
        unlockNullifier,
        recoveryTrustee
      );
      await deployTx.wait();
      await getCustodian();
    }
  };

  const unlock = async (unlock: string) => {
    if (!custodian || !address) {
      return;
    }
    const nonce = await custodian.currentNonce();
    console.log(`Nonce: ${nonce}`);

    const unlockNullifier = await poseidonHashHex(unlock);
    const hash  = BigInt(ethers.utils.hexZeroPad(unlockNullifier, 32));
    const circuitInputs = {
      hash,
      nonce: nonce.toBigInt(),
      address: BigInt(address),
      preimage: BigInt(unlock),
  };

  const { proof, publicSignals } = await groth16.fullProve(circuitInputs, "./circuits/unlock.wasm", "./circuits/unlock.zkey");

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
      const unlockTx = await custodian.unlockAccount(proofForTx, publicSignals[0]);
      console.log(`Unlocking account at tx: ${unlockTx.hash}`);
  } else {
      console.log("Invalid proof");
  }
  };

  const lock = async () => {
    if (!custodian) {
      return;
    }
    await custodian.lock();
  };

  return {
    deployed: !!custodianAddress,
    address: custodianAddress,
    factory: custodianFactory,
    deployCustodian,
    unlock,
    lock,
    custodian
  };
}

export { useCustodian };
