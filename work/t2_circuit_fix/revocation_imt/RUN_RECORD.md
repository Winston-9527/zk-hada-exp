# Run record: indexed Merkle tree revocation vs circomlib SMT — issue #24
Date 2026-10-07. Env: Apple M5 Pro (15 cores), macOS arm64, node 24.14.1, Python 3.9, circom 2.2.3, snarkjs 0.7.6, circomlib 2.0.5, circomlibjs 0.1.7, poseidon-lite 0.3.0.
Reproduce: `npm ci`; compile `circuits/main_imt_{16,20,24,32}.circom`, `circuits/main_smt_{16,20,24,32}.circom` (`-l node_modules -o build`);
`python3 scripts/make_v3_imt.py` and compile `circuits/main_v3imt_d{1..4}.circom` into `build/v3imt_dN`; then
`node scripts/test_imt.mjs`, `node scripts/smt_depth_rule.mjs`, `node scripts/smt_rule_crosscheck.mjs 3000 600`, `python3 scripts/smt_liveness_sim.py`,
`node scripts/grinding_rate.mjs`, `node scripts/test_v3imt.mjs` (outputs in results/; r1cs hashes in results/MANIFEST.sha256). v3 main circuit untouched.

## Design (circuits/imt.circom)
Leaf = Poseidon(value, next_index, next_value), sorted linked list from sentinel (0,0,0); next_value = 0 marks the maximum.
k not in set ⇔ a leaf `low` in the tree has low.value < k and (k < low.next_value or low.next_value = 0).
Key = low 252 bits of the certificate hash (Num2Bits_strict, so no aliasing; circomlib comparators are sound only below 2^252). Truncation can only make an honest
certificate look revoked (prob ≈ N/2^252), never a revoked one look live. Trust assumption unchanged from SMT: the registry operator builds the tree honestly.

## 1. Constraints (direct compilation; results/constraints_single.csv, constraints_v3_vs_v3imt.csv)
| per-hop revocation check | depth 16 | 20 | 24 | 32 |
|---|---|---|---|---|
| circomlib SMT (v3 today) | 10,802 | 12,938 | 15,074 | 19,346 |
| indexed Merkle tree | 10,465 | 12,545 | 14,625 | 18,785 |
IMT = 2,145 + 520·depth; at equal depth it is slightly cheaper than SMT.
v3 with IMT depth 20 instead of SMT RD 16: D=1..4 = 36,079 / 66,607 / 97,135 / 127,663 (+1,743 per hop, +5.8% at D=4).
**D=2 now exceeds 2^16 (66,607 > 65,536): proving needs a 2^17 ptau.**
Corrections of earlier statements: "SMT16 ≈ 8.5k per hop" omitted SMT's fixed overhead (real: 10,802); "RD→32 ≈ +67k" mixed MD and RD (RD only: +34,176 at D=4,
now confirmed by the per-hop difference 19,346 − 10,802 = 8,544 × 4).

## 2. SMT liveness — calibrated, then simulated
- Calibration against the real RD=16 circuit (smt_depth_rule.json, 33 crafted cases): an exclusion witness exists **iff the descent path length ≤ RD − 1**
  (SMTVerifier needs the last sibling to be 0). So RD=16 handles 15 levels, not 16. Both rules I had stated before were off by one at the boundary.
- Cross-check on random data (smt_rule_crosscheck.json): predicted path length = 1 + (2nd-largest number of low bits shared with a revoked key) matched
  circomlibjs `find()` on 600/600 queries (N = 3,000). In that run already one query needed 16 levels (unprovable at RD=16).
- Simulation (smt_liveness_sim.json; 100,000 random honest keys per cell; stuck ⇔ ≥ 2 revoked keys share ≥ RD−1 low bits), matches 1 − e^−λ(1+λ), λ = N/2^(RD−1):
| revoked N | RD=16 | RD=20 | RD=24 | RD=32 |
|---|---|---|---|---|
| 10³ | 0.03% | 0 | 0 | 0 |
| 10⁴ | **3.8%** | 0.013% | 0 | 0 |
| 10⁵ | **80.7%** | 1.6% | 0.011% | 0 |
| 10⁶ | **100%** | 57.2% | 0.65% | 0 |
  My earlier estimates (1.2·10⁻⁴ at 10³, 45% at 10⁵) used 2^RD instead of 2^(RD−1) and were too optimistic.
- IMT: proof length is always the tree depth, independent of key distribution — no stuck certificates by construction (capacity 2^20 ≈ 10⁶ entries at depth 20).

## 3. Grinding (results/grinding.json)
An issuer who can revoke certificates it signs varies one field (expiry) and recomputes the Poseidon(7) certificate hash. Single-core JS: ~7,000 hashes/s (circomlibjs wasm).
**RD=16 attack executed: two colliding certificates found in 97,506 tries / 14 s.** Expected 2^RD trials: RD=20 ≈ 2.5 min, RD=24 ≈ 40 min, RD=32 ≈ 170 core-hours
single-core JS (≈ 11 h on this 15-core laptop; native/GPU code would be much faster). Raising RD raises the cost but does not remove the attack. IMT: not applicable.

## 4. IMT correctness (imt_correctness.json, v3imt_tests.json; witness level)
- Standalone depth 20, 300 random revoked keys: 205/205 honest non-members provable (incl. below min, above max, neighbours); 11 negatives all rejected
  (member via predecessor leaf / own leaf / forged skip leaf / end leaf, tampered next_value, value ≥ 2^252, wrong root, other gap's leaf, non-boolean bit, key 0).
  The "mod-p representative" negative is vacuous (snarkjs reduces inputs mod p); aliasing is prevented by Num2Bits_strict.
- v3+IMT: valid D=1..4; **A13b scenario resolved**: honest cert sharing 17 / 40 / 200 low bits with 3 revoked keys → circuit and oracle both accept;
  revoking cert 0/1/3: stale witness vs new root rejected, honest re-proof impossible (generator finds no witness), predecessor leaf in the new tree rejected;
  exhaustive single-field mutation D=2: 173 mutations, only `now` accepted (no benign isOld0 fields any more).

## Not done
Proofs/zkeys for v3+IMT (needs ptau 2^17); full T3 re-run on v3+IMT; insertion cost / operator-side benchmarks; on-chain root update is unchanged (operator posts roots).
Adopting IMT into the main circuit is a separate decision (would re-run T2/T3 on v3+IMT).
