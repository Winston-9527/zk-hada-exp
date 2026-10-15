# E6 threshold accountability opening — results (issues #6, #30)
Pre-registration: `PREREGISTRATION.md` (commit 08dbb16, pushed before any run). Raw outputs: `results/`. Run details: `RUN_RECORD.md`.

## Answer to the stop condition (research design line 323)
The opening **does not reconstruct the committee secret**. Each member releases D_i = s_i·c1 with a Chaum–Pedersen DLEQ proof; the combiner
interpolates in the group (Σ λ_i D_i = tsk·c1) and its code path never receives s_i or tsk (O16). So distributed, verifiable partial decryption is
demonstrated — under a **trusted dealer** (no DKG) and **static corruption of fewer than t members**. The paper may claim verifiable threshold opening with
identifiable cheaters under these assumptions; it may not claim a dealerless setup or anything against ≥ t colluding members.

## Correctness and attacks (results/cases.json; 65 rows, 0 differ from pre-registration)
Committee t = 3, n = 5. Fixtures: real v7 proofs (fresh instance and CSPRNG randomness per action), mode C D = 1..4 and mode A D = 4.
| ID | Case | Result |
|---|---|---|
| O1 | every 3-subset of 5, 3 actions per D | mode C D=1..4: 30/30 exact each; mode A D=4: 30/30 |
| O2 | every 4- and 5-subset | 18/18 exact per D and mode |
| O3 | every 2-subset | 30/30 INSUFFICIENT per D and mode |
| O3 control | forced Lagrange on 2 shares | 30/30 wrong in every case. Mode C: 0 of 420 recovered points on the curve. **Mode A: 150/150 wrong points ARE valid subgroup points** (see finding 1) |
| O4, O5 | duplicate share / duplicate index with a different D_i | rejected (DUPLICATE_INDEX) → INSUFFICIENT |
| O6 | D_i + Base8; random point; s'·c1 with a valid DLEQ proof for Y' = s'·Base8 | all rejected (DLEQ_FAIL against the published Y_i) |
| O7 | proof z+1; A1 replaced; A1/A2 swapped | all rejected (DLEQ_FAIL) |
| O8, O9 | share replayed from another action; ev relabelled; same c1 and D_i under another event id | rejected (EVENT_MISMATCH / DLEQ_FAIL: the challenge binds ev) |
| O10, O11 | epoch-1 members / shares for an epoch-2 action; mixed epochs | member refuses; combiner rejects EPOCH_MISMATCH → INSUFFICIENT. Control: a combiner that takes the epoch from the shares' claim (not from the TPK bound in the proof) outputs wrong points |
| O12 | 5 shares, member 1 forged (valid DLEQ for its own fake key) and member 4 tampered | opens exactly with members 2, 3, 5; members 1 and 4 identified |
| O13 | ciphertext word changed or c1 taken from another action, original proof | Groth16 verification fails → members refuse. Control without the proof check: wrong points (or member refuses an off-curve c1) |
| O14 | c1 = identity, order 2, order 8, off-curve, c1 + order-8 point | member refuses (no share released; blocks small-subgroup key leakage) |
| O15 | TPK deployment check (T3 A19i) | only the honest TPK (= Feldman A_0) accepted; identity, small-order, outside-subgroup, off-curve, and other valid points rejected |
| O16 | no reconstruction | combine() source has no reference to member secrets or _tsk; shares carry only {i, epoch, ev, parts:[{D, pf}]} |
| O17 | Feldman | honest shares 10/10 pass; a corrupted share (s_2 + 1) fails (complaint) |

## Unlinkability (results/unlink.json; mode C, D = 4; empirical, not a proof)
| | fresh CSPRNG randomness | negative control: generator's deterministic accSeed |
|---|---|---|
| actions (20 chains × 10) | 200 | 200 |
| equal ciphertext word across two actions | 0 | 2,520 |
| equal within-action difference e[j]−e[k] across actions | 0 | 8,100 |
| identical actions | 0 | 180 |
| U2 AUC same-chain vs different-chain (low-64-bit Hamming feature) | 0.482, 95 % CI [0.454, 0.510] | 1.000 [1.000, 1.000] |
The tests detect linkage when it is present (control) and find none with fresh randomness. This is evidence against gross linkage for these features only;
privacy of the ciphertexts rests on ElGamal-KEM (DDH) + Poseidon-as-PRF, which are assumptions, not results of this experiment.

## Cost (results/bench.json; Apple M5 Pro, node 24.14.1, single-threaded JS; ms, mean ± SD, p95; N = 30 actions per cell, mode A N = 10)
| cell | action proof verify | one member share (partial dec + DLEQ) | DLEQ verify per ciphertext | combine (verify t shares + interpolate + decrypt) |
|---|---|---|---|---|
| C, D=1, (3,5) | 4.61 median (mean 7.46 ± 15.4: first-call warm-up) | 25.7 ± 0.3 | 38.4 ± 0.3 | 141.3 ± 2.0 (p95 145.8) |
| C, D=2, (3,5) | 4.45 ± 0.14 | 25.7 ± 0.7 | 38.5 ± 0.4 | 141.2 ± 1.4 (p95 142.7) |
| C, D=3, (3,5) | 4.57 ± 0.18 | 26.1 ± 1.3 | 39.3 ± 1.8 | 143.2 ± 3.7 (p95 151.6) |
| C, D=4, (3,5) | 4.46 ± 0.10 | 25.6 ± 0.6 | 38.4 ± 0.4 | 141.4 ± 1.3 (p95 143.5) |
| A, D=4, (3,5) | 4.52 ± 0.19 | 128.4 ± 1.2 | 38.5 ± 0.6 | 708.6 ± 11.5 (p95 739.2) |
| C, D=4, (2,3) | — | 25.6 ± 0.3 | 38.4 ± 0.5 | 96.6 ± 0.7 (p95 98.2) |
| C, D=4, (5,9) | — | 25.7 ± 1.1 | 38.5 ± 0.6 | 239.4 ± 4.9 (p95 251.3) |
- Mode C opening cost is independent of D (one encapsulated point per action) and grows linearly in t (≈ 48 ms per share, dominated by DLEQ verification).
  Mode A needs one share per key (D + 1): 5× the work at D = 4.
- Transcript (P2): 133 B per share per ciphertext (index, epoch, D_i, A1, A2, z with compressed points): mode C t = 3: 399 B; mode A D = 4, t = 3: 1,995 B.
- (2,3) and (5,9) use ciphertexts re-encrypted to that committee's TPK by the generator's `encryptChain` without a new proof; proof verification does not
  depend on the committee and is timed on the (3,5) fixtures.

## Findings
1. **Mode A cannot detect a wrong opening from its output; mode C can.** With wrong shares forced through, mode A outputs c2 − S', which is always a valid
   subgroup point (150/150) — a plausible but wrong "identity", i.e. a framing risk if share verification is skipped or buggy. In mode C the wrong K gives
   off-curve keystream output (0/420 on-curve). In both modes the DLEQ check is what prevents framing; mode C adds a consistency check for free. This is a further
   argument for C as the main circuit (decided 2026-10-09).
2. **The epoch must be taken from the TPK bound in the proof, never from the share or the operator.** A combiner using the shares' claimed epoch outputs wrong
   points (O10 control).
3. **Members must verify the action proof before releasing a share.** Otherwise a tampered c1 makes them decrypt an attacker-chosen point (O13 control);
   with the proof check, every tamper is refused. Members also refuse c1 outside the prime-order subgroup (O14), which would otherwise leak s_i mod 8 (via D_i on a small-order component).
4. The generator's default `accSeed` is deterministic (same instance ⇒ same ciphertext). Fine for reproducible tests, but a real client must use a CSPRNG;
   E6 fixtures do (U1 control shows the difference).

## Deviations from pre-registration (transparent)
- P2 was pre-registered as "(ch, z) per share"; the implementation uses the commitment form (A1, A2, z). Reported both sizes (133 B vs 101 B).
- During development (before any pre-registered run) `memberShare` omitted s_i in the call to the DLEQ prover and crashed on the first sanity check; fixed, no
  output was produced or kept.
- The mode A pre-registration row for O3 expected only "points ≠ ent"; the fact that mode A's wrong points are valid curve points was not anticipated and is
  reported as finding 1 (no reclassification).

## Limits (what this does not show)
Trusted dealer, no DKG; static corruption < t; ≥ t members can open any action (governance, not cryptography); openings are verified off-chain (no on-chain
opening verifier); DLEQ soundness/ZK, ElGamal-KEM and Poseidon-PRF are assumed, not proved here; scalar multiplication is not constant-time (circomlibjs);
no key resharing between epochs (each epoch is an independent dealing); the paper's G-NFF / T-NFF must be rewritten around share verification (DLEQ) rather
than Shamir reconstruction of the ElGamal secret (paper.tex line 418; #11 item 11).

## Scope note 2026-10-12 (audit #58; appended)
- **The adversarial cases O1–O16 ran on the v7 layout** (`cases.mjs:5`). For v9 / v9.1 there is only `opening_check.mjs`: honest 3-of-5 and a
  forced 2-share opening, 10 / 10 per D. It does not verify the action proof, and its event id is synthetic. The v9.1 run is
  `../../t2_circuit_fix/zkdac_v9_1/results/opening_check.json`. Not ported, for these reasons:
  - O8 / O9 (shares replayed across events) act only on c1 and on the DLEQ challenge, which binds the event id. The KEM part (c1, c2 = ElGamal of
    K) is the same in v7 mode C and v9, so these cases do not depend on the ciphertext layout.
  - O13 (tampered ciphertext with the original proof) on v9.1 reduces to public-input binding: every public word + 1 makes the proof fail
    (`../../t2_circuit_fix/zkdac_v9_1/results/public_binding.json`).
  - The off-curve-key opening failure of v9 (#53) is fixed in v9.1 and covered by T3 v9.1 A24.
- **Not covered:**
  - a malicious dealer (the dealer is trusted);
  - a lying combiner beyond the DLEQ checks;
  - a public opening verifier, which the research design asks for and which does not exist.
