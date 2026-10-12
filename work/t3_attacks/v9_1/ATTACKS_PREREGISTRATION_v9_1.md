# T3 on v9.1 — mapping, committed BEFORE running
Triggers: audit #53 (off-curve intermediate key) and #57 §1 (14 revocation rows rejected for an unrelated stale witness). Circuit:
`../../t2_circuit_fix/zkdac_v9_1` (v9 + on-curve check of every encrypted key). v9 rows, oracle and classes are those of
`../v9/ATTACKS_PREREGISTRATION_v9.md`; the v9 run (`../v9/results/`) stays as it is.

## Harness changes (attacks_v9_1.mjs, copied from ../v9/attacks_v9.mjs)
1. Imports point to zkdac_v9_1 (wasm, zkey, vk).
2. **Other hops refreshed (#57).** In A12b, A12b′, A12b″, A13 and A13c, the certificate-revocation witnesses of every hop other than the targeted
   one are rebuilt against the new revoked root, so the targeted hop is the only one that can fail. (v9 refreshed only the key slots.)
3. **Where it failed.** Every circuit rejection records the failing template and line from the witness calculator (`circuit_fail`). Expected
   location per row family:
   - A12b (old witness, new root) → IMTPath;
   - A12b′ / A13 / A13c (neighbouring leaf) → IMTNonMember ordering;
   - A12b″ (forged leaf) → IMTPath;
   - A24 → BabyCheck.
4. **Generator rejections counted separately.** Rows whose circuit column is `n/a` (no witness exists) are reported as a separate count, not as
   circuit rejections.
5. **New rows A24: off-curve chain key.** ent[j] for j = 0, 1, 2, 3 (D = 4) is replaced by an off-curve point A with 8·A = q·B8 (point from
   `../../t2_circuit_fix/zkdac_v9_1/scripts/offcurve.py`, seed 1), signed with S = r + h·q, and the chain is re-issued around it.
   - Expected on v9.1: reject at BabyCheck (AGREE_REJECT). The oracle rejects, because circomlibjs verifies the signature only for points on the
     curve.
   - The same four rows are also judged against the v9 circuit as reference rows `A24-v9`. Expected FALSE_ACCEPT, which documents #53; these rows
     are not part of the v9.1 summary.

## Exhaustive single-field diff (exhaustive_diff_v9_1.mjs)
Same mutations as v9. The witness-only field filter now applies only to (circuit reject, oracle accept). A (circuit accept, oracle reject) is
always listed as statement-level.

## Expected
Every v9 row has the same class as in v9 run 3, except the rows of item 2, which keep AGREE_REJECT but at the new location. A24: 4 × AGREE_REJECT.
Any other change is reported as found.
