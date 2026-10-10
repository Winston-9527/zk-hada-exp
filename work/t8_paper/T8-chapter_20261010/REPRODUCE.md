# Reproducing the ZK-DAC evaluation
Everything was produced on macOS 26.4 / Apple M5 Pro with: node 24.14.1, npm, circom 2.2.3, snarkjs 0.7.6 (installed by `npm ci`), forge / anvil 1.5.1,
Python 3 (stdlib), `gh` (to download the release), git. Optional for single experiments: Go 1.27 (UCAN baseline), Rust 1.98 (zk-creds), uv + OpenSSL 3
(DAC baseline), elan / Lean v4.31.0-rc2 (Lean models).

## Clean build and core checks (criteria C1–C5 of PLAN.md §4)
```bash
git clone https://github.com/Winston-9527/zk-hada-exp && cd zk-hada-exp
R=work/t8_paper/T8-chapter_20261010/repro
$R/00_env.sh        # tool versions -> repro/out/env.txt
$R/10_build.sh      # npm ci (empty cache) + compile v9 D=1..4, budget transfer/mint, registration, revocation; C1 constraints, C2 r1cs/wasm sha256
$R/20_fetch.sh      # Hermez 2^18 ptau (blake2b) + release v9-proving-material-20261010 (sha256)
$R/30_keys.sh       # C3: every zkey verifies against the fresh r1cs + ptau; exported vk == committed vk
$R/40_contracts.sh  # C4: forge-std v1.17.0, full forge suite (fixtures carry real proofs)
$R/50_core.sh       # C5: T3 v9 attack suite + exhaustive diff, E6 cases; compared row by row with the recorded results
```
Outputs land in `repro/out/` (git-ignored). Proving keys come from the release because phase 2 is a single random contribution: rebuilding the keys
gives different (equally valid) keys, so results are reproduced with the released ones. Phase 2 is **not** a trusted setup.

## Full experiments (hours; each directory's RUN_RECORD.md has the exact commands)
| result | directory | measured wall time |
|---|---|---|
| mutations / circuit / receipts (v9) | `work/t2_circuit_fix/zkdac_v9` | see RUN_RECORD |
| attack suite (Q1) | `work/t3_attacks/v9` | see RUN_RECORD |
| budget races (Q2) | `work/t5_e2/E2-budget_20261009` | see RUN_RECORD |
| revocation (Q3) | `work/t4_revocation/E3-revocation_20261009` | see RUN_RECORD |
| threshold opening (Q5) | `work/t4_accountability/E6-threshold-opening_20261009` | see RUN_RECORD |
| contract obligations | `work/t4_obligations/E7-obligations_20261009` | see RUN_RECORD |
| lifecycle + scale (Q6) | `work/t5_e2e/T5-e2e-scale_20261010` (`./run_t5.sh`) | 2 h (02:36–04:35 UTC, steps.txt) |
| baselines | `work/t6_baselines/T6-baselines_20261010` (`./run_t6.sh`) | 20 min (steps.txt) + installs |
| Lean audit / models | `work/t7_proofs/T7-review_20261010`, `work/t7_proofs/T7b-lean-statemachine_20261010` | see RUN_RECORD + mathlib cache |

## Chapter, numbers and figures
```bash
cd work/t8_paper/T8-chapter_20261010
python3 make_numbers.py                 # numbers.tex + CLAIM_LEDGER.md from the result files (fails on a missing source)
uv venv .venv && VIRTUAL_ENV=.venv uv pip install matplotlib==3.9.2 numpy==2.1.1 && .venv/bin/python figures/make_figures.py
latexmk -pdf preview.tex                # standalone preview; party A inputs experiments.tex into paper.tex
```
