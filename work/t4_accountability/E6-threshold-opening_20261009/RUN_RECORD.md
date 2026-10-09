# Run record: E6-threshold-opening
- Date / operator(agent): 2026-10-09 / Claude (party B session)
- Issue / PR: #6 (T4), #30 (R6); branch `t4-e6-threshold` (based on `t30-r6-accountability`, f8f231a)
- Source commit (zk-hada-exp): pre-registration 08dbb16; code + results in the commit that adds this file. Historical commit: not used.
- Environment: macOS 26.4, Apple M5 Pro (15 cores), node 24.14.1, snarkjs 0.7.6, circomlibjs 0.1.7, poseidon-lite 0.3.0 (from `../../t2_circuit_fix/zkdac_v7/node_modules`);
  v7 wasm / zkeys / vks from `../../t2_circuit_fix/zkdac_v7` (zkeys: release `v7-proving-material-20261008`, hashes in `zk/MANIFEST.sha256`).
- Command(s) (verbatim, in this directory):
  ```
  node fixtures.mjs C "1 2 3 4" 30 1 results/fixtures_C_e1.json
  node fixtures.mjs C "4" 5 2 results/fixtures_C_e2.json
  node fixtures.mjs A "4" 10 1 results/fixtures_A_e1.json      # the three above: > results/fixtures.log 2>&1
  node cases.mjs  > results/cases.json  2> results/cases.stderr
  node unlink.mjs > results/unlink.json 2> results/unlink.stderr
  node bench.mjs  > results/bench.json  2> results/bench.stderr
  ```
- Inputs + seeds: committee keys `deal({t, n, epoch, seed})` with seed `e6-20261009` (epochs 1, 2; t = 3, n = 5) and `e6-bench-2-3`, `e6-bench-5-9`
  (coefficients = SHA-512(seed | epoch | k) mod l; test keys only). Instance seeds 5000 + 100·epoch + run (fixtures), 7000 + chain (unlink).
  Accountability randomness and DLEQ nonces: CSPRNG (`crypto.randomBytes`), recorded per fixture as `accSeed`; DLEQ nonces not recorded (proofs are re-verifiable).
  U2 bootstrap PRNG seeded from "e6-u2-fresh" / "e6-u2-det".
- Outputs: `results/*` (sha256 in MANIFEST.sha256).
- Results: RESULTS.md. 65/65 case rows as pre-registered; U1 0 linkage with fresh randomness (control: 180 identical actions); U2 AUC 0.482 [0.454, 0.510]
  (control 1.000); mode C opening 141 ms (t = 3) independent of D.
- Failures / anomalies / deviations: RESULTS.md "Deviations". Bench D = 1 proof-verify mean inflated by the first-call warm-up (median 4.61 ms reported).
  Fixture generation writes a temporary witness to os.tmpdir() and deletes it; nothing written into `zkdac_v7/results/`.
- Claims supported / not supported: RESULTS.md "Answer to the stop condition" and "Limits".
