# E8 — three application workloads (WP12): results

- **Pre-registration:** `PREREGISTRATION.md` (ae40152). Traces committed in e2022d0 before any run. Amendment A1 (bee141e) after the Mac smoke runs.
- **Runs:** RTX6000, 90 = 3 applications × 30 seeds, all exit 0. `results/summary.json` is written by `summarize.py`.
- **Latency:** dedicated uncontended Mac runs (`results/latency_mac/`).
- **Traces are deterministic and self-generated.** This is not an authoritative benchmark, and no real LLM agent was used (user decision).
- **Boundary.** The authorization layer is real: v9.2 proofs, gate, revocation, registry and budget circuits. The applications are local stand-ins: an HTTP gateway, a test ERC-20 and a simulated procurement. No claim is made about prompt injection.

## Authorization safety: every known over-authorization attempt was blocked (369 / 369)
| application | attempt | n | blocked | blocking layer (reason) |
|---|---|---|---|---|
| A1 | tool without its cap bit (`admin`) | 30 | 30 | circuit (CapSubset) |
| A1 | call beyond budget | 30 | 30 | circuit (Num2Bits: negative change) |
| A1 | tool removed by a permission change, with the new certificate | 30 | 30 | circuit (CapSubset) |
| A1 | call after revocation, with a stale revocation view | 30 | 30 | gate (StaleRevokedRoot) |
| A1 | call after certificate expiry | 30 | 30 | circuit (LeqU64: now ≤ expiry) |
| A2 | `approve` without its cap bit | 30 | 30 | circuit (CapSubset) |
| A2 | payment beyond budget | 30 | 30 | circuit (Num2Bits) |
| A2 | replay of an accepted proof | 30 | 30 | gate (BudgetSpent) |
| A2 | payment after revocation, with a stale view | 30 | 30 | gate (StaleRevokedRoot) |
| A3 | category outside the sub-agent's cap | 30 | 30 | circuit (CapSubset) 27; no note to spend 3 |
| A3 | purchase beyond budget | 30 | 30 | circuit (Num2Bits) 27; no note 3 |
| A3 | spending another sub-agent's note | 30 | 30 | circuit (note membership, ZkDacChainV9 L227) |
| A3 | purchase after revocation, with a stale view | 9 | 9 | gate (StaleRevokedRoot) |

- In A1, the permission-change attack was also tried with the **old, revoked certificate** and its old note, under a stale revocation view. It was blocked at the gate (StaleRevokedRoot) in every run.
- The A1 gateway refused to serve every request id that had no reservation on chain.
- **Coverage gaps** (amendment A1, disclosed):
  - A3 "after revocation" was **untestable in 21 / 30 runs**: by t = 260 the revoked sub-agent's note had no funds left. Revocation blocking is covered by A1 (30 / 30) and A2 (30 / 30).
  - In 3 A3 seeds, the misbehaving sub-agent had been assigned no items and therefore held no note. Its category and budget attacks were refused for lack of a note, not by the circuit.

## A1 — service access (tool gateway; reservation / commit / fail)
- **Calls (legitimate, intended):** 619. Reserved on chain: 619, so no legitimate call was refused.
- **Commit:** 528, **85.3 %** (95 % CI 82.3–88.0 %).
- **Fail:** 53. The gateway failure was injected with p = 0.10.
- **Uncertain:** 38 (6.1 %). The gateway crashed after serving and before commit, injected with p = 0.05. Each such reservation stays open on chain. This is the measured non-atomicity of off-chain effects, made explicit by the reservation semantics.
- **Became unauthorized:** 39 calls planned before a permission change (agent 0 lost `fetch`) were refused at the circuit, as they must be. They are classified apart.
- **Concurrency:** in all 30 runs, two calls on one note in one block gave one acceptance and one BudgetSpent, and the retry on the change note succeeded.
- **Permission change cost:** the budget left on the old certificate is stranded, 15.8 units on average (of 20). The new certificate needs a fresh delegation.

## A2 — sandbox assets (ERC-20 vault, atomic)
- **Payments and approvals:** 510 / 510 settled (95 % CI 99.3–100 %). Token conservation holds in every run: recipients' balances = the vault's `paid` = the accepted amounts. Spend ≤ budget for every agent.
- **Atomicity (30 / 30 runs).** In the underfunded payment, the vault's transfer reverted, and the whole execute rolled back:
  - the budget nullifier stayed unspent (30 / 30);
  - no token moved (30 / 30);
  - after the treasury topped up the vault, the retry with the same note succeeded (30 / 30).

## A3 — multi-agent orchestration (bounded procurement)
- **Task success** (all 24 items, spend ≤ B, allowed categories only): **25 / 30** (83 %, 95 % CI 65–94 %).
- Spend ≤ B in every run. Transient target errors: 59, all retried successfully. No purchase stuck for another reason.
- **All 5 failures** had 1–5 items that could not be reassigned (12 in total; 19–23 of 24 items bought).
  - The cause is **stranded budget**: what was delegated to the offline or revoked sub-agent cannot be reclaimed. Notes belong to their holder, and there is no claw-back.
  - Stranded budget averaged 12.2 units over all runs, and 6–40 units in the failed runs. P's 25 % slack (33.2 units on average) was not enough when two sub-agents failed.
- **Design consequence:** bounded tasks must provision slack for the failure of sub-agents that hold budget, or delegate in smaller increments. This is a property of non-custodial budget notes, not an authorization failure.

## Latency, nine E4 stages (Mac M5 Pro, uncontended, seed 0; median ms)
| stage | A1 (D = 2) | A2 (D = 2) | A3 (D = 3) |
|---|---|---|---|
| S1 credential issuance (key + certificate + signature + instance) | — | ≈ 300 per credential | — |
| S2 revocation-path fetch | 0.3 | 0.3 | 0.4 |
| S3 witness assembly | 23 | 23 | 23 |
| S4 witness calculation | 167 | 165 | 208 |
| S5 proving | **1,403** | **1,418** | **2,325** |
| S6 off-chain verification | 5 | 5 | 5 |
| S7 submission | 11 | 11 | 11 |
| S8 inclusion (anvil, not a real chain's finality) | 8 | 8 | 8 |
| S9 action execution (read back) | 2 | 2 | — |

- Proving dominates (88 % at D = 2, 91 % at D = 3 of the local path S2–S6), as in T5.
- S8 is local anvil inclusion: a real chain adds its block time and finality rule.
- **Gaps:** S1 was recorded only in A2's output, and S9 is missing in A3's harness. Both are disclosed, not reconstructed.

## What this means for the paper (research design E8)
1. Across three workloads and 30 seeds each, the authorization layer blocked every one of the 369 known over-authorization attempts. The blocking happened at the circuit for cap, budget and expiry, and at the gate for replay and revocation beyond Δ.
2. Off-chain effects are not atomic with the on-chain spend. With reservation, commit and fail, 6.1 % of the calls ended uncertain under the injected crash rate, and they stay visible on chain.
3. On-chain effects are atomic: proof, spend and transfer commit or roll back together.
4. Non-custodial budgets strand on failed sub-agents. That limits the task success of bounded orchestration (83 %) unless slack is provisioned.
