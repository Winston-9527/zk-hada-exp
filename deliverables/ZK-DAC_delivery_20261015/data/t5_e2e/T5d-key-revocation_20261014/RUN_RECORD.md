# T5d — run record
- Mac M5 Pro, node v24.14.1, anvil 1.5.1, real Groth16VerifierRevoke and revoke_transition zkey (T4 obligations build).
- Smoke run (Mac, s30-r10, 10 circuit-checked targets): passed, not evidence. Commit 2d47b93.
- Full run: `bash run_mac.sh 3`, 2026-10-14 13:30:52–15:10:20 UTC (`results/run_status.txt`). 11 / 12 exit 0.
- **Attempt 1 of s30-r10-1 failed** (`results/worlds/attempt1_s30-r10-1.*`): E-oracle revoked a duplicate certificate (IMTNonMember L67 in revoke_transition).
  - Fixed by amendment A2 (46ac652).
  - Only that world was rerun: `S=30 R=10 SEED=1 node t5d.mjs`, 15:16–15:30 UTC, exit 0.
- Aggregation: the inline Python in this commit wrote `results/summary.json`; it is reproducible from `results/worlds/*.json`.
