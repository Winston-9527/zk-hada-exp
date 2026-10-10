# Run record: E6b-linkability-v9
Date 2026-10-10/11. Apple M5 Pro; node 24.14.1, snarkjs 0.7.6 (v9 c4 zkey = release v9-proving-material-20261010); Python 3.11 venv
(scikit-learn 1.5.2, numpy 2.1.1; `.venv` git-ignored). T5 world state: ../../t5_e2e/T5-e2e-scale_20261010/state/ (git-ignored; sha256 in T5 MANIFEST).
Commands: `node gen.mjs fresh > results/transcripts_fresh.jsonl`; `node gen.mjs p1 > results/transcripts_p1.jsonl` (≈ 3 s per transcript);
`node verify_and_tag.mjs > results/verify.json` (also writes transcripts_p2.jsonl); `.venv/bin/python analyze.py deterministic > results/deterministic.json`;
`.venv/bin/python analyze.py classify 100 > results/classifiers.json` (24 min). Seeds: e6b-parents, e6b-round-<variant>-<r>, pairs-<task>-<seed>,
fold-<seed>, perm-<seed>-<model>; encryption / nonce / rho use the CSPRNG (as a wallet), except P1 (per-agent accSeed).
