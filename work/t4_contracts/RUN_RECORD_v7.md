# Run record: v7 gate with R6 accountability — issue #30
Date 2026-10-08. Env as RUN_RECORD_v6.md (Apple M5 Pro; forge 1.5.1, solc 0.8.28, cancun, optimizer 200; node 24.14.1, snarkjs 0.7.6).
Fixtures: `node gen_fixtures_v7.mjs` (needs ../t2_circuit_fix/zkdac_v7 and ../t4_registration builds + zkeys) → foundry/test/fixtures_V7.json: two registered humans
(D = 2 and D = 4 chains; hop 0 depends on D), real action proofs for modes A and C at D = 2 and D = 4; the generator checks that the auditor recovers ent[0..D]
from the public ciphertext words alone. Tests: `cd foundry && forge test --match-contract "V7Test|AccCommitGasTest" -vv`; full suite 125/125.

## Contract
`src/ZkDacGateV7.sol` = ZkDacGateV5's obligations + committee key TPK (immutable) + ciphertext words as extra public inputs (count fixed at deployment; verifier
called through a precomputed selector) + `event Accountability(nullifier, ct)`. Deployment must check TPK is a prime-order-subgroup point ≠ identity
(T3 A19i); not checked on-chain.

## Results (foundry/test/V7.t.sol, real proofs)
11/11: all four configurations execute; the Accountability event carries exactly the proof's ciphertext words; a +1 on the first or last ciphertext word
(each configuration), two swapped words, a wrong ciphertext count, a gate configured with another committee key, and a replay are all rejected.

## Gas (forge gasleft, one configuration per test from the same fresh state; results/forge_gas_v7.txt)
| configuration | public inputs | verifyProof | execute #1 (excl. intrinsic and calldata) |
|---|---|---|---|
| v6 (no R6), D = 2 | 7 | 236,395 | 318,707 |
| A, D = 2 | 21 | 325,016 | 423,929 |
| A, D = 4 | 29 | 378,216 | 482,508 |
| C, D = 2 | 19 | 311,716 | 409,285 |
| C, D = 4 | 23 | 338,316 | 438,574 |
| B (on-chain Poseidon commitment), hashing alone | — | 688,776 (14 words) / 858,110 (20 words) | — |
Each extra public input costs ≈ 6,650 gas in verifyProof (A: D2→D4 +53,200 for 8 inputs; C: +26,600 for 4). Calldata (not counted above): 32 bytes per
ciphertext word (A D = 4: 20 words, C D = 4: 14). Hard-coding TPK in the circuit would save 2 public inputs (≈ 13k gas) at the cost of a new setup per
committee key.
