import Head from 'next/head'
import Image from 'next/image'
import { useWallet } from '@/components/WalletContext';
import { useEffect } from 'react';


export default function Home() {
  const { provider, connectWallet } = useWallet();

  useEffect(() => {

  }, [provider]);

  return (
    <div className="">
      <Head>
        <title>Custodian</title>
        <meta name="description" content="Secure your tokens yourself today" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col flex-auto items-stretch justify-center p-8 bg-slate-900 text-slate-50 h-screen w-screen">

        <div className="flex justify-center items-center">
          <h1 className="col m-10 px-8 py-2 rounded-lg text-3xl text-stone-100">Welcome to Custodian</h1>
        </div>

        { provider ? 
          <button onClick={() => connectWallet()} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Connect</button> :
          <button onClick={() => connectWallet()} className="col self-center max-w-2xl m-10 px-8 py-2 rounded-lg bg-emerald-300 text-lg text-stone-900">Deploy Custodian</button>
        }
        
      </main>

      <footer className="">
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className="">
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  )
}
