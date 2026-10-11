# H3 pre-study: conserved delegated authority under per-hop revocation — pre-registration (committed BEFORE any run)
Issues #11, #16. Branch `h3-prestudy` from main cd18d8e. **Time-boxed**: this pre-study only decides whether H3 goes into the title (research design
§3, line 69: "if the conservation state machine is too costly in pre-study, or cannot be distinguished from the closest work, shrink the title").
Research design anchors: P3/C3 (lines 105–123), Q2 (line 151), E2 (line 231: 100 units, 32 agents × 10), stop condition line 322.

## N. Near-neighbour status (checked 2026-10-09, before any run)
ZKM v0.1.0-draft (zkm.dev/spec, dated 2026-08-04; zkm.dev/faq):
- private mandate notes, nullifiers and in-circuit conservation: **implemented**;
- hidden lineage: implemented;
- revocation is principal-only and subtree-total; per-hop revocation handles are a **designed but unbuilt** "artifact-v2" direction;
- no auditor opening (holder-assembled voluntary disclosure only).
Consequence fixed now: conservation alone is **not** a contribution. H3 can only be claimed as the JOINT construction: conservation + per-hop revocation
inheritance that split / delegate / key rotation cannot remove + verifiable accountability, measured.

## M. Semantics model and counterexample (model.mjs; plain JS state machine, no circuits)
Three semantics on the same workloads:
- **S1 per-edge caps**: today's attenuation plus #16 option 2, i.e. a per-action `amount ≤ max_amount` on every certificate. No state.
- **S2 public atomic ledger**: the contract keeps `remaining[root_id]` and decrements it on every spend.
- **S3 private notes**: UTXO notes with conservation `q_in = q_spent + q_out1 + q_out2`, a nullifier per note, and a lineage carried by every note
  (`lineage_out ⊇ lineage_in`); a spend requires that no lineage edge is revoked.

| ID | Workload | Expected |
|---|---|---|
| M1 | sibling amplification: parent budget 100, two children each certified "≤ 100" | S1 accepts 200 (overspend 100); S2, S3 accept ≤ 100 |
| M2 | E2 core: 100 units, 32 agents each try 10, concurrently (one block, random order) | S1 accepts 320; S2 exactly 100 (10 succeed, 22 rejected); S3 with ONE shared note: 1 success per note version (serialised); S3 with 10 pre-split notes of 10: 10 succeed in parallel |
| M3 | repetition: one agent with a per-action cap of 10 repeats 50 actions | S1 accepts 500 (no cumulative bound); S2, S3 accept 100 |
| M4 | revocation laundering: B splits / re-delegates / "rotates" to a fresh key after receiving funds, then edge A→B is revoked | S3: every note descended from A→B is frozen, including split and rotated outputs; S2: the per-root counter cannot express it (no per-edge state) unless lineage is public |
| M5 | privacy cost of S2 | every spend reveals root_id, so all actions under one root are linkable (count measured) |
| M6 | small-model exhaustive check of S3 | all interleavings of ≤ 6 operations (split, delegate, spend, revoke, double-spend attempt) on budget 4: invariant `minted = spent + Σ unspent balances` (frozen notes count as unspent), no spend from a revoked lineage, no double spend. Expected: no violation. Plus a mutant that lets an output drop a lineage entry: must produce a revoked-lineage spend (shows the check detects the hole) |

## C. Minimal note circuit cost (circuits/note_transfer.circom)
One input note, two output notes. Note = Poseidon(owner Ax, Ay, q, lineage[4], rho). The circuit proves:
- membership of the input note in a LeanIMT note tree (depth 20);
- owner knowledge (sk·Base8 = owner, sk < l); nullifier = Poseidon(TAG, sk, cm_in);
- 64-bit ranges and `q_in = q_spent + q1 + q2`;
- non-revocation of every active lineage edge and of the owner key (IMT, the same revocation tree as v7);
- out2 (change) has the same owner and lineage; out1 is either the same owner (split) or a child with lineage + new edge = Poseidon(TAG_EDGE, parent,
  child, rho1) (delegate);
- binding to ctx_hash.
Public inputs: note_root, revoked_root, nullifier, cm_out1, cm_out2, q_spent, ctx_hash.

| ID | Measurement / case | Expected |
|---|---|---|
| C1 | constraints, prove time (N = 10 fresh), verify gas, plus one on-chain gate step (verify + nullifier + 2 LeanIMT inserts) | report; pre-study budget: prove ≤ 10 s, step gas ≤ 1.5 M; exceeding it → report, do not tune |
| C2 | witness negatives: q1 + q2 + q_spent ≠ q_in; 64-bit wrap (q1 = p − 1); out2 lineage drops an entry; out1 to another owner without the delegate edge; spend with a revoked lineage edge or revoked owner key; wrong sk | all unsatisfiable |
| C3 | valid split, delegate, spend at depths 1–4 | satisfiable |
Not in this pre-study: minting / root-budget issuance, refund, multi-asset, revocation authority for edges (would reuse #18), accountability ciphertexts
in the note circuit (would reuse E6; cost added analytically from v7 mode C: +1 ElGamal KEM + keystream).

## Decision rule (stated before results)
Recommend the H2 + H3 title only if:
(a) M1–M4 show the counterexample and S3 closes it with no M6 violation;
(b) C1 stays within budget;
(c) the joint construction differs from ZKM v0.1 in an implemented, measured property (per-hop revocation inherited through split / delegate / rotation).
Otherwise recommend the shrunk title (research design line 71) and #16 options 1+2 (not 3). The decision is the user's.
