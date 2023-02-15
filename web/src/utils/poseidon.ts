// @ts-ignore
import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";

async function poseidonHash(input: string | number) {
  const poseidon = await buildPoseidon();
  if (typeof input === "string") {
    const inputAsNumber = parseInt(
      Buffer.from(input, "base64").toString("hex"),
      16
    );
    return poseidon([inputAsNumber]);
  } else if (typeof input === "number") {
    return poseidon([input]);
  } else {
    throw Error("Invalid Input");
  }
}

async function poseidonHashString(input: string | number): Promise<string> {
  const poseidon = await buildPoseidon();
  const hash = await poseidonHash(input);
  return poseidon.F.toString(hash);
}

async function poseidonHashHex(input: string | number): Promise<string> {
  const hash = await poseidonHash(input);
  return ethers.utils.hexZeroPad(hash, 32);
}

export { poseidonHash, poseidonHashString, poseidonHashHex };
