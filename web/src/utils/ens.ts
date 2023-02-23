
import { providers } from "ethers";

async function ENSNameForAddress(address: string): Promise<string | null> {
    const mainnetProvider = new providers.InfuraProvider('mainnet', process.env.NEXT_PUBLIC_INFURA_KEY);
    return await mainnetProvider.lookupAddress(address);
}

export { ENSNameForAddress };
