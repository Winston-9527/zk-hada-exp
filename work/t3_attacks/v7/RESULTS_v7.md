# T3 on v7 (v6 + R6 accountability, #30) — issues #5 / #30
Date 2026-10-08. Mapping `ATTACKS_PREREGISTRATION_v7.md` committed and pushed (de7a997) before any v7 attack ran. Run:
`node v7/attacks_v7.mjs > v7/results/attacks_v7.json`; `node v7/exhaustive_diff_v7.mjs 4 A|C > v7/results/exhaustive_diff_v7_{A,C}_d4.json`. Oracle: `v7/oracle_v7.mjs`.

## Summary — 178 cases (120 v6 rows on mode C + 58 A19 rows in modes A and C)
AGREE_REJECT 129, AGREE_ACCEPT 24, BAD_WITNESS_ONLY 7, FALSE_ACCEPT 18, COMPLETENESS_GAP 0.
- **v6 rows**: circuit outcome and class identical to v6 on all 120 rows. Before judging a v6 row the harness re-encrypts the accountability ciphertexts
  to the (possibly modified) chain keys under the public TPK, so these rows still test their original property, not R6.
- **FALSE_ACCEPT 18** = the 16 pre-registered POLICY rows of v6 + **A19b in both modes** (see below). No other FALSE_ACCEPT.
- **A19 (R6)**, both modes: a ciphertext that encrypts another key in place of ent[0], ent[1] or ent[4] ("wrong accountability object") rejected; ciphertexts
  to a prover-chosen key with the committee key as public tpk (A19b') rejected; ciphertexts copied from another chain rejected; two ciphertexts swapped
  rejected; every single ciphertext word +1 rejected (34 rows: 20 in A, 14 in C); mode C: ephemeral point off the curve rejected. Accepted as
  pre-registered: ciphertexts reused from an earlier action of the same chain (A19d: links the prover's own actions; the opening is still correct) and
  K = identity in mode C (A19h: privacy loss for the prover only). A19i (gate configured with TPK = identity): circuit accepts and in mode A c2 equals the
  plaintext key — POLICY, the deployment must check TPK. On every accepted row the oracle's opening equals ent[0..D].

## Deviations from the pre-registration (transparent)
1. **A19b was mis-pre-registered as "reject"; it is a POLICY row.** The circuit cannot know which key is the committee's: a proof whose public tpk is the
   prover's own key is a valid statement about that key. The binding is the contract's: ZkDacGateV7 supplies tpk from its immutable storage, so such a
   proof fails there (`V7Test.test_otherAuditorKey_rejected`, real proofs, all four configurations). Same situation as v3's A11a (ctx_hash).
   Reported as FALSE_ACCEPT in the raw data, not reclassified.
2. **A19f was pre-registered as "reject (witness)" on the assumption 2^251 < subgroup order l.** It is the other way round (l ≈ 2^250.6), so
   Num2Bits(251) admits both r and r + l whenever r + l < 2^251. Mode A's instance had a 251-bit r (r + l overflowed: rejected, BAD_WITNESS_ONLY); mode C's
   had a 249-bit r (accepted, AGREE_ACCEPT). r and r + l give the same ciphertext, so the statement is unchanged; comments corrected in
   `accountability.circom` and `lib_v7.mjs` (R1CS byte-identical before and after, all 8 circuits).
3. Harness bug before the first complete run: `lib_v7` stored the plaintext key list in `meta.ents`, overwriting the entity objects (private keys) the v6
   rows use; the run aborted at A02 before producing output. Renamed to `meta.accEnts`; no results were produced by the broken version.

## Oracle sanity
| mode | single-field mutations (D=4) | agree | statement-level disagreements |
|---|---|---|---|
| A | 520 | 75 | `now` only |
| C | 508 | 69 | `now` only |
All other disagreements are witness-only fields (paths, low-leaf witnesses, acc_r, mode-C acc_kx / acc_ky, mode-A placeholder acc_e). Mode A run 1
(`exhaustive_diff_v7_A_d4_run1.json`) listed acc_e as statement level: in mode A it is a private placeholder constrained to 0, not a public input; the
classification list was fixed and the run repeated (same raw counts).
