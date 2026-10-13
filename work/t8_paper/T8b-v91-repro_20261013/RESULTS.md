# T8b — v9.1 second-environment reproduction: results

Pre-registration: `PREREGISTRATION.md` (commit de2bc37, pushed before any second-environment run). Commands and toolchain: `RUN_RECORD.md`.
Logs of every attempt: `attempts/1`, `attempts/2`, `attempts/3`.

## Verdict: PASS (attempt 3), with byte-identical builds
Run: 2026-10-13, 06:45–07:30 UTC, on host `enine`:
- Ubuntu 22.04.5, x86_64, Intel Xeon w7-3445 (40 CPUs);
- fresh clone of the public repository at commit `f441c56`;
- empty npm cache.

The first environment was an Apple M5 Pro, macOS, arm64.

| criterion | result | evidence |
|---|---|---|
| C0 source identity | frozen circuit sources (v7, v8, v9, v9.1) identical to tag `v9.1-freeze-20261013` | `attempts/3/C0.txt`, `steps.log` |
| C1 constraints / public inputs | all 12 circuits as expected: v9.1 D=1..4 60,628 / 105,433 / 150,238 / 195,043 with 17 / 18 / 19 / 20 public inputs; v9 D=1..4 60,622 / 105,424 / 150,226 / 195,028; budget_transfer 84,008; budget_mint 1,236; reg20 17,436; revoke 51,815 | `attempts/3/C1.txt` |
| C2 build hashes | **24 / 24 r1cs and wasm files byte-identical to the macOS arm64 build** | `attempts/3/C2.txt` |
| C3 keys | 12 / 12 released zkeys pass `zkey verify` against the r1cs built here (Hermez 2^18; reg20 against the dev ptau 2^17); 12 / 12 exported VKs equal the committed VKs | `attempts/3/C3.txt`, `zkey_verify_*.log` |
| C4 contracts | full forge suite: 28 suites, **288 tests passed, 0 failed**. This includes the E7c v9.1 gate suites on fixtures proved here, and every earlier suite on the committed first-environment fixtures | `attempts/3/C4.txt`, `forge_test.txt` |
| C5 deterministic re-runs | v9.1 smoke D=1..4 accepted and opened; T3 v9.1 summary, agree-reject levels and **every row (id, name, D, class, failure location) equal**; exhaustive diff v9.1 D=4 equal; E6 totals and every row equal | `attempts/3/C5.txt` and the re-run outputs |
| C6 cross-environment proofs | (a) 40 / 40 Mac proofs verify on Linux; (b) 40 / 40 Linux proofs verify on the Mac (copied back) | `attempts/3/C6a.txt`, `attempts/3/C6b_on_mac.txt`, `attempts/3/cross/` |

The verifier contracts in the repository are byte-identical to the ones in release `v9.1-proving-material-20261013` (`steps.log`, "verifier V91CDk = release").

Wall time of attempt 3: 45 min from clone to C6, including E7c. Most of it was spent downloading the releases (16 min, five automatic retries) and on the C5 re-runs (10 min).

## Attempts (all logs kept)
| attempt | commit | stopped at | cause | fix (separate commit) |
|---|---|---|---|---|
| 1 | f6364e0 | `20_fetch`, ptau download | circom.info dropped the TLS connection at 110 MB; the Google mirror returned 403. C0, C1 and C2 had already passed (C2 byte-identical) | 3c668d1: resumable download (`curl -C -`) with retries; blake2b check unchanged |
| 2 | 3c668d1 | `10_build`, first `npm ci` | `ECONNRESET` from the npm registry; the step then exited without a FAIL line | f441c56: npm fetch retries plus per-package retries (lockfiles unchanged); `run_env2.sh` prints a FAIL line on any non-zero step |
| 3 | f441c56 | — | PASS | — |

The fixes touched only download and install steps. No frozen source, lockfile, criterion or comparison changed.

## What this supports
Someone with the public repository and the published releases can rebuild v9.1 on a different OS and CPU architecture and get bit-for-bit the same circuits. They can confirm that the released keys belong to those circuits. They also get the recorded attack-suite, exhaustive-diff and E6 rows exactly, and gate and opening behaviour as pre-registered.

The reproduction does not support the following:
- **A reproduction by an independent party.** The same agent operated both machines. This is recommended next: `repro/README.md` is written for it, and party A or the auditor can run it unchanged.
- **A trusted setup.** Phase 2 is a single contribution by us.
- **Timing claims.** Timings were recorded but are not criteria.
- **Re-runs of the multi-hour experiments** (T5, T6, E6b).
