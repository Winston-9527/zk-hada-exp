# H3 pre-study — results and decision memo (issues #11, #16)
Pre-registration: `PREREGISTRATION.md` (commit 0d00fdf, pushed before any run). Raw outputs: `results/`.

## Decision rule (pre-registered) → outcome
| criterion | result | met? |
|---|---|---|
| (a) counterexample shown and closed by notes, no M6 violation | M1–M4 as pre-registered; M6: 986,650 states, 0 violations; the mutant (split drops a lineage entry) is caught with 4,537 violating states | yes |
| (b) cost within the pre-study budget (prove ≤ 10 s, step ≤ 1.5 M gas) | 83,858 constraints, prove 1.20 ± 0.04 s; one on-chain step 559,618 gas | yes |
| (c) differs from ZKM v0.1 in an implemented, measured property | per-hop revocation inherited through split / delegate / key rotation is implemented and tested (C2 rows); ZKM v0.1 has it only as a designed "artifact-v2" direction | yes, at prototype level — see risks |
All three hold, so by the pre-registered rule the pre-study **does not** force the shrunk title. The decision is the user's. Costs and risks of adopting H3
are at the end.

## M. Semantics model (results/model.json; plain JS reference model)
| ID | Workload | S1 per-edge caps (today + #16 option 2) | S2 public ledger | S3 private notes |
|---|---|---|---|---|
| M1 | parent 100, two children certified "≤ 100" | **200 accepted** | 100 | 100 (the parent's note can be delegated only once) |
| M2 | 100 units, 32 agents × 10, one block | **320 accepted** | 10 succeed, 22 rejected | one shared note: 1 success per block (nullifier serialises); 10 pre-split notes: 10 in parallel (10 pre-split transactions) |
| M3 | per-action cap 10, repeated 50 times | **500 accepted** | 100 | 100 |
| M4 | revoke A→B after B split, re-delegated to C, and "rotated" to a fresh key | — | cannot express per-edge revocation without public lineage | split output, rotated note and C all frozen; A's own note usable; conservation holds (frozen 40 counted as unspent) |
| M5 | linkability, 100 spends under one root | 0 | **4,950 / 4,950 pairs linked** (root_id public) | 0 |
| M6 | all interleavings of ≤ 5 ops (split / delegate / spend / revoke / double-spend), budget 4 | — | — | 986,650 states: 0 invariant failures, 0 violations. Mutant "split drops a lineage entry": 4,537 spends from revoked lineages |
- **Counterexample (research design line 107) confirmed.** Per-edge attenuation, even with #16 option 2 (a per-action max_amount), bounds neither the total of
  siblings (M1, M2) nor repetition (M3).
- A public ledger fixes the total but links every action under a root (M5) and has no per-edge revocation (M4).
- Notes fix both, at the price of note serialisation (M2: parallelism needs pre-splitting — the same limitation ZKM's FAQ states).

## C. Minimal note circuit (circuits/note_transfer.circom)
One input note and two output notes, 4 lineage slots, revocation IMT depth 20, LeanIMT note tree depth 20, 7 public inputs.
**83,858 constraints** (45,397 non-linear; domain 2^17).

- **C3 valid (results/cases.json)**: 9 accepting transitions — delegate at depth 1/2/3, split, spend, "rotation" (delegate to one's own fresh key), and after a
  revocation the sibling side (A's own note) still spends. A depth-4 note cannot delegate further: rejected as expected.
- **C2 negatives (all rejected, 23/23 rows as pre-registered)**:
  - conservation +1;
  - 64-bit field wrap (q1 = p − 1);
  - change or split output dropping a lineage entry;
  - out1 to another owner without the delegate edge;
  - delegation omitting the new edge;
  - wrong sk;
  - an input lineage with a hole;
  - after revoking A→B: the grandchild C (via split + delegate) and the rotated key B' cannot spend;
  - C with its stale witness against the new root;
  - every IMT leaf as low leaf for the revoked slot (0/12);
  - a revoked owner key.

  The stale witness against the OLD root is accepted (POLICY: gate window, as in E3).
- **Cost (results/bench.json, forge)**:

  | item | value |
  |---|---|
  | prove (N = 10 fresh transfers, each spend + delegate + change) | 1,200.9 ± 37.5 ms (median 1,190) |
  | witness | 106 ms |
  | verify (snarkjs) | 6 ms |
  | verifyProof (7 public inputs) | 267,159 gas |
  | prototype step: verify + roots + nullifier + 2 on-chain LeanIMT inserts + event (excluding intrinsic and calldata; no business call — V7 receipts measured 49,243 for MockTarget) | 559,618 gas |

  The on-chain note root equals the JS tree root (forge `test_rootMatchesJs`).
- Not built, estimated only: R6 accountability in the note circuit (v7 mode C adds 7,580 + 1,212·(D+1) constraints → ≈ 97.5k, still in 2^17; +16 public words ≈
  +100k verify gas at ≈ 6.6k per input, extrapolated from v7, **not measured**).

## Risks and costs of adopting H3 (for the decision)
1. **Novelty is only in the combination.** ZKM v0.1 already implements notes, nullifiers, conservation and hidden lineage (§4.2–4.6). Per-hop revocation is
   its announced v2 direction. Our defensible claim is "conservation + per-hop revocation that split / delegate / rotation cannot remove + verifiable
   threshold accountability, implemented and measured" — and only while ZKM v2 is unshipped. Re-check ZKM before submission.
2. **It is a redesign, not an add-on.** The main circuit (v7) proves a certificate chain with 32-bit capabilities, expiry and accountability over ent[0..D].
   In a note design, delegation is a note transfer. Capabilities, expiry and the ancestor keys needed for accountability would have to move into the note
   (more fields per lineage slot). That means a v8 main circuit, a note-tree contract, and re-running T2, T3, E3 and E6 on it. My estimate, not measured:
   several working days.
3. **Throughput**: one note version per block (M2). Concurrent agents need pre-split notes. With a strict note root every step invalidates every other
   proof, as with the revocation root in E3.3, so a root acceptance window is needed (not implemented in the prototype).
4. **Missing pieces not covered by the pre-study**: minting the root budget (who may mint, against what), refunds and re-issue, multiple assets, and the
   authority to revoke edges (the #18 transition proof would have to be adapted to edge ids).

## Options for the user (no recommendation is binding)
- **A. H2 + H3 title**: build v8 as a note-based main circuit (items 2–4), with conservation as the headline result next to per-hop revocation.
- **B. Shrunk title** (research design line 71; "Private, Revocable, and Accountable Delegation for AI Agents"). Keep v7. Report this pre-study's
  counterexample as motivation and the note prototype as a measured extension (in the paper or an appendix). #16 options 1 + 2 (not-before + per-action
  max_amount), stating explicitly that per-action caps do not bound totals (M1–M3).
- **C. Middle**: keep v7 for authorization; add notes only as an optional budget layer for value-moving actions (the note carries the edge lineage; the
  certificate chain stays). Less redesign than A, but two proofs per budgeted action.

## Deviations (transparent)
- cases.mjs run 1 crashed after revoking the wrong edge: `nB.lin[1]` is P→A, not A→B, because lineage = [root, P→A, A→B]. That froze A as well and crashed
  the "sibling still spends" row. Fixed to `lin[2]`; the run 1 stderr is kept. No rows of run 1 are reported.
- The forge test `test_nullifierBlocksDoubleSpend_evenWithRootPinned` only checks that the nullifier is recorded. The prototype accepts only the current note
  root, so the replay in `test_gas_and_doubleSpend` is rejected as StaleNoteRoot, not by the nullifier. Nullifier blocking under a root window is untested
  here (it is tested for the v7 gate in #18).
- ctx_hash is an argument of the prototype gate, not computed from the call.

## Correction 2026-10-12 (audit #56)
M6 was pre-registered for all interleavings of ≤ 6 operations; it ran ≤ 5 (`model.mjs:97`). This deviation was not listed. The result (986,650 states,
0 violations; mutant caught) holds for ≤ 5 operations only.
