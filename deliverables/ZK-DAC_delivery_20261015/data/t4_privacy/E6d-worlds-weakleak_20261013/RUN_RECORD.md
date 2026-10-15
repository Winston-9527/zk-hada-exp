# E6d — run record

## Environment
- Machine: Apple M5 Pro, 15 cores, 48 GB.
- JavaScript: node v24.14.1; snarkjs 0.7.6 (from zkdac_v7).
- Python: 3.11.15 (E6b venv), scikit-learn 1.5.2, numpy 2.1.1, scipy 1.17.1.
- v9.2: `../../t2_circuit_fix/zkdac_v9_2/` (local build; zkeys = release `v9.2-proving-material-20261013`; VKs committed).

## Commits
| commit | what |
|---|---|
| 030d79b | pre-registration |
| 9b13fef | gen.mjs and verify.mjs (smoke: w1 and w6, one round each, 128 / 128 valid; the smoke output is not evidence) |
| 2f2a220, 50056e4 | amendment A1 and analyze_e6d.py, before any analysis of the real transcripts (found on synthetic worlds kept in the scratchpad, not evidence) |
| d625d36 | primary results |
| 15f8eb0 | amendment A2 (post hoc) and the opt-in `E6D_FEATS=a2` |

## Commands (in this directory)
```bash
for w in 1 2 3 4 5 6 7 8; do (node gen.mjs $w 16 > results/world_w$w.jsonl 2> results/gen_w$w.stderr; echo "w$w exit $?" >> results/gen_status.txt) & done; wait
node verify.mjs results/world_w*.jsonl > results/verify.json 2> results/verify.stderr
PY=../E6b-linkability-v9_20261010/.venv/bin/python
$PY analyze_e6d.py deterministic > results/deterministic.json
$PY analyze_e6d.py check > results/feature_check.json
$PY analyze_e6d.py classify 1000 8 > results/classifiers.json 2> results/classifiers.stderr
E6D_FEATS=a2 $PY analyze_e6d.py check_a2 > results/a2/feature_check_a2.json
E6D_FEATS=a2 $PY analyze_e6d.py classify 1000 5 > results/a2/classifiers.json 2> results/a2/classifiers.stderr
```

## Timings (UTC, 2026-10-13)
| step | start | end | file |
|---|---|---|---|
| generation, 8 processes in parallel, all exit 0 | 14:17:21 | 19:17:07 | `results/gen_start.txt`, `gen_status.txt`, `gen_w*.stderr` |
| verify + deterministic + check + classify (primary) | 19:18:35 | 19:33:24, classify exit 0 | `results/analysis_time.txt` |
| A2 check_a2 + classify | 19:35:34 | 20:17:36, exit 0 | `results/a2/time.txt` |

The proof generation uses fresh CSPRNG randomness, as a wallet does. A rerun of `gen.mjs` therefore gives different transcripts for the same worlds; the analysis of the committed transcripts is deterministic, because all seeds are derived with sha256 from fixed tags.
