import React, { useState, useEffect } from "react";
import {wrapContract, useCustodianFactoryContract } from "./useContract";

// hooks
import { useWallet } from "@/components/WalletContext/WalletContext";

// contracts
import { Custodian__factory } from "@/typechain-types";
import { Contract, ethers } from "ethers";
import { poseidonHashHex } from "@/utils/poseidon";

function useCustodian() {
  const { address, signer, provider } = useWallet();
  const custodianFactory = useCustodianFactoryContract();
  const [custodianAddress, setCustodianAddress] = useState<string | undefined>();

  useEffect(() => {
    getCustodian();
  }, [address, custodianFactory]);

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
      const recoveryNullifier = await poseidonHashHex(unlock);
      const unlockNullifier = await poseidonHashHex(recovery);
      const deployTx = await custodianFactory.safeDeploy(
        recoveryNullifier,
        unlockNullifier,
        recoveryTrustee
      );
      await deployTx.wait();
      await getCustodian();
    }
  };

  return {
    exists: !!custodianAddress,
    factory: custodianFactory,
    deployCustodian,
    custodian: custodianAddress && wrapContract(new Contract(custodianAddress, Custodian__factory.abi, signer ?? provider))
  };
}

export { useCustodian };
