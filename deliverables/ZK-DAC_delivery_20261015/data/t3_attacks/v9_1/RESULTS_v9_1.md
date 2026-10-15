# T3 on v9.1 — results (audits #53 / #57)
Mapping `ATTACKS_PREREGISTRATION_v9_1.md` committed and pushed (8b82adf) before any run. Circuit `../../t2_circuit_fix/zkdac_v9_1`.
Runs (from `work/t3_attacks`):
- `node v9_1/attacks_v9_1.mjs > v9_1/results/attacks_v9_1.json` (1 min 15 s);
- `node v9_1/exhaustive_diff_v9_1.mjs 4 > v9_1/results/exhaustive_diff_v9_1_d4.json` (2 min 5 s).

## Summary — 174 rows
**AGREE_REJECT 118, AGREE_ACCEPT 28, BAD_WITNESS_ONLY 7, FALSE_ACCEPT 21, COMPLETENESS_GAP 0.**
- **The 170 v9 rows keep their class row by row** (0 differences against `../v9/results/attacks_v9.json`). FALSE_ACCEPT 21 = 20 POLICY rows (closed on
  ZkDacGateV9 by `V9Policy.t.sol`, `../../t4_obligations/E7b-v9-policy-closure_20261012/`) + A11b-w by design.
- **A24, off-curve chain key ent[0..3]: 4 / 4 AGREE_REJECT, all at BabyCheck L82.** The same 4 rows judged on the v9 circuit (reference rows
  `A24-v9`, not counted above) are **4 FALSE_ACCEPT**, which reproduces #53.
- **Where the 118 rejections happen:**
  - 99 by the circuit at witness level (every one with its failing template and line in `circuit_fail`);
  - 8 by the generator (no witness exists);
  - 11 at proof level.

## Revocation rows with the other hops refreshed (#57)
| rows | v9 (as run) | v9.1 (other hops refreshed) |
|---|---|---|
| A12b × 3 (old witness, new root) | rejected | rejected at IMTPath L39 (expected: the root changed) |
| A12b′ × 3 (predecessor leaf) | cert 1 and cert 3 at IMTPath L39 (masked) | **IMTNonMember L67** (ordering) |
| A12b″ × 3 (forged leaf) | IMTPath L39 | IMTPath L39 (expected: the leaf is not in the tree) |
| A13 × 9 (keys sharing 17 / 40 / 200 low bits: predecessor, successor, two below) | IMTPath L39 (masked) | **IMTNonMember L67 × 6, L59 × 3** |
| A13c × 3 (end-of-list leaf) | IMTPath L39 (masked) | **IMTNonMember L59** |

So the revocation check itself, including keys that share many low bits (the historical SMT failure mode), rejects at hop ≥ 1.

## Exhaustive single-field diff (D = 4)
534 mutations, 89 agree; the disagreement counts by field are identical to v9. Statement-level disagreements: now, act_req_cap, ctx_hash (circuit
accept, oracle reject; POLICY, set by the gate). With the direction-aware filter nothing else appears.

## Deviations
None from the mapping. The oracle is v9's `../v9/oracle_v9.mjs`, unchanged; its independence limits (it shares circomlibjs and the generator's world
metadata) are as in v9.
