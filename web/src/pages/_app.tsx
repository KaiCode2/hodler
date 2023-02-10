import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import React from 'react';
import { WalletProvider } from '@/components/WalletContext/WalletContext';
import Layout from '@/components/Layout';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <WalletProvider>
        <Component {...pageProps} />
      </WalletProvider>
    </Layout>
  );
}
