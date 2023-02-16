
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@/components/WalletContext/WalletContext';
import { DeployModal } from '@/components/DeployModal';
import { useCustodian } from '@/hooks/useCustodian';
import { ethers } from 'ethers';

function LandingPage() {
    const { address, signer, providerState, connectWallet } = useWallet();
    const router = useRouter();
    const { deployed, deployCustodian } = useCustodian();

    const [showDisplayModal, setShowDisplayModal] = useState(false);

    const handleDeploy = async (unlock: string, recovery: string) => {
        await deployCustodian(unlock, recovery, ethers.constants.AddressZero);
    }

    const handleLaunchDashboard = (e: any) => {
        e.preventDefault()
        router.push('/app');
    }

    return (
        <div className="flex flex-col flex-auto items-stretch justify-center p-8 h-screen w-screen bg-base-100">
            <div className="flex flex-col justify-center items-center">
                <h1 className="col text-primary px-8 py-2 rounded-lg text-3xl text-stone-100">Welcome to Hodler</h1>
                <p className='mb-10 text-secondary'>Unaudited degen security</p>
            </div>

            {address ?
                <>
                    {deployed ?
                        <button onClick={handleLaunchDashboard} className="btn-primary btn-lg col self-center max-w-2xl m-10 px-8 py-2 rounded-lg text-lg text-stone-900">Launch Dashboard</button> :
                        <button onClick={() => setShowDisplayModal(true)} className="btn-primary btn-lg col self-center max-w-2xl m-10 px-8 py-2 rounded-lg text-lg text-stone-900">Deploy Custodian</button>
                    }
                </> :
                <button onClick={connectWallet} className="btn-primary btn-lg col self-center max-w-2xl m-10 px-8 py-2 rounded-lg text-lg text-stone-900">Connect</button>
            }

            {showDisplayModal &&
                <DeployModal onComplete={handleDeploy} onExit={() => setShowDisplayModal(false)} />
            }
        </div>
    );
}

export { LandingPage };
