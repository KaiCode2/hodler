pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template Unlock() {
    // The public inputs
    signal output nullifier;
    signal input hash;
    signal input nonce;
    signal input address;

    // The private inputs
    signal input preimage;

    // Hash the preimage and check if the result matches the committed hash.
    component hasher = Poseidon(1);
    hasher.inputs[0] <== preimage;

    hasher.out === hash;

    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== preimage;
    nullifierHasher.inputs[1] <== nonce;
    nullifierHasher.inputs[2] <== address;

    log("Nullifier is: ", nullifierHasher.out);

    nullifier <== nullifierHasher.out;
}

component main { public [hash, nonce, address] } = Unlock();


