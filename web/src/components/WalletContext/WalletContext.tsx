import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ethers, providers } from "ethers";


export interface ContextType {
    providerState: string;
    provider?: providers.Web3Provider;
    connectWallet: () => void;
}

const WalletContext = createContext<ContextType>({
    providerState: "not-connected",
    connectWallet: () => { }
});

export function useWallet() {
    return useContext(WalletContext);
}

export interface Props {
    children: ReactNode;
}

export function WalletProvider({ children }: Props) {
    const [provider, setProvider] = useState<providers.Web3Provider | undefined>();
    const [providerState, setProviderState] = useState("not-connected");

    async function connectWallet() {
        if (!window.ethereum) {
            setProviderState("not-connected");
            return;
        }
        const ethereum = window.ethereum!;

        try {
            await ethereum.request!({
                method: "eth_requestAccounts",
            });
            await loadEthProvider();
        } catch (err) {
            setProviderState("not-connected");
        }
    }

    async function loadEthProvider() {
        if (!window.ethereum) {
            setProviderState("not-connected");
            return;
        }
        const ethereum = window.ethereum!;

        const accounts = await ethereum.request!({
            method: "eth_accounts",
        });

        if (!accounts.length) {
            setProviderState("not-connected");
            return;
        }

        const newProvider = new providers.Web3Provider(window.ethereum);
        
        // Check network ID
        if (process.env.NEXT_PUBLIC_CHAIN_ID) {
            const requiredChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID);
            const { chainId } = await newProvider.getNetwork();
            if (requiredChainId != chainId) {
                await ethereum.request!({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: ethers.utils.hexValue(requiredChainId) }],
                });
            }
        }

        setProvider(newProvider);
        setProviderState("ready");
    }

    useEffect(() => {
        if (window.ethereum) {
            // Subscribe to accountsChanged event
            (window.ethereum as any).on('accountsChanged', (accounts: any[]) => {
                // Causes page loads on wallet disconnect
                if (!accounts.length) {
                    location.reload();
                }
            });

            // TODO: add listener for network change
        }
    }, []);

    return (
        <WalletContext.Provider value={{ providerState, provider, connectWallet }}>
            {children}
        </WalletContext.Provider>
    );
}
