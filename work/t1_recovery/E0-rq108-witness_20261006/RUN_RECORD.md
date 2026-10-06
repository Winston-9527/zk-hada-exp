# Run record: E0-rq108-witness (issue #3)
- Date 2026-10-06. Env: macOS arm64, node 24.14.1, circom 2.2.3, snarkjs 0.7.6; @zk-kit/eddsa-poseidon 1.0.5 (1.1.0 fails on node 24: blakejs ESM interop), baby-jubjub 1.0.3, poseidon-lite 0.3.0.
- Command: `../E0-rq108-rebuild_20261006/rebuild.sh` then `./prove_chain.sh` (inputs from the historical generator `harness_hist.py`, copied from runs/RQ108 with only ROOT/helper paths patched; keys are random per run, not seeded -> **not byte-reproducible**, only structurally).
- Setup: locally generated dev ptau 2^16 (1 contribution), 1 phase-2 contribution. NOT a trusted setup; do not publish.
- Result: generator-variant circuit (46,585): witness OK and Groth16 proof verifies for depth 4 and depth 2 (snarkjs groth16 verify -> OK). Hashes in build/MANIFEST.sha256 (not committed): r1cs a26c62ff..., zkey 7697316d..., vk 02cb78a7..., proof_d4 b1f58b33...
- Not done: prove-time statistics (T5), on-chain gas (T4/E7). Paper's 1.51 s / 235,891 gas / 805 B remain unsourced.
- Failure noted: first attempt failed on dependency drift (eddsa-poseidon 1.1.0) -> pinned 1.0.5.
