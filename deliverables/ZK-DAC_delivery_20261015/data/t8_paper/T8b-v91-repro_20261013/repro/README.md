# Reproducing v9.1 (T8b) — for a third party

Everything below runs from a fresh clone of the public repository; no account or login is needed. Linux x86_64 and macOS arm64 have both been used.

## Tools (pin these versions)
| tool | version | where |
|---|---|---|
| node | 24.14.1 | https://nodejs.org/dist/v24.14.1/ (check against `SHASUMS256.txt`) |
| circom | 2.2.3 | https://github.com/iden3/circom/releases/tag/v2.2.3 |
| forge / anvil | 1.5.1 | https://github.com/foundry-rs/foundry/releases/tag/v1.5.1 |
| python3, git, curl, bash | any recent | |

About 6 GB of disk (node_modules, builds, ptau, keys) and 8 GB of RAM are enough.

## Run
```bash
git clone https://github.com/Winston-9527/zk-hada-exp && cd zk-hada-exp
git checkout v91-second-env-20261013          # or the commit named in RESULTS.md
bash work/t8_paper/T8b-v91-repro_20261013/repro/run_env2.sh
```
`run_env2.sh` runs, in order:
1. `00_env` (C0: the frozen circuit sources equal tag `v9.1-freeze-20261013`);
2. `10_build` (C1 constraints, C2 build hashes);
3. `20_fetch` (ptau and releases, all hash-checked);
4. `30_keys` (C3: released keys against your own build);
5. E7c (fixtures generated on your machine, then the gate tests);
6. `40_contracts` (C4: whole forge suite);
7. `50_core` (C5: re-runs compared row by row with the recorded results);
8. `60_cross` (C6: our proofs verify on your machine; yours are written to `repro/out/cross/` — send them back, or verify them yourself on a second machine with `cross/verify.mjs`);
9. E6c (adversarial opening).

Each step prints `ok` or `FAIL` lines and stops at the first failure. The outputs are written to:
- `repro/out/` (T8b);
- `work/t4_contracts/E7c-v91-gate_20261013/results/`;
- `work/t4_accountability/E6c-opening-v91_20261013/results/`.

Pass criteria are in `../PREREGISTRATION.md`. Wall time on a 40-core Linux server: see `../RESULTS.md`.

## What a pass means and does not mean
A pass shows that:
- the frozen sources build to the stated circuits;
- the published keys belong to them;
- the recorded deterministic results come out the same;
- the gate and opening suites behave as pre-registered on your machine.

It does not show a trusted setup (phase 2 is a single local contribution). It is not a security proof.
