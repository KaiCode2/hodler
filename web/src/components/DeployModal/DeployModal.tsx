
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import React, { useEffect, useRef, useState } from "react";

interface DeployModalProps {
    onComplete: (unlock: string, reset: string) => void;
    onExit: () => void;
}

function DeployModal(props: DeployModalProps): JSX.Element {
    const [step, setStep] = useState(0);
    const [mismatchError, setMismatchError] = useState<boolean>(false);

    const [unlockNullifier, setUnlockNullifier] = useState<string>();
    const [confirmUnlock, setConfirmUnlock] = useState<string>();
    const [resetNullifier, setResetNullifier] = useState<string>(randomBytes(32).toString('base64'));
    const [confirmReset, setConfirmReset] = useState<string>();

    // TODO: Recovery address?

    const onConfirm = () => {
        if (step === 0) {
            if (unlockNullifier === confirmUnlock && unlockNullifier) {
                // TODO: unlockNullifier.length > 6
                setStep(1);
            } else {
                setMismatchError(true);
            }
        } else if (step === 1) {
            setStep(2);
        } else if (step === 2) {
            if (resetNullifier === confirmReset) {
                props.onComplete(unlockNullifier!, resetNullifier);
            } else {
                setMismatchError(true);
            }
        } else {
            // fuck
        }
    }

    useEffect(() => {
        if (unlockNullifier === confirmUnlock) {
            setMismatchError(false);
        }
    }, [unlockNullifier, confirmUnlock]);

    return (
        <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                    <div className="bg-white dark:bg-gray-200 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h4 className="text-xl font-medium leading-6 text-gray-900 mb-6" id="modal-title">Create Custodian</h4>
                                {step === 0 &&
                                    <>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">Create an unlock password. This will be required every time you want to interact with your custodian. <span className="font-bold">Do not forget this password.</span></p>
                                        </div>
                                        <div className="mb-4 mt-8">
                                            <label htmlFor="password" className={`block mb-2 text-sm font-bold ${!mismatchError ? "text-gray-900 dark:text-black" : "text-red-700 dark:text-red-500"}`}>Unlock Password</label>
                                            <input type="password" id="password" className={!mismatchError ? "bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-400 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" : "bg-red-50 border border-red-500 text-red-900 placeholder-red-700 text-sm rounded-lg focus:ring-red-500 dark:bg-gray-700 focus:border-red-500 block w-full p-2.5 dark:text-red-500 dark:placeholder-red-500 dark:border-red-500"}
                                                placeholder="•••••" required
                                                onChange={(e) => setUnlockNullifier(e.target.value)} />
                                        </div>
                                        <div className="mb-4">
                                            <label htmlFor="confirmPassword" className={`block mb-2 text-sm font-bold ${!mismatchError ? "text-gray-900 dark:text-black" : "text-red-700 dark:text-red-500"}`}>Confirm Unlock Password</label>
                                            <input type="password" id="confirmPassword" className={!mismatchError ? "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-400 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" : "bg-red-50 border border-red-500 text-red-900 placeholder-red-700 text-sm rounded-lg focus:ring-red-500 dark:bg-gray-700 focus:border-red-500 block w-full p-2.5 dark:text-red-500 dark:placeholder-red-500 dark:border-red-500"}
                                                placeholder="•••••" required
                                                onChange={(e) => setConfirmUnlock(e.target.value)} />
                                            <p className="mt-2 text-sm text-red-600 dark:text-red-500" hidden={!mismatchError}>Password's don't match</p>
                                        </div>
                                    </>
                                }
                                {step === 1 &&
                                    <>
                                        <p className="text-sm text-gray-500 mt-2">Your recovery code is:</p>
                                        <p className="mt-4 mb-4 text-gray-500 font-bold border border-gray-700 p-3">{resetNullifier}</p>
                                        <p className="text-md text-gray-500 font-bold mt-2">Keep this code safe. Anyone with this key is able to request an account reset.</p>
                                    </>
                                }
                                {step === 2 &&
                                    <div className="w-full">
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-700">Confirm your recovery code.</p>
                                        </div>
                                        <div className="mb-4 mt-8 w-full">
                                            <label htmlFor="password" className={`block mb-2 text-sm font-bold ${!mismatchError ? "text-gray-900 dark:text-black" : "text-red-700 dark:text-red-500"}`}>Reset Code</label>
                                            <input type="password" id="password" className={`w-full ${!mismatchError ? "bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-400 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" : "bg-red-50 border border-red-500 text-red-900 placeholder-red-700 text-sm rounded-lg focus:ring-red-500 dark:bg-gray-700 focus:border-red-500 block w-full p-2.5 dark:text-red-500 dark:placeholder-red-500 dark:border-red-500"}`}
                                                placeholder="•••••" required
                                                onChange={(e) => setConfirmReset(e.target.value)} />
                                        </div>
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                        <button type="button" className="inline-flex w-full justify-center rounded-md border border-transparent bg-sky-500 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onConfirm}>Next</button>
                        <button type="button" className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={props.onExit}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { DeployModal };
export type { DeployModalProps };
