import React from "react";
import Head from "next/head";

interface Props {
    title: string;
    children: JSX.Element | JSX.Element[];
}

export default function Layout(props: Props) {
    return (
        <>
            <Head>
                <title>{props.title}</title>
                <meta name="description" content="Secure your tokens yourself today" />
                <link rel="icon" href="/favicon.ico" />

                <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
                <link rel="manifest" href="/favicon/site.webmanifest" />
                <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#5bbad5" />
                <meta name="msapplication-TileColor" content="#da532c" />
                <meta name="theme-color" content="#ffffff" />
                <link rel="stylesheet" href="https://use.typekit.net/cps5ptn.css" />
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons"
                    rel="stylesheet" />
                <meta name="fortmatic-site-verification" content="hX3zvMnrdDbw3EKl" />
            </Head>
            <div className="h-screen w-screen">
                <main className="h-full w-full bg-base-100">
                    {props.children}
                </main>

                <footer className="bg-base-200">

                </footer>
            </div>
        </>
    );
};
