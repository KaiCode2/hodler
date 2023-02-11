
import { useEffect, useState } from 'react';
import { useWallet } from '@/components/WalletContext/WalletContext';
import { useCustodianFactoryContract } from '@/hooks/useContract';
import { ethers } from 'ethers';

export default function Home() {
  const { provider, providerState, connectWallet } = useWallet();
  const [custodian, setCustodian] = useState();
  const custodianFactory = useCustodianFactoryContract();

  useEffect(() => {
    console.log(provider, providerState, custodianFactory)
    if (provider && custodianFactory) {
      const getCustodian = async () => {
        const accounts = await provider.listAccounts();
        const primaryAccount = accounts[0];
        console.log(accounts, primaryAccount);

        const deploymentResult = await custodianFactory.deployments(primaryAccount);
        console.log(deploymentResult);

        if (deploymentResult !== ethers.constants.AddressZero) {
          console.log('deploy new');
          // setCustodian();
        } else {
          console.log('existing');
        }
      };

      getCustodian();
    }
  }, [provider, providerState, custodianFactory]);

  const deployCustodian = async () => {
    if (provider && custodianFactory && !custodian) {
      const deployCustodian = async () => {
        // const recoveryNullifier = ethers.utils.hexZeroPad(poseidon([0]), 32);
        // const unlockNullifier = ethers.utils.hexZeroPad(poseidon([1]), 32);
        // const deployTx = await custodianFactory.safeDeploy()
      }
      deployCustodian();
    }
  }

  return (
    <div className="">
      <main className="flex flex-col flex-auto items-stretch justify-center p-8 bg-slate-900 text-slate-50 h-screen w-screen">

        <div className="flex justify-center items-center">
          <h1 className="col m-10 px-8 py-2 rounded-lg text-3xl text-stone-100">Welcome to Custodian</h1>
        </div>

        {provider ?
          <button onClick={deployCustodian} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Deploy Custodian</button> :
          <button onClick={connectWallet} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Connect</button>
        }

      </main>

      <footer className="">

      </footer>
    </div>
  )
}
