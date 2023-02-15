import React, { useMemo } from "react";

// contracts
import { Contract } from "@ethersproject/contracts";
import {
  CustodianFactory,
  CustodianFactory__factory,
} from "@/typechain-types";

// hooks
import { useWallet } from "@/components/WalletContext/WalletContext";

// components
import { makeTransactionToast } from "@/components/Toast";

interface WrapperContract {
  contract: Contract;
}

// NOTE: Wraps contract in a proxy. When contract calls are made, Toasts are automatically presented
export function wrapContract<T extends Contract = Contract>(contract: Contract) {
  const handler = {
    get(target: WrapperContract, key: any, value: any) {
      if (contractWrapper.contract.functions[key]) {
        const originalMethod = target.contract[key];
        const functionInfo =
          contractWrapper.contract.interface.getFunction(key);
        // Checks if the function is not pure or view (requiring user to sign)
        if (functionInfo && !functionInfo.constant) {
          return (...args: any) => {
            const pendingTx = originalMethod.apply(this, args);
            makeTransactionToast(pendingTx);
            return pendingTx;
          };
        }
      }

      return target.contract[key];
    },
  };
  const contractWrapper: WrapperContract = {
    contract,
  };
  const proxy = new Proxy(contractWrapper, handler);
  return proxy as unknown as T;
}

// returns null on errors
export function useContract<T extends Contract = Contract>(
  addressOrAddressMap: string | Record<number, string> | undefined,
  ABI: any,
  withSignerIfPossible = true
): T | null {
  const { provider, signer } = useWallet();

  return useMemo(() => {
    if (!addressOrAddressMap || !ABI || !provider) {
      return null;
    }

    let address: string | undefined;
    if (typeof addressOrAddressMap === "string") {
      address = addressOrAddressMap;
    }
    if (!address) {
      return null;
    }
    try {
      const contract: Contract = new Contract(address, ABI, withSignerIfPossible ? (signer ?? provider) : provider);
      return wrapContract(contract);
    } catch (error) {
      console.error("Failed to get contract", error);
      return null;
    }
  }, [addressOrAddressMap, ABI, signer, withSignerIfPossible]) as T;
}

export function useCustodianFactoryContract(
  address: string = process.env.NEXT_PUBLIC_CUSTODIAN_FACTORY_ADDRESS as string
) {
  return useContract<CustodianFactory>(address, CustodianFactory__factory.abi);
}
