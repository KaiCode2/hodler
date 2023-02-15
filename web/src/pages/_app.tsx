import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Router from 'next/router';
import React from 'react';
import { WalletProvider } from '@/components/WalletContext/WalletContext';
import Layout from '@/components/Layout';
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <WalletProvider>
        <Component {...pageProps} />
        <ToastContainer
                position="bottom-right"
                autoClose={8000}
                hideProgressBar={false}
                newestOnTop={false}
                draggable={false}
                limit={3}
                closeOnClick
                pauseOnHover
            />
      </WalletProvider>
    </Layout>
  );
}

// TODO: Create page load animations
// Router.events.on('routeChangeStart', () => console.log("start"));
// Router.events.on('routeChangeComplete', () => console.log("done"));
// Router.events.on('routeChangeError', () => console.log("fail"));
