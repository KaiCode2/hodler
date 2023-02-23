
import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/pageTemplates/Dashboard";
import { useWallet } from '@/components/WalletContext/WalletContext';
import { useCustodian } from '@/hooks/useCustodian';

export default function AppPage(): JSX.Element {
    const { address, ensName, signer } = useWallet();
    const { custodian } = useCustodian();
    const [unlocked, setUnlocked] = useState<boolean>();

    useEffect(() => {
        if (custodian) {
            custodian.isUnlocked().then(({ unlocked }) => {
                setUnlocked(unlocked);
            });
        }
    }, [custodian]);

    return (
        <div>
            <Navbar networkImage="/assets/eth/eth-black.png" address={address ?? ""} ensName={ensName} unlocked={unlocked ?? false} />
            <Dashboard />
        </div>
    );
}

