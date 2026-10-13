# T8b — v9.1 freeze and second-environment reproduction: pre-registration (committed and pushed BEFORE any run in the second environment)

Requested by party A's handoff (2026-10-13, priority 1) and the user (2026-10-13: second environment = `ssh siyuan@RTX6000`, code under `~/projects`;
repository made public the same day). Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP1 (PR #61).

## Object under test (frozen before this file)
- Source: tag `v9.1-freeze-20261013` = commit `3b21b8c` (head of PR #60, not yet merged). Circuits: `work/t2_circuit_fix/zkdac_v9_1/circuits/`.
- Proving material: release `v9.1-proving-material-20261013` (zkeys c1–c4, VKs, Solidity verifiers, `MANIFEST.sha256`; zkey hashes equal
  `work/t2_circuit_fix/zkdac_v9_1/zk/MANIFEST.sha256`). Budget, registration and revocation keys and the v9 keys (reference rows, E7c G7) come from
  release `v9-proving-material-20261010`. Phase 1: Hermez `powersOfTau28_hez_final_18.ptau` (blake2b checked); reg20: dev ptau 2^17 from release v4.
- Phase 2 is one local contribution: the reproduction uses the released keys and does not claim a trusted setup.
- The second environment checks out the branch that carries this file (`v91-second-env-20261013`). That branch adds only new directories (this one,
  `work/t4_contracts/E7c-v91-gate_20261013`, `work/t4_accountability/E6c-opening-v91_20261013`) and new test files; it must not change the frozen
  circuit sources (criterion C0).

## Environments
| | first (reference) | second |
|---|---|---|
| machine | Apple M5 Pro, 15 cores, 48 GiB | host `enine` (ssh alias RTX6000), 40 cores, 251 GiB, shared machine |
| OS / arch | macOS 26.4 / arm64 | Ubuntu 22.04.5 / x86_64, Linux 6.8 |
| node / circom / forge | 24.14.1 / 2.2.3 / 1.5.1 (Homebrew) | 24.14.1 (nodejs.org tarball, SHASUMS256 OK) / 2.2.3 (official `circom-linux-amd64`) / 1.5.1 (official `foundry_v1.5.1_linux_amd64.tar.gz`); hashes in `RUN_RECORD.md` |
| npm dependencies | lockfiles | `npm ci` from the same lockfiles, empty cache |

**What "independent" means here.** Different machine, OS, CPU architecture and toolchain binaries, a fresh clone from the public repository, and an
empty dependency cache. The same agent operates both environments, so this is a *second-environment reproduction*, not a reproduction by an
independent party. The scripts are written so a third party can run them unchanged (`repro/README.md`); party A or the auditor running them is
recommended and would be recorded as a separate attempt.

## Steps and pass criteria
| step | script | criterion | pass |
|---|---|---|---|
| 0 | `00_env.sh` | C0 source identity | `git diff --quiet v9.1-freeze-20261013 HEAD -- work/t2_circuit_fix/zkdac_v9_1/circuits work/t2_circuit_fix/zkdac_v9/circuits work/t2_circuit_fix/zkdac_v7/circuits work/t2_circuit_fix/zkdac_v8/circuits`; tool versions recorded |
| 1 | `10_build.sh` | C1 constraints and public inputs | v9.1 D=1..4: 60,628 / 105,433 / 150,238 / 195,043 constraints, 17 / 18 / 19 / 20 public inputs; v9 D=1..4, budget_transfer, budget_mint, reg20, revoke as in `../T8-chapter_20261010/repro/expected_constraints.txt` |
| 1 | `10_build.sh` | C2 r1cs / wasm sha256 | equal to the first-environment build (`expected_build_v91.sha256`, made on the Mac from the frozen tag before this file was committed). **A C2 mismatch is reported as a finding, not as a failure of the reproduction, if C1, C3 and C4 pass**; the claim "byte-identical build across environments" is made only if C2 passes |
| 2 | `20_fetch.sh` | inputs | ptau blake2b, dev ptau sha256, both releases sha256 OK |
| 3 | `30_keys.sh` | C3 keys | every released zkey (v9.1 c1–c4, v9 c1–c4, budget, reg20, revoke) passes `snarkjs zkey verify` against the r1cs built in this environment and the ptau; the exported VK equals the committed VK |
| 4 | `40_contracts.sh` | C4 contracts | full forge suite, including the new `V91*.t.sol` of E7c: 0 failed |
| 5 | `50_core.sh` | C5 deterministic re-runs | v9.1 smoke (D=1..4 accepted, opening exact); T3 v9.1 attack suite: summary and per-row class equal to `work/t3_attacks/v9_1/results/attacks_v9_1.json`; exhaustive diff v9.1 D=4: total / agree / statement-level disagreements equal; E6 (v7) case rows equal |
| 6 | `60_cross.sh` | C6 cross-environment proofs | (a) 10 proofs per D generated on the Mac (committed, `cross/mac_proofs_d*.json`) verify in the second environment; (b) 10 proofs per D generated in the second environment verify on the Mac (copied back, verified with `cross/verify.mjs`); (c) both directions with the committed VKs |

Reproduction verdict: **PASS** if C0, C1, C3, C4, C5 and C6 pass (C2 reported either way). Any failure is reported with its log; it is not re-run
until it passes silently.

## Attempts
Every attempt keeps its logs in `attempts/<n>/`. A fix to a script is a separate commit whose message starts with "T8b attempt <n>:". Fixes may only touch
the reproduction scripts and the install steps; a change to the frozen sources means the reproduction FAILS for that version.

## Not claimed
No trusted setup; no reproduction of timing (hardware differs; timings are recorded but are not criteria); no reproduction of the multi-hour experiments
(T5, T6, E6b) in this round.
