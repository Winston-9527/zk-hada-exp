# Run record: contract tests with real v4 proofs (issues #18, #4)
Date 2026-10-08. Env: Apple M5 Pro, forge 1.5.1 (solc 0.8.28, cancun, optimizer 200), **forge-std v1.17.0 (f3dae6e)**, node 24.14.1, snarkjs 0.7.6.
v4 = layout C + IMT revocation (depth 20); public inputs identical to layout C, so the gate is the existing `ZkDacGateC`.
Proving keys: `../t2_circuit_fix/zkdac_v4/scripts/setup_zkeys.sh` on the dev ptau 2^17 (`../ptau`); hashes in `../t2_circuit_fix/zkdac_v4/zk/MANIFEST.sha256`.
Fixtures: `D=2 node gen_fixtures_v4.mjs`, `D=4 node gen_fixtures_v4.mjs` → `foundry/test/fixtures_V4D{2,4}.json` (one chain, nonces 1–4; proof 3 with prover-chosen
req_cap = 0; proof 4 against a revocation root with one unrelated revoked id). Verifiers: `src/Groth16VerifierV4D{2,4}.sol` (snarkjs export, contract renamed).
Tests: `VariantV4D2`, `VariantV4D4` in `test/Variants.t.sol` inherit every `VariantC` test (valid, replay, req_cap = 0, clock, wrong now, ctx_hash consistency,
amount substitution, A11a ×6) — 14 + 14 pass; whole suite 82/82.
Gas (forge gasleft): identical for D=2 and D=4 and identical to layout C — verifyProof 229,468; execute 319,296 (first) / 256,396 (second).
On-chain cost does not depend on delegation depth or on the revocation structure (only on the public-input layout).
