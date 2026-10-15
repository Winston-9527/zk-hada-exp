# T8d — run record
- R1 (env 2): `bash run_t3.sh results/env2/t3` in `~/projects/zk-hada-exp-t8d` at 78d6e1d, 2026-10-15 ≈04:36–04:45 UTC. Steps in `results/env2/t3/steps.txt`, all exit 0.
- R3 Mac: `bash run_t5s.sh results/mac/t5s 8561`, 04:33:55–05:01:31 UTC (attempt 1 at 04:33:24 failed, see A1).
- R3 env 2: `bash run_t5s.sh results/env2/t5s 8561`, 05:10:49–05:47:35 UTC; port 8561 checked free before the start.
- Comparison: `python3 compare.py > results/compare.json` (R1 and a raw diff of R3); the judgment-only comparison of R3 was written by inline Python to `results/compare_R3_judgments.json`.
- `results/*/t5s/state/` (anvil state, credentials with secret keys) is not committed.
- **Correction (2026-10-15).** Commit 9a3f1d0 accidentally included `results/mac/t5s/state/{creds,state}.json`, because the ignore pattern `results/*/state/` did not match the deeper path. The next commit removes them and fixes the pattern (`results/**/state/`).
  - Exposure: the keys in `creds.json` are test identities derived deterministically from names and seeds in the public code (`sha256("t5-node-" + name)`, the registration helper's fixed human keys). They are reproducible from the repository and were never secret. History was not rewritten.
