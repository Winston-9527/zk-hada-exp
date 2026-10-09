# T3 on v9 (main circuit since #42: v7 C + budget note, no action nullifier, state root, compressed accountability) — mapping, committed BEFORE running
Issues #5 / #39 / #41. Classes: `../ATTACKS_PREREGISTRATION.md` (AGREE_ACCEPT / AGREE_REJECT / FALSE_ACCEPT / COMPLETENESS_GAP / BAD_WITNESS_ONLY).

## Oracle `oracle_v9.mjs` (independent plaintext rules)
- **v6 rules.** Roots current, registered root certificate, delegation registry, revocation of certs and keys, signatures, attenuation, expiry, holder
  secret, ctx_hash = keccak(action executed), req_cap = the verifier's.
  - The v6 nullifier rule is dropped: v9 has no action nullifier. The oracle calls oracle_v6 with the nullifier it would expect, so that rule is neutral.
- **State root.** state_root = Poseidon(issued_root, revoked_root, root_root), using poseidon-lite.
- **Accountability.** tpk = committee key, and the compressed ciphertext opens to ent[0..D].
  - Keystream: poseidon-lite. x recovery: circomlibjs F.sqrt, shared with the generator (disclosed).
- **Budget.**
  - cm_in = Poseidon8(ent[D], q_in, cert[0..D-1] padded, rho_in) is a note of the world, and note_root is a current note root;
  - q_in, q_spent, q_change < 2^64 and q_in = q_spent + q_change;
  - budget_nf = Poseidon(TAG_BNF, holder_sk, cm_in), not already spent;
  - cm_change = Poseidon8(ent[D], q_change, same lineage, rho_change);
  - q_spent = the action's amount.

## Harness
- v7 rows A00–A18 run on v9 D = 4 instances.
- Before judging such a row, the harness:
  - re-derives the (possibly modified) chain's budget note — owner ent[D], lineage = the modified chain's certificate hashes — inserts it into the note
    tree and the oracle world, and rebuilds the budget fields;
  - re-encrypts the compressed ciphertext;
  - recomputes state_root.

  The attacker is thereby GRANTED a matching budget, so each row tests its original property and not the budget. Same approach as v7's re-encryption.

## Rows (D = 4 unless stated)
| ID | Attack | Expected |
|---|---|---|
| A00–A06, A08, A09, A12–A18 | v7 rows unchanged in intent | as in v7 |
| A02 / A06 / A03b | holder-secret rows: budget_nf recomputed with the attacker's secret | reject |
| A07' | budget_nf from the public key / from an unrelated secret / via secret alias s + l / with another domain tag | reject |
| A10' | replay: budget_nf already spent | **POLICY** (circuit accepts; the gate's budget-nullifier set) |
| A11a | public inputs unchanged, verifier executes another action (7 fields) | **POLICY** (the gate computes ctx_hash) |
| A11b-w | witness level: ctx_hash swapped to keccak(Y) with the full witness | **accept at witness level by design** (whoever holds the witness may prove any context). Reported as FALSE_ACCEPT in the raw data if the oracle rejects; NOT reclassified. The property "an attacker without the holder secret cannot retarget a proof" is A23. |
| A11-req | req_cap = 0 chosen by the prover | **POLICY** (the gate supplies req_cap) |
| A20a | overspend: q_spent = q_in + 1 with q_change = p − 1 | reject |
| A20b | conservation broken (+1) | reject |
| A20c | note of another holder (same lineage) | reject |
| A20d | note with a sibling's lineage | reject |
| A20e | note not in the tree / another leaf's index | reject |
| A20f | change to another owner / change dropping a lineage entry | reject |
| A20g | q_spent ≠ the executed action's amount | **POLICY** (gate AmountMismatch) |
| A20h | proof against an older note root | **POLICY** (gate note-root window) |
| A20i | spend everything (q_change = 0) | accept |
| A21a | state_root + 1 | reject |
| A21b | issued and revoked roots swapped (state_root kept / recomputed) | reject |
| A21c | stale roots with a consistent state_root | **POLICY** (gate per-root windows) |
| A22a | y-word of ent[j] replaced by another key's (j = 0, 1, D) | reject |
| A22b | parity word encodes −x for ent[D] (wrong key, same y) | reject |
| A22c | ciphertext copied from another chain | reject |
| A22d | ciphertext reused from an earlier action of the same chain | accept (links the prover's own actions; opening still correct) |
| A22e | y-words of ent[1] and ent[2] swapped | reject |
| A22f | ephemeral K off the curve | reject |
| A22g | K = identity | accept (privacy loss for the prover only) |
| A22h | encrypted to a prover-chosen key with public tpk = that key | **POLICY** (gate fixes TPK; as v7 A19b) |
| A22h' | same, but public tpk = the committee key | reject |
| A22i | gate configured with TPK = identity | **POLICY** (deployment check, E6 O15) |
| A22j | every ciphertext word + 1 (D + 6 = 10 words) | reject |
| A23a | PROOF level: a real proof for action X verified with ctx_hash(Y), 7 fields of Y | verification fails |
| A23b | PROOF level: the same proof with req_cap changed / state_root of other roots / another budget_nf | verification fails |
Pass criterion: zero FALSE_ACCEPT outside POLICY rows and A11b-w; COMPLETENESS_GAP 0; the oracle's opening equals ent[0..D] on every accepted row.
Exhaustive oracle diff (D = 4): statement-level disagreements only on `now` (clock: POLICY), `ctx_hash`, `act_req_cap` (bound at proof level and by the gate).
