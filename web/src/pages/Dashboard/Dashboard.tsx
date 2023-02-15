
import { useState } from "react";
import { useWallet } from '@/components/WalletContext/WalletContext';
import { useCustodian } from '@/hooks/useCustodian';

function Dashboard(): JSX.Element {

    const { address, signer } = useWallet();
    const { custodian } = useCustodian();

    return (
        <div className="w-screen h-screen bg-slate-900 text-slate-50">
            <h1>Dash</h1>
        </div>
    );
}

export { Dashboard };
