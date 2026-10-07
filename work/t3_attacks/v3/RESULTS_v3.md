# T3 re-run on v3 (layout C) — issue #5
Date 2026-10-07. Same env as ../RESULTS.md plus @noble/hashes 1.8.0 (oracle's independent keccak).
Order: mapping addendum `ATTACKS_PREREGISTRATION_v3.md` committed and pushed (5cac4e7) before any v3 attack ran.
Run: `node v3/check_ctx_encoding.mjs` (oracle ABI encoder vs ethers: 4/4 match incl. empty and 33-byte params);
`node v3/attacks_v3.mjs > v3/results/attacks_v3.json`; `node v3/exhaustive_diff_v3.mjs 4 > v3/results/exhaustive_diff_v3_d4.json`.
v2 results are kept unchanged in ../results (index: ../../ARCHIVE_pre_v3.md).

## Summary (D=4; A02b also D=1..3) — 62 cases
AGREE_REJECT 38, AGREE_ACCEPT 6, BAD_WITNESS_ONLY 4, FALSE_ACCEPT 13, COMPLETENESS_GAP 1.
- Statement-level attacks rejected as in v2: A02–A09, A11b (attacker swaps ctx_hash to keccak(Y) without the holder secret), A12a/b, A13, A15, A16.
- FALSE_ACCEPT pre-registered as POLICY (6): A10 replay, A11-req prover-chosen req_cap=0, A12c stale revoked_root ×3, A14 now=0. All closed at the contract in #18. (Corrected 2026-10-07: first version said 5; 6 + 7 A11a = 13.)
- **FALSE_ACCEPT NOT pre-registered as POLICY (7): A11a** — the public inputs stay those of action X while the verifier executes action Y
  (one of chain id / verifier address / method / target / params / amount / nonce changed). The circuit cannot see which action is executed in layout C; binding
  ctx_hash to the executed action is by construction the contract's job (it computes ctx_hash itself). The addendum classified A11a as a plain "reject" — that
  classification was wrong, and these rows stay FALSE_ACCEPT in attacks_v3.json. They are closed at the contract with real layout-C proofs:
  `t4_contracts/foundry/test/Variants.t.sol` VariantC `test_A11a_otherChainId / otherVerifierAddress / otherMethodSameCap / otherTarget / otherParams / otherNonce`
  and `test_amountSubstitutionRejected` (7/7 revert InvalidProof).
  Note: v2 had the same dependency (the contract recomputes the digest), but the v2 oracle did not model the executed action, so v2's A11 only tested the weaker
  "fields changed without updating the digest" case.
- COMPLETENESS_GAP (A13b) unchanged: RD=16, honest exclusion proof needs 19 siblings. Open.

## Oracle sanity (results/exhaustive_diff_v3_d4.json)
241 single-field mutations: statement-level disagreements only on `now` (+1: circuit accepts; oracle with a trusted clock rejects). New fields ctx_hash and
act_req_cap: oracle and circuit agree (both reject). All other disagreements are witness-only fields (m_sib/m_bit/r_*), by design.

## Claims
- "Circuit + contract" jointly enforce: no false accept remains once the contract checks roots, clock, nullifier set, computes ctx_hash and sets req_cap (#18).
- The circuit alone does NOT bind the executed action in layout C; any paper text must state that the authorization statement is
  "proof + contract-computed ctx_hash", not "proof alone".
