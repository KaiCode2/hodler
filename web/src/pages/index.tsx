
import { useEffect, useState } from 'react';
import { useWallet } from '@/components/WalletContext/WalletContext';
import { DeployModal } from '@/components/DeployModal';
import { useCustodianFactoryContract } from '@/hooks/useContract';
import { poseidonHashHex } from '@/utils/poseidon';
import { ethers } from 'ethers';

export default function Home() {
  const { signer, providerState, connectWallet } = useWallet();
  const [custodian, setCustodian] = useState();
  const custodianFactory = useCustodianFactoryContract();
  const [showDisplayModal, setShowDisplayModal] = useState(false);

  useEffect(() => {
    console.log(signer, providerState, custodianFactory)
    if (signer && custodianFactory) {
      const getCustodian = async () => {
        const address = await signer.getAddress();
        const deploymentResult = await custodianFactory.deployments(address);
        console.log(deploymentResult);

        if (deploymentResult === ethers.constants.AddressZero) {
          console.log('deploy new', deploymentResult);
          // setCustodian();
        } else {
          console.log('existing', deploymentResult);
        }
      };

      getCustodian();
    }
  }, [signer, providerState, custodianFactory]);

  const deployCustodian = async (unlock: string, recovery: string) => {
    console.log(unlock, recovery)
    if (signer && custodianFactory && !custodian) {
      const deployCustodian = async () => {
        const recoveryNullifier = await poseidonHashHex(unlock);
        const unlockNullifier =  await poseidonHashHex(recovery);
        console.log(recoveryNullifier, unlockNullifier, custodianFactory, await signer.getAddress());
        const deployTx = await custodianFactory.safeDeploy(recoveryNullifier, unlockNullifier, "0xC20a0b352F21AEb0440Fe1F8705344bc7A9b49d1");
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

        {signer ?
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
