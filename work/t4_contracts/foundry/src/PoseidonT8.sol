// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Poseidon over BN254 with t = 8 (7 inputs), circomlib-compatible, port of circomlibjs/src/poseidon_opt.js.
/// The 1,216 round constants (C 128, S 960, M 8x8, P 8x8) exceed the 24 KB code limit, so they live in two
/// data-only contracts (runtime code = 0x00 || words) and are EXTCODECOPY'd into memory on each call.
/// circomlibjs' own EVM generator fails for t = 8 (stack-depth assertion), hence this port.
contract PoseidonT8 {
    uint256 internal constant Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    address public immutable data1;
    address public immutable data2;
    uint256 public immutable len1;
    uint256 public immutable len2;

    constructor(address d1, address d2, uint256 l1, uint256 l2) { data1 = d1; data2 = d2; len1 = l1; len2 = l2; }

    function poseidon(uint256[7] calldata inp) external view returns (uint256 out) {
        address d1 = data1; address d2 = data2; uint256 l1 = len1; uint256 l2 = len2;
        assembly {
            function pow5(a) -> r { let a2 := mulmod(a, a, Q) r := mulmod(mulmod(a2, a2, Q), a, Q) }
            let K := mload(0x40)                    // constants: C@0, S@128, M@1088, P@1152 (words)
            extcodecopy(d1, K, 1, l1)
            extcodecopy(d2, add(K, l1), 1, l2)
            let st := add(K, 38912)                 // state[8]
            let tm := add(st, 256)                  // tmp[8]
            mstore(0x40, add(tm, 256))
            let cO := K
            let sO := add(K, mul(128, 32))
            let mO := add(K, mul(1088, 32))
            let pO := add(K, mul(1152, 32))
            function mix(st_, tm_, m_) {
                for { let i := 0 } lt(i, 8) { i := add(i, 1) } {
                    let acc := 0
                    for { let j := 0 } lt(j, 8) { j := add(j, 1) } {
                        acc := addmod(acc, mulmod(mload(add(m_, mul(add(mul(j, 8), i), 32))), mload(add(st_, mul(j, 32))), Q), Q)
                    }
                    mstore(add(tm_, mul(i, 32)), acc)
                }
                for { let i := 0 } lt(i, 8) { i := add(i, 1) } { mstore(add(st_, mul(i, 32)), mload(add(tm_, mul(i, 32)))) }
            }
            function sboxAdd(st_, c_, off) {   // state = pow5(state) + C[off + i]
                for { let i := 0 } lt(i, 8) { i := add(i, 1) } {
                    let p := add(st_, mul(i, 32))
                    mstore(p, addmod(pow5(mload(p)), mload(add(c_, mul(add(off, i), 32))), Q))
                }
            }
            // initial state [0, inputs] + C[0..7]
            mstore(st, mload(cO))
            for { let i := 1 } lt(i, 8) { i := add(i, 1) } {
                mstore(add(st, mul(i, 32)), addmod(calldataload(add(inp, mul(sub(i, 1), 32))), mload(add(cO, mul(i, 32))), Q))
            }
            for { let r := 0 } lt(r, 3) { r := add(r, 1) } { sboxAdd(st, cO, mul(add(r, 1), 8)) mix(st, tm, mO) }
            sboxAdd(st, cO, 32)
            mix(st, tm, pO)
            for { let r := 0 } lt(r, 64) { r := add(r, 1) } {
                let s0 := addmod(pow5(mload(st)), mload(add(cO, mul(add(40, r), 32))), Q)
                mstore(st, s0)
                let base := add(sO, mul(mul(15, r), 32))
                let acc := 0
                for { let j := 0 } lt(j, 8) { j := add(j, 1) } {
                    acc := addmod(acc, mulmod(mload(add(base, mul(j, 32))), mload(add(st, mul(j, 32))), Q), Q)
                }
                for { let k := 1 } lt(k, 8) { k := add(k, 1) } {
                    let p := add(st, mul(k, 32))
                    mstore(p, addmod(mload(p), mulmod(s0, mload(add(base, mul(add(7, k), 32))), Q), Q))
                }
                mstore(st, acc)
            }
            for { let r := 0 } lt(r, 3) { r := add(r, 1) } { sboxAdd(st, cO, add(104, mul(r, 8))) mix(st, tm, mO) }
            for { let i := 0 } lt(i, 8) { i := add(i, 1) } { let p := add(st, mul(i, 32)) mstore(p, pow5(mload(p))) }
            mix(st, tm, mO)
            out := mload(st)
        }
    }
}
