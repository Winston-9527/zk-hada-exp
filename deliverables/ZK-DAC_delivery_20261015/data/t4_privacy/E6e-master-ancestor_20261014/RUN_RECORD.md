# E6e — run record

## Environment
- Machine: Apple M5 Pro, 48 GB.
- JavaScript: node v24.14.1; snarkjs 0.7.6.
- Python: 3.11.15 (E6b venv), scikit-learn 1.5.2, numpy 2.1.1.
- v9.2: local build; zkeys = release `v9.2-proving-material-20261013`.

## Commits
| commit | what |
|---|---|
| 8a8ea87 | pre-registration |
| 112ec33 | generator (witness / prove / assemble) and verifier; smoke (1 round of witnesses, 2 proofs valid) discarded |
| 40598e9 | amendment A1 and `analyze_e6e.py` (developed on synthetic worlds in the scratchpad; not evidence) |

## Commands (in this directory)
```bash
node witness.mjs 8 2> results/gen_witness.stderr
for s in 0 1 2 3 4 5 6 7; do node prove.mjs $s 8 > build/proofs_$s.jsonl 2> results/gen_prove_$s.stderr & done; wait
node assemble.mjs
node verify.mjs results/world_M.jsonl > results/verify.json
PY=../E6b-linkability-v9_20261010/.venv/bin/python
$PY analyze_e6e.py d3 > results/d3_dictionary.json
$PY analyze_e6e.py m2 5000 > results/m2.json
$PY analyze_e6e.py m3 5000 > results/m3.json
$PY analyze_e6e.py m1 5000 6 > results/m1.json
```
`build/` holds the witnesses (secret keys) and the raw proofs. It is not committed. `results/world_M.jsonl` contains every proof and public signal.

## Timeline (UTC, 2026-10-14)
| step | time | file |
|---|---|---|
| witnesses | 06:37–06:45 | `results/gen_witness.stderr` |
| proofs, 8 shards, all exit 0 | 06:45–08:50 | `results/gen_prove_*.stderr`, `gen_status.txt` |
| **attempt 1:** assemble, verify and analyses | 08:50, failed | `results/attempt1_scripts_missing/` |
| **attempt 2:** assemble and verify (4,096 / 4,096) | 08:51 | `results/verify.json` |
| analyses (D3, M2, M3, M1) | 08:51–09:02, all exit 0 | `results/analysis_time.txt` |

## Attempt 1 (failure kept)
- At about 08:10, a new branch (`e2b-multisender`, WP7) was created in the same clone while the proving ran. The committed E6e scripts (`assemble.mjs`, `verify.mjs`, `analyze_e6e.py`, and the generators) were removed from the working tree.
- The proving processes had already loaded their code and completed: 4,096 proofs in `build/`.
- The chained steps then failed with "module not found" / "can't open file". The analyses exited 2 and read no data.
- **Fix:** the clone was switched back to `e6e-master-ancestor`, which restored the scripts byte-identical to 40598e9. WP7 moved to a separate worktree. Assemble, verify and the analyses were rerun unchanged.
