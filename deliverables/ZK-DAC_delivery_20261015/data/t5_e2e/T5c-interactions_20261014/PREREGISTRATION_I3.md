# T5c — interactions, part I3: depth D × accountability on/off (WP8) — pre-registration

Committed and pushed BEFORE the variant circuit is written. Part I1 is in `PREREGISTRATION.md`.

**This is a security ablation.**
- Without accountability, nothing can be opened, so research design goal R6 is lost.
- The variant exists only to show what accountability **costs**. It is never presented as a faster competitor.

## Variant
- `work/t2_circuit_fix/zkdac_v9_2_noacc/` = v9.2 with the accountability removed and nothing else changed:
  - the inputs `tpk`, `acc_r`, `acc_kx`, `acc_ky`, `acc_c1x..acc_c2y`, `acc_e`, `acc_esign`;
  - the `AccHybridCompressed` component;
  - its include.
- The remaining statement is byte-for-byte v9.2's. This is checked by a diff, which must show only the removed lines.
- **Public inputs:** state_root, now, ctx_hash, act_req_cap, note_root, budget_nf, cm_change, q_spent (8, for every D), instead of D + 16.
- **Setup:** one local phase-2 contribution on the Hermez ptau 2^18, as for every circuit in this project. It is not a trusted setup; it is used for measurement only.
- **Contract:** a gate variant `ZkDacGateV9NoAcc` (test-only, in `work/t4_contracts/foundry/src/variants/`) = ZkDacGateV9 without TPK, ciphertext and the Accountability event, using the variant verifiers. A diff must show only those removals.

## Measurements (cells D = 1..4 × acc ∈ {on = v9.2, off = variant})
1. **Constraints and public inputs** (r1cs info).
2. **Proving time on the Mac M5 Pro** (reference machine, otherwise idle):
   - `prove_bench.mjs 10` for each version, in the order on, off, on, off;
   - fresh instances with seeds 1000..1009, the same seeds for both versions;
   - witness, prove and verify ms.
3. **Verifier gas:** the on-chain `verifyProof` gas of one valid proof per D, for each version.
4. **Execute gas:** a full `execute` on anvil with real verifiers, at a fixed note-tree size. The tree is prefilled with the same 100 notes for both versions; T5 found that gas depends on the note index. Calldata bytes are also reported.
5. **Correctness:** every benchmark proof verifies, and the variant's mutation smoke (the holder_sk = 0 and lineage checks of v9.2) behaves as in v9.2. That shows nothing but accountability was removed.

## Report
- Per D: Δconstraints, Δprove ms (mean of the two runs, with the run-to-run spread), Δverifier gas, Δexecute gas and Δcalldata.
- As a share: (on − off) / on.
- No hypothesis test: this is a cost decomposition.

## Not covered
I2. Accountability with other encodings (per-key ElGamal: v7 mode A), already measured in v7.

Failures are kept. Changes after this commit are amendments, recorded before the affected run.
