
import { useState } from "react";
import { useWallet } from '@/components/WalletContext/WalletContext';
import { useCustodian } from '@/hooks/useCustodian';
import { useTheme } from 'next-themes'
import { Themes } from "@/utils/themes";

function Dashboard(): JSX.Element {
    const { theme, setTheme } = useTheme()
    const { address, signer } = useWallet();
    const { custodian } = useCustodian();

    return (
        <div className="w-screen h-screen bg-slate-900 text-slate-50">
            <h1>Dash</h1>
            <button className="btn btn-primary" onClick={() => { setTheme(Themes.coffee) }}>Button</button>
        </div>
    );
}

export { Dashboard };
