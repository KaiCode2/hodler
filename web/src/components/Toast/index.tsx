// base
import { randomBytes } from "ethers/lib/utils";
import React from "react";
import { toast } from "react-toastify";
// import { Loading } from "../Loader";

// types
import { ToastType, ToastInfo, ToastIcon } from './Toast.types';

// pre configured toasts
import { makeTransactionToast } from "./TransactionToast";


function parseToastIcon(icon: ToastIcon) {
    if (typeof icon === 'string') {
        switch (icon) {
        case 'loading':
            return (
                <div style={{
                    marginTop: '-35px',
                    height: '25px',
                    width: '25px',
                }}>
                    {/* <Loading /> */}
                    <p>Loading...</p>
                </div>
            );
        default:
            return false;
        }
    } else {
        return icon;
    }
}

const ToastMessage = (toastInfo: ToastInfo) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const toastId = toast[toastInfo.type.toLowerCase()](
        <div style={{ display: "flex" }}>
            <div
                style={{
                    fontSize: 15,
                    paddingTop: 8,
                    flexShrink: 0,
                    textAlign: "center",
                    width: "30px"
                }}
            >

            </div>
            <div style={{ flexGrow: 1, fontSize: 15, padding: "8px 12px" }}>
                {toastInfo.message}
            </div>
        </div>
    , {
        toastId: toastInfo.id ?? randomBytes(32).toString(),
        type: 'default',
        autoClose: toastInfo.autoclose,
        icon: toastInfo.icon ? parseToastIcon(toastInfo.icon) : false,
    });

    return {
        toastId,
        update: toast.update.bind(null, toastId),
        dismiss: toast.dismiss.bind(null, toastId),
    }
}

ToastMessage.dismiss = toast.dismiss;
ToastMessage.update = toast.update;

export type { ToastInfo };
export { ToastMessage, ToastType, makeTransactionToast };
