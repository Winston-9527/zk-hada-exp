import { derivePublicKey, signMessage, verifySignature } from '@zk-kit/eddsa-poseidon';
import { Fr, packPoint } from '@zk-kit/baby-jubjub';
import { poseidon2, poseidon3, poseidon4 } from 'poseidon-lite';

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function bigIntToBytes(bi) {
    const hex = bi.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
}

export function generateKeyPair() {
    // Generate a random secret key as 32-byte hex
    const skBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) skBytes[i] = Math.floor(Math.random() * 256);
    // Ensure it's a valid scalar (less than order)
    const skBigInt = BigInt('0x' + Buffer.from(skBytes).toString('hex')) % Fr._order;
    // Derive public key from the binary representation (not the decimal string)
    const skBuffer = bigIntToBytes(skBigInt);
    const pk = derivePublicKey(skBuffer);
    return {
        sk: skBigInt.toString(),
        Ax: pk[0].toString(),
        Ay: pk[1].toString(),
    };
}

export function sign(skStr, message) {
    const skBigInt = BigInt(skStr);
    const skBuffer = bigIntToBytes(skBigInt);
    const sig = signMessage(skBuffer, BigInt(message));
    return {
        S: sig.S.toString(),
        R8x: sig.R8[0].toString(),
        R8y: sig.R8[1].toString(),
    };
}

export function hashCert(Ax, Ay, cap, expiry) {
    return poseidon4([BigInt(Ax), BigInt(Ay), BigInt(cap), BigInt(expiry)]).toString();
}

export function hashNullifier(secret, domain) {
    return poseidon2([BigInt(secret), BigInt(domain)]).toString();
}

export function buildDepth2Tree(leaves) {
    if (leaves.length !== 4) throw new Error('Depth-2 tree requires exactly 4 leaves');
    const h01 = poseidon2([BigInt(leaves[0]), BigInt(leaves[1])]);
    const h23 = poseidon2([BigInt(leaves[2]), BigInt(leaves[3])]);
    const root = poseidon2([h01, h23]);
    return {
        root: root.toString(),
        leaves: leaves.map(l => l.toString()),
        level1: [h01.toString(), h23.toString()],
    };
}

export function getPath(tree, index) {
    const path0 = index & 1;
    const path1 = (index >> 1) & 1;
    // XOR with 1 flips the lowest bit to get the correct sibling index
    // in a depth-2 binary tree where Poseidon(left,right) is non-commutative.
    const sib0 = tree.leaves[index ^ 1];
    const sib1 = tree.level1[(index >> 1) ^ 1];
    return { sib0, sib1, path0: String(path0), path1: String(path1) };
}

export function verifySig(Ax, Ay, S, R8x, R8y, M) {
    const pk = [BigInt(Ax), BigInt(Ay)];
    const sig = {
        S: BigInt(S),
        R8: [BigInt(R8x), BigInt(R8y)],
    };
    return verifySignature(pk, sig, BigInt(M));
}
