# T3 re-run on v6 (v5 + holder-key revocation, #28) — issues #5 / #28
Date 2026-10-08. Mapping addendum `ATTACKS_PREREGISTRATION_v6.md` committed and pushed (443bf68) before any v6 attack ran.
Run: `node v6/attacks_v6.mjs > v6/results/attacks_v6.json`; `node v6/exhaustive_diff_v6.mjs 4 > v6/results/exhaustive_diff_v6_d4.json`;
`node v6/ablation_key_vs_cert_revocation.mjs > v6/results/ablation_key_vs_cert.json`. Oracle: `v6/oracle_v6.mjs`.

## Summary (D=4; A02b also D=1..3; A18a D=2..4; A18b D=3) — 120 cases
AGREE_REJECT 82, AGREE_ACCEPT 16, BAD_WITNESS_ONLY 6, FALSE_ACCEPT 16, COMPLETENESS_GAP 0.
- All 16 FALSE_ACCEPT are pre-registered POLICY rows: the 14 of v5 (A10, A11a ×7, A11-req, A12c ×3, A14, A17c') + **A18d** (master key ent[1] revoked
  as a key entry: the circuit does not check ent[1] by design; a master is invalidated by re-registration, A17c) + **A18e** (proof against the
  pre-revocation revoked_root; contract root window, same as A12c). Zero FALSE_ACCEPT outside POLICY rows.
- New A18 rows: revoked terminal key at D = 2, 3, 4 (stale witness rejected; generator finds no witness); **key compromise** (A18b: revoked ent[2] signs a
  fresh certificate to an attacker key, certificate even registered in the delegation tree) rejected, and its control (same chain, key not revoked)
  accepted; every low-leaf trick (predecessor / forged skip / end-of-list) for ent[2], ent[3], ent[4] rejected; position independence (A18i) rejected;
  liveness with 17 / 40 / 200 shared low bits and with 40 unrelated revoked keys accepted; slot swap (A18h) rejected as BAD_WITNESS_ONLY.
- A18g (key inserted under a non-canonical encoding) is accepted by both circuit and oracle: such an entry is not a revocation of the key. Operator
  obligation: insert exactly H("zkrk", Ax, Ay) — documented, not a circuit property.
- v5 rows: circuit outcomes identical to v5's.

## Ablation: key revocation vs certificate revocation (`v6/results/ablation_key_vs_cert.json`, circuit outcomes, D = 3)
Agent key K holds two incoming certificates (from masters M1 and M2 of two humans); K is compromised; the attacker signs a fresh certificate K → attacker
key (registered) and proves. The revoker knows only the M1 certificate.
| circuit | attacker path | revoked | outcome |
|---|---|---|---|
| v5 | via M2 (unknown parent) | none | accept |
| v5 | via M2 (unknown parent) | M1→K (incoming) + K's known outgoing cert, 2 entries | **accept** |
| v5 | via M1 (known parent) | same 2 entries | reject |
| v6 | via M2 | key K, 1 entry | reject |
| v6 | via M1 | key K, 1 entry | reject |
Certificate revocation stops a compromised key only through the incoming certificates the revoker knows; one key entry stops every path. Correction to
my earlier explanation to party B (before this run): I said certificate revocation cannot stop a compromised intermediate key from minting fresh
certificates. That is only true for the parents the revoker does not know; revoking the known incoming certificate does stop it (row 3).

## Harness findings (transparent)
- **Run 1** (`v6/results/attacks_v6_run1.json`): A18b control was a COMPLETENESS_GAP caused by my harness. `extraLeaves` in the v2 generator places
  leaves at index 200000 + 17k, and `issuedExtra` decoys at 100000 + 31k; with MD = 16 both are ≥ 2^16, so these leaves were never in issued_root while the
  oracle counted them as registered. Fixed with a backward-compatible `extraLeafBase` option (default unchanged; default instances byte-identical,
  checked by hash for D = 1..4 and seeds 0, 11, 22); A18b now uses base 40000. All other circuit outcomes identical between run 1 and run 2.
- Consequences for earlier runs: (a) the issued-tree decoys of every v2–v6 instance were never in the tree (the issued tree held only the chain's own
  certificates) — no soundness effect, the membership tests themselves are unaffected; (b) v3/v4 A05 / A05b (splice) put A's certificates into B's tree
  through extraLeaves. Re-checked on v4 with in-range leaves (`v6/recheck_A05_inrange_v4.mjs`, `v6/results/recheck_A05_inrange_v4.json`): still rejected,
  control still accepted — the splice is rejected by the signature / certificate-hash binding, not by the missing leaf. v5/v6 A05 put cert0 into the
  registered-root tree, so they were not affected.

## Oracle sanity (`v6/results/exhaustive_diff_v6_d4.json`)
489 single-field mutations: the only statement-level disagreement is `now` (+1), as in v5. All others are witness-only fields
(m_*, r_*, rt_*, and the new k_* key-revocation witnesses: 129 rows, circuit reject / oracle accept).
