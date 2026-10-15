# T3 on v9 (main circuit since #42) — issues #5 / #39 / #41
Mapping `ATTACKS_PREREGISTRATION_v9.md` committed and pushed (6deac6b) before any v9 attack ran.

Runs:
- `node v9/attacks_v9.mjs > v9/results/attacks_v9.json`
- `node v9/exhaustive_diff_v9.mjs 4 > v9/results/exhaustive_diff_v9_d4.json`
- Oracle: `v9/oracle_v9.mjs`.

## Summary — 170 cases (run 3, the reported run)
**AGREE_REJECT 114, AGREE_ACCEPT 28, BAD_WITNESS_ONLY 7, FALSE_ACCEPT 21, COMPLETENESS_GAP 0.**
- **FALSE_ACCEPT 21**:
  - **20 are pre-registered POLICY rows**, each closed by the gate:
    - A10' replay → budget nullifier;
    - A11a × 7 → ctx_hash computed by the gate;
    - A11-req → req_cap supplied by the gate;
    - A12c × 3, A18e, A21c → per-root windows;
    - A17c' → registry window;
    - A14 → clock;
    - A18d → re-registration;
    - A20g → AmountMismatch;
    - A20h → note-root window;
    - A22h → TPK fixed in the gate.

    Closing tests: `../../t4_obligations/E7-obligations_20261009/POLICY_CLOSURE.md` and V9.t.sol.
  - **1 is A11b-w (amount).** Pre-registered as "accept at witness level by design": the full witness, including holder_sk, may prove any context. The
    oracle rejects only because q_spent (100) ≠ the swapped action's amount. The other six A11b-w rows are AGREE_ACCEPT, because the oracle accepts the
    swapped context. **Not reclassified.**

    The property "an attacker without the holder secret cannot retarget a proof" is checked at proof level in A23.
- **No other FALSE_ACCEPT.** Every row expected "reject" was rejected, and every row expected "accept" was accepted.
- **A23 (proof level, real proof).** The proof verifies with its own public signals. It **fails**:
  - for ctx_hash of Y in all 7 action fields;
  - with req_cap = 0;
  - with the state root of other roots;
  - with another budget_nf;
  - with q_spent − 1.
- **Budget rows A20.**
  - Rejected: overspend with field wrap, conservation +1, another holder's note, sibling lineage, note not in the tree, change to another owner, change
    dropping a lineage entry.
  - Another leaf's path: BAD_WITNESS_ONLY (the statement holds; the witness is wrong).
  - q_change = 0: accepted.
- **State root A21.** state_root + 1 and swapped roots (with or without recomputing state_root): rejected.
- **Compressed accountability A22.**
  - Rejected:
    - another key in place of ent[0], ent[1] or ent[4];
    - the parity word encoding −x for ent[4];
    - a ciphertext copied from another chain;
    - y-words swapped;
    - K off the curve;
    - prover-chosen TPK with the committee key as public tpk;
    - every one of the 10 ciphertext words + 1.
  - Accepted, as pre-registered: reuse of an earlier ciphertext of the same chain (A22d), and K = identity (A22g).
  - A22i (TPK = identity configured in the gate): accepted by both sides, POLICY.
- **v7 rows A00–A18**, run with a granted budget (see Harness): same outcomes as on v7.

## Oracle sanity: exhaustive single-field diff (D = 4)
**534 mutations, 89 agree.**
- **Statement-level disagreements: `now`, `act_req_cap`, `ctx_hash` only**, exactly as pre-registered:
  - `now` → the gate's clock;
  - the other two are bound at proof level (A23) and computed by the gate.
- All other disagreements are witness representation: Merkle / IMT / LeanIMT paths and low leaves, note-tree path, encryption randomness.

## Deviations from the pre-registration (transparent)
1. **Run 1 hung: an oracle bug that exposed a defect in the auditor code.**
   - The oracle's x-from-y recovery used circomlibjs' (wasm) `F.sqrt`, which does **not return** on a quadratic non-residue. A mutated ciphertext word
     (acc_e[1] + 1) gave such a y, and both run-1 processes spun for ≈ 14 h before I checked. Stderr is kept as `*_run1_hung.stderr`.
   - **The same call was in the auditor-side `lib_v9.xFromY`**, so a malformed ciphertext could hang the auditor's opening tool. On-chain ciphertexts are
     always well-formed (the circuit constrains them), so the normal flow is not affected — but it is a robustness defect, and is now fixed:
     - oracle: own BigInt Tonelli–Shanks with a Legendre check (also more independent of the generator);
     - `lib_v9.xFromY`: Legendre check before `F.sqrt`.
   - The v9 opening check was re-run after the fix (`../../t2_circuit_fix/zkdac_v9/results/opening_check_run2.json`): identical to before. Single key and
     3-of-5 threshold: 10/10 exact at every D.
2. **Run 2: two COMPLETENESS_GAP rows (A20e), caused by an under-specified oracle rule.**
   - The pre-registered rule said "cm_in is a note of the world, and note_root is a current note root". These are two separate conditions; the oracle did
     not require cm_in to be **in the tree with root note_root**. So a note root of another tree (A20e row 1) was accepted by the oracle while the circuit
     correctly rejected.
   - Fixed: membership is now checked per root (`notesByRoot`).
   - A20e row 2 (another leaf's path, the statement true) should have carried `validWitnessExists`; added.
   - Run 3 changes exactly these two rows (COMPLETENESS_GAP → AGREE_REJECT and → BAD_WITNESS_ONLY); every other class is identical. Run 2 is kept as
     `*_run2_oldoracle.*`; its exhaustive diff gave the same statement-level result.
3. The harness grants every ported v7 row a matching budget note (pre-registered). Rows that kept their v7 `m.nullifier = ...` assignments are unaffected:
   `toV9` deletes the field, and budget_nf is recomputed from the row's holder secret.

## Verdict
**On v9 there is no FALSE_ACCEPT outside the pre-registered POLICY rows and the by-design witness-level row A11b-w; there is no COMPLETENESS_GAP.**
Each POLICY row has a closing gate test, and the proof-level retargeting attempts all fail. This completes the T3 item of #39 and #41.

## Corrections 2026-10-12 (audits #55 / #57 / #59; appended, text above unchanged)
- **POLICY closure (#55).** "Each closed by the gate … POLICY_CLOSURE.md and V9.t.sol" was not true for v9. POLICY_CLOSURE.md covers the v7 gate,
  and V9.t.sol closed 8 of the 20 rows. All 20 are now closed on ZkDacGateV9 by `V9Policy.t.sol`
  (`../../t4_obligations/E7b-v9-policy-closure_20261012/POLICY_CLOSURE_V9.md`, forge 215 / 215). With V9.t.sol's skew of 1e6, A14 is not closed;
  it is closed with skew 60.
- **14 revocation rows were masked (#57).** A12b′ (cert 1, cert 3) and A13 × 12 failed at IMTPath L39 because the other hops' certificate witnesses
  were stale (`refreshKeys` refreshed only the key slots), not at the IMTNonMember check they target. Re-run on v9.1 with the other hops
  refreshed (`../v9_1/`): all rows are still rejected, now at IMTNonMember L67 / L59. Every row has the same class as here.
- **Where the 114 AGREE_REJECT come from (#57):** 95 are rejected by the circuit at witness level, 8 by the generator (no witness exists,
  circuit `n/a`) and 11 at proof level. (v9.1: 99 / 8 / 11 of 118, including the 4 A24 rows.)
- **Off-curve keys (#53) were not covered.** No row built a malformed, off-curve or non-subgroup delegate key. v9.1 adds A24 (ent[0..3]
  off-curve). On v9 these are 4 FALSE_ACCEPT (reference rows); on v9.1 they are 4 AGREE_REJECT at BabyCheck.
- **A22i cannot fail as built:** the oracle world itself uses the identity TPK, so the row is AGREE_ACCEPT. The deployment check is off-chain
  (POLICY_CLOSURE_V9.md, disclosed).
- **Exhaustive diff filter:** the witness-only filter ignored the direction. Fixed in v9.1, so that (circuit accept, oracle reject) is never
  filtered; the result is unchanged (534 / 89 / 3).
- **Counting convention (#59):** FALSE_ACCEPT 21 = 20 POLICY + 1 A11b-w by design. Under v3's convention (any non-POLICY FALSE_ACCEPT counted)
  this is "170 / 1".
- **Order of commits:** the attack list was pre-registered (6deac6b). The attack implementation, the oracle, runs 1–3 and the oracle fix all landed
  in `392199a`. The `notesByRoot` oracle rule was changed after run 2's COMPLETENESS_GAP (already disclosed).
