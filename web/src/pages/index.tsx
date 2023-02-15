
import { useEffect, useState } from 'react';
import { useWallet } from '@/components/WalletContext/WalletContext';
import { DeployModal, DeployModalProps } from '@/components/DeployModal';
import { useCustodianFactoryContract } from '@/hooks/useContract';
import { ethers } from 'ethers';
// @ts-ignore
import { buildPoseidon } from "circomlibjs";

export default function Home() {
  const { provider, providerState, connectWallet } = useWallet();
  const [custodian, setCustodian] = useState();
  const custodianFactory = useCustodianFactoryContract();
  const [showDisplayModal, setShowDisplayModal] = useState(false);

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

  const deployCustodian = async (unlock: string, recovery: string) => {
    console.log(unlock, recovery)
    if (provider && custodianFactory && !custodian) {
      const deployCustodian = async () => {
        const poseidon = buildPoseidon();
        console.log(poseidon);
        const recoveryNullifier = ethers.utils.hexZeroPad(poseidon([0]), 32);
        const unlockNullifier = ethers.utils.hexZeroPad(poseidon([1]), 32);
        const deployTx = await custodianFactory.safeDeploy(recoveryNullifier, unlockNullifier, ethers.constants.AddressZero);
      }
      deployCustodian();
    }
  }

  return (
    <div className="">
      <main className="flex flex-col flex-auto items-stretch justify-center p-8 bg-slate-900 text-slate-50 h-screen w-screen">

        <div className="flex flex-col justify-center items-center">
          <h1 className="col px-8 py-2 rounded-lg text-3xl text-stone-100">Welcome to Hodler</h1>
          <p className='mb-10 '>Unaudited degen security</p>
        </div>

        {provider ?
          <button onClick={() => setShowDisplayModal(true)} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Deploy Custodian</button> :
          <button onClick={connectWallet} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Connect</button>
        }

        { showDisplayModal &&
          <DeployModal onComplete={deployCustodian} onExit={() => setShowDisplayModal(false)} />
        }

      </main>

      <footer className="">

      </footer>
    </div>
  )
}
