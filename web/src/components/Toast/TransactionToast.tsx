
import React from 'react';
import { ToastMessage, ToastType } from ".";

export function makeTransactionToast(pendingTransaction: any) {
    if (pendingTransaction.then) {
        const toast = ToastMessage({
            message: "Awaiting Signature...",
            type: ToastType.INFO,
            autoclose: false,
            icon: "loading",
        });

        pendingTransaction.then((pendingResult: any) => {
            let explorerUrl: string;

            if (process.env.NEXT_PUBLIC_EXPLORER_URL) {
                explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL;
            }
            // TODO: ensure chain ID of tx matches process.env.NEXT_PUBLIC_CHAIN_ID

            if (pendingResult.wait) {
                toast.update({
                    render() {
                        if (explorerUrl) {
                            return (
                                <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                                    <div style={{
                                        color: "black",
                                        textDecoration: "none",
                                        height: '60px',
                                    }}>
                                        <h4 style={{
                                            height: '20px',
                                            marginBlockStart: '5px',
                                            marginBlockEnd: '0px',
                                        }}>Transaction Pending</h4>
                                        <p style={{
                                            height: '20px',
                                            marginBlockStart: '5px',
                                            marginBlockEnd: '0px',
                                        }}>View on Etherscan</p>
                                    </div>
                                </a>
                            );
                        } else {
                            return "Transaction Pending";
                        }
                    },
                });
                pendingResult.wait().then((executedResult: any) => {
                    toast.update({
                        render() {
                            if (explorerUrl) {
                                return (
                                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                                        <div style={{
                                            color: "black",
                                            textDecoration: "none",
                                            height: '60px',
                                        }}>
                                            <h4 style={{
                                                height: '20px',
                                                marginBlockStart: '5px',
                                                marginBlockEnd: '0px',
                                            }}>Transaction Successful!</h4>
                                            <p style={{
                                                height: '20px',
                                                marginBlockStart: '5px',
                                                marginBlockEnd: '0px',
                                            }}>View on Etherscan</p>
                                        </div>
                                    </a>
                                );
                            } else {
                                return "Transaction Successful!";
                            }
                        },
                        type: "success",
                        autoClose: 5_000,
                        icon: "✅",
                    });
                }).catch((err: any) => {
                    toast.update({
                        render: "Error Occured",
                        type: "error",
                        autoClose: 5_000,
                        icon: false,
                    });
                    console.log(err);
                });
            } else {
                toast.dismiss();
            }
        }).catch((err: any) => {
            // TODO: Move error handling somewhere else...
            let errorText: string;
            if (err.error && err.error.data && err.error.data.message) {
                // Ethers JS error
                if (err.error.data.message.startsWith("Error: VM Exception while processing transaction:")) {
                    const errorMessage: string = err.error.data.message.slice(79, -1);
                    errorText = "Error in ".concat(errorMessage);
                } else {
                    errorText = "Error";
                }
            } else if (err.code && err.code === 'ACTION_REJECTED') {
                // Metamask error if err.code exists
                errorText = "Transaction Rejected";
            } else {
                errorText = "Error";
            }
            toast.update({
                render() {
                    return errorText;
                },
                type: "error",
                autoClose: 5_000,
                icon: false,
            });
        });
    }
}
