# T8d — WP13: key results rerun in the second environment: results

- **Pre-registration:** `PREREGISTRATION.md` (f356ca9). Amendment A1 (78d6e1d): t5s path depth.
- **Environments:**
  - first: Apple M5 Pro (Mac);
  - second: RTX6000 (Xeon w7-3445 × 40), worktree `~/projects/zk-hada-exp-t8d`.
- **Commands:** `RUN_RECORD.md`.

## R1 — T3 differential suite, v9.1 and v9.2: identical (`results/compare_R1.json`)
| | rows (env 1 / env 2) | row-field differences* | summary (AGREE_ACCEPT / AGREE_REJECT / BAD_WITNESS_ONLY / FALSE_ACCEPT) | exhaustive diff D = 4 (total / agree / statement-level) |
|---|---|---|---|---|
| v9.1 | 174 / 174 | **0** | 28 / 118 / 7 / 21, equal | 534 / 89 / 3, equal, including every per-field count |
| v9.2 | 174 / 174 | **0** | 28 / 118 / 7 / 21, equal | 534 / 89 / 3, equal |

\* The fields compared per row, in order: id, name, D, circuit verdict, oracle verdict, class, policy_dependent, valid_witness_exists, and the **failure location (template, line)**.

The env-2 runs used unchanged scripts and the env-2 builds. Those builds were shown byte-identical to the Mac builds in T8b (v9.1) and T8c (v9.2).
- **Comparison bug, fixed before the comparison was read:** a first version of `compare.py` keyed rows by id. Ids repeat across D variants, so only 72 distinct ids were compared. It was replaced by an in-order comparison of all 174 rows.

## R2 — forge, full suite
Cited from T8c item C4 (merged in #68): 367 / 367 passed in the second environment, and 75 / 75 in the v9.2 suites.

## R3 — scaled-down T5 on v9.2: equal judgments (`results/compare_R3_judgments.json`)
World: 8 masters, fan-out 4, 182 agents (8 / 14 / 32 / 128 at D = 1..4). The same code, keys and seeds on both machines. All steps exited 0 on both.

| judgment | Mac | env 2 |
|---|---|---|
| world build: agents, transfers, note leaves, issued leaves, final block; tx count per kind | 182, 174, 356, 174, 208 | equal |
| E4a steady: 94 actions, status and revert reason of each | 94 / 94 accepted | equal |
| E4b epoch 1: 182 agents on one snapshot | 182 accepted, 5 blocks (43 / 43 / 44 / 43 / 9 txs) | equal |
| revocation 1 %: 2 edges | pre-built proofs: 2 / 2 descendants and 32 / 32 free rejected (StaleRevokedRoot); rebuilt free 32 / 32 accepted; descendants without a witness 2 / 2 | equal |
| revocation 10 %: 15 more edges (17) | blocked 24; pre-built proofs: 22 / 22 and 32 / 32 rejected; rebuilt 32 / 32 accepted; no witness 22 / 22 | equal |
| witness level, all 182 agents | false accept 0, collateral denial 0 (both rates) | equal |

**`all_judgments_equal`: true.**

**Fields that differ, all expected:**
- timestamps and wall/ms times (hardware; reported only);
- roots that contain fresh randomness (note and change rho, accountability ciphertexts);
- **gas, by at most 84 per transaction (192 per block)**. The pre-registration expected equal gas. The difference comes from calldata pricing: a zero byte costs 4 gas and a non-zero byte 16. Proofs and ciphertexts are fresh random values on every run. Setup transactions differ by at most 60, revocations by at most 60.

**Latency, reported only** (`results/{mac,env2}/t5s/results/`):
- revoke proving: 0.82–0.88 s on the Mac, 0.95–1.03 s on env 2;
- witness-level check of all agents: 39–45 s on the Mac, 68–79 s on env 2.

Env 2 was also running I2 at the time.

## Conclusion (WP13)
Every judgment of the key results reproduces exactly in the second environment:
- the T3 attack and differential suite on v9.1 and v9.2, row by row, including failure locations;
- the forge suites;
- a scaled-down T5 lifecycle with revocation, on v9.2.

Only hardware-dependent quantities and fresh-randomness-dependent values differ.

## Attempts
`results/mac/attempt1_t5s_path/`: the first Mac start failed on module resolution (amendment A1).

## Corrections after audit #81 (2026-10-15; no new experiment)
- **Amendment A1 (78d6e1d, pushed 04:34:51Z) came 56 s after the R3 Mac restart (04:33:55Z) that it governs.** Its content is only the module path.
- **"compare.py was fixed before the comparison was read" cannot be verified from the history.** Only the fixed version was committed (9a3f1d0), together with the results. The committed version is correct: the audit's re-run reproduces `compare.json` byte for byte.
  - The R3 judgment-only comparison was inline Python and not committed, so `compare_R3_judgments.json` is not reproducible from the repository. The audit compared E4a independently (94 / 94 equal).
- **The revocation roots differ** between Mac and env 2 for a different reason than first stated. They differ because the two anvils had different NOW (block time), so certificate expiries, and with them the revoked leaves, differ. "Fresh randomness" was wrong.
- **"30 witnesses per D" was not reachable at D = 1 and D = 2:** 11 and 17 steady actions, limited by the world size (8 and 14 agents). Not stated before.
