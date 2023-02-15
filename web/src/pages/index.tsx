
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@/components/WalletContext/WalletContext';
import { DeployModal } from '@/components/DeployModal';
import { useCustodianFactoryContract } from '@/hooks/useContract';
import { useCustodian } from '@/hooks/useCustodian';
import { poseidonHashHex } from '@/utils/poseidon';
import { ethers } from 'ethers';

export default function Home() {
  const { address, signer, providerState, connectWallet } = useWallet();
  const router = useRouter();
  const { deployed, deployCustodian } = useCustodian();
  
  const [showDisplayModal, setShowDisplayModal] = useState(false);

  const handleDeploy = async (unlock: string, recovery: string) => {
    await deployCustodian(unlock, recovery, ethers.constants.AddressZero);
  }

  const handleLaunchDashboard = (e: any) => {
    console.log(1111)
    e.preventDefault()
    router.push('/dashboard');
  }

  return (
    <div className="">
      <main className="flex flex-col flex-auto items-stretch justify-center p-8 bg-slate-900 text-slate-50 h-screen w-screen">

        <div className="flex flex-col justify-center items-center">
          <h1 className="col px-8 py-2 rounded-lg text-3xl text-stone-100">Welcome to Hodler</h1>
          <p className='mb-10 '>Unaudited degen security</p>
        </div>

        {address ?
          <>
            {deployed ? 
              <button onClick={handleLaunchDashboard} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Launch Dashboard</button> :
              <button onClick={() => setShowDisplayModal(true)} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Deploy Custodian</button>
            } 
          </>:
          <button onClick={connectWallet} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Connect</button>
        }

        { showDisplayModal &&
          <DeployModal onComplete={handleDeploy} onExit={() => setShowDisplayModal(false)} />
        }

      </main>

      <footer className="">

      </footer>
    </div>
  )
}
