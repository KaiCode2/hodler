import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Router from 'next/router';
import { ThemeProvider } from "next-themes";
import React from 'react';
import { WalletProvider } from '@/components/WalletContext/WalletContext';
import Layout from '@/components/Layout';
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { Themes, allThemes } from '@/utils/themes';
import { PageLoading } from '@/components/Loading';


export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <Layout title='Hodler'>
      <ThemeProvider attribute="data-theme" themes={allThemes} defaultTheme={Themes.night}>
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
          <PageLoading />
        </WalletProvider>
      </ThemeProvider>
    </Layout>
  );
}
