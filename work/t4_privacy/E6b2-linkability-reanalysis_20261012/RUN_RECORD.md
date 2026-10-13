# Run record: E6b2 (2026-10-12, Apple M5 Pro, macOS; Python venv of E6b: scikit-learn 1.5.2, numpy as in ../E6b-linkability-v9_20261010/.venv)
Pre-registration 59c05f5. From this directory:
```
../E6b-linkability-v9_20261010/.venv/bin/python analyze2.py classify 2    > results/smoke_perms2.json 2> results/smoke_perms2.stderr   # smoke, kept
../E6b-linkability-v9_20261010/.venv/bin/python analyze2.py classify 1000 > results/classifiers_a2.json 2> results/classifiers_a2.stderr  # 12:40-16:37
../E6b-linkability-v9_20261010/.venv/bin/python analyze2.py c3            > results/c3_exact.json
```
Seeds: pairs/folds as E6b (seeds 0, 1, 2); permutations `a2-perm-<task>-<seed>-<model>`; bootstrap numpy default_rng(seed). Transcripts read-only from E6b.
