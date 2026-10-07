# Archive: state before the main circuit switched to layout C (v3) — 2026-10-07
Snapshot commit: main @ d9f5d25 (tag `archive-pre-v3-20261007`). Decision: issue #18 / #4, layout C (6 public inputs, contract-side keccak ctx_hash)
becomes the main circuit `t2_circuit_fix/zkdac_v3`. **Nothing below was moved or deleted**; this file only indexes it.

## Superseded designs and where their evidence lives
| design | status | source | results | key numbers |
|---|---|---|---|---|
| historical RQ108 @ f494963 | baseline (paper era) | ttwang-szu/ZK-HADA, `work/t1_recovery/E0-rq108-rebuild_20261006`, `work/t1/` | t1 RUN_RECORDs, `work/t1/FINDINGS.md` | 46,585 constraints, 4 public |
| historical RQ108 @ HEAD | baseline, has switch-zero false accepts | `work/t1_recovery/E0-rq108-committed-variant_20261006` | `t3_attacks/results/attacks_baseline.json` | 46,593 (paper's C5), 3 false accepts |
| **v2** (5 public: issued, revoked, action_digest, nullifier, now) | superseded by v3 | `t2_circuit_fix/zkdac_v2` | `t2_circuit_fix/zkdac_v2/results/*`, `t3_attacks/results/attacks_v2*.json`, `exhaustive_diff_d4.json`, `t4_contracts/results/*` | D=1..4: 34,900 / 63,685 / 92,470 / 121,255; T3: 0 statement-level false accept; gas D=2 ≈ 661.8k |
| layout A (4 public, now in Poseidon(8) digest) | rejected (most expensive) | `t4_contracts/variants/circuits/zkdac_chain_A.circom` | `t4_contracts/results/e2e_chains.json`, `forge_gas_variants.txt` | 63,775; gas ≈ 700.5k |
| layout B (11 public, no on-chain hash) | rejected | `t4_contracts/variants/circuits/zkdac_chain_B.circom` | same | 63,685; gas ≈ 377.7k |
| layout C (6 public, keccak ctx_hash) | **adopted → v3** | `t4_contracts/variants/circuits/zkdac_chain_C.circom` (D=2) → `t2_circuit_fix/zkdac_v3` | same | 63,121; gas ≈ 343.4k |
Contracts for v2/A/B/C (`ZkDacGate`, `ZkDacGateA/B/C`, `PoseidonOpt`) stay in `t4_contracts/foundry` with their tests (48/48 at d9f5d25).

## Non-reproducible material (GitHub release `archive-pre-v3-20261007`, prerelease, private repo)
zkeys contain random phase-2 contributions and the ptau a random contribution, so they cannot be regenerated bit-for-bit; committed proof fixtures depend on them.
| asset | sha256 | used by |
|---|---|---|
| v2_d2.zkey | 18385459bc77d3b6a6d9a1726bc8a796ae529b370db71f450d34a230ef7be357 | t4_contracts v2 (= `t4_contracts/results/MANIFEST.sha256` zk/d2.zkey) |
| layoutA_d2.zkey | b0b020fdeebe9bbfe095219fa5db14817ab031e10a361f0aedeeb892a044d10c | t4_contracts/variants (= variants/MANIFEST.sha256) |
| layoutB_d2.zkey | d480e3df120ccd03f263c1003ab145a20774dcace0e568daa5c091f42dcaaf20 | t4_contracts/variants |
| layoutC_d2.zkey | c0133895374c36ba006df58d5b5115f54b05ca4ca9ab87bfb828bca9b5ba56d9 | t4_contracts/variants (also valid for v3 D=2: identical circuit body) |
| rq108_f494963_generator.zkey | 7697316d42f8113eb4004d2e83374a677f4fbff239437921826cfd2bef9d8cb7 | t1_recovery/E0-rq108-witness_20261006 |
| dev_pot16.ptau | 81b762633a5ee64a0429dab4613f1e7f0477d4cae43c752d1b35cf34d3327cfb | all of the above (dev-only, 1 contribution — not a trusted setup) |
Deterministic artefacts (r1cs, wasm, sym) are not archived: rebuild from source with circom 2.2.3 and compare against the sha256 in each MANIFEST.

## Restore
`gh release download archive-pre-v3-20261007 --repo Winston-9527/zk-hada-exp -D <dir> && (cd <dir> && shasum -a 256 -c SHA256SUMS)`,
then copy each zkey to the path in the "used by" column.
