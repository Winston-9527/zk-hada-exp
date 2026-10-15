# E6 threshold accountability opening — pre-registration (committed BEFORE any run)
Issues #6 (T4), #30 (R6 in the action circuit). Branch `t4-e6-threshold` (based on `t30-r6-accountability`, PR #31 not yet merged).
User decision 2026-10-09: main circuit = v7 **mode C**. Mode A is run as a secondary check only (O1–O3, P1).
Stop condition (research design §8, line 323): if opening works only by reconstructing the full committee secret `tsk`, the paper may only claim
*centralised* opening, not robust distributed threshold accountability.

## What is being built
- Group: BabyJub prime-order subgroup <Base8>, order l (≈ 2^250.6). All scalars mod l.
- **Key setup (trusted dealer, NOT a DKG)**: per key epoch `e`, the dealer samples f_e(x) = a_0 + a_1 x + … + a_{t-1} x^{t-1} over Z_l, gives member i
  the share s_i = f_e(i) (i = 1..n), publishes Feldman commitments A_k = a_k·Base8 and Y_i = s_i·Base8. TPK_e = A_0. Members check
  s_i·Base8 = Σ_k i^k A_k (complaint otherwise). The dealer knows tsk = a_0 and is trusted; DKG is not implemented and will not be claimed.
- **Partial decryption** (member i, event ev, epoch e): D_i = s_i·c1 with a Chaum–Pedersen DLEQ proof that log_{Base8} Y_i = log_{c1} D_i:
  w random, A1 = w·Base8, A2 = w·c1, ch = SHA-512("zkdac-e6-dleq-v1" ‖ e ‖ ev ‖ i ‖ Y_i ‖ c1 ‖ D_i ‖ A1 ‖ A2) mod l, z = w + ch·s_i mod l.
  (SHA-512 so the mod-l reduction bias is ≈ 2^-261; SHA-256 mod l would be visibly biased.)
  ev = SHA-256 of the action's public signals (binds the share to one action event).
- **Opening**: the action proof is verified (snarkjs, `vk_c{D}.json`) before any member releases a share; members check TPK in the public signals equals
  TPK_e of the claimed epoch and that c1 is on-curve, in the prime-order subgroup and ≠ identity. The combiner checks every share (index range,
  uniqueness, epoch, ev, D_i in subgroup, DLEQ against the published Y_i), discards invalid ones (blame list), and with ≥ t valid shares computes
  S = Σ λ_i D_i (Lagrange at 0, mod l) = tsk·c1 **on the group**, K = c2 − S, then the Poseidon keystream gives ent[0..D]. Recovered points must be
  on-curve and in the subgroup (consistency check). The combiner API receives only (i, D_i, proof); it never receives s_i.
- Mode A: same, one share per ciphertext c1_j (D+1 per action).

## Pre-registered cases (fixtures: real v7 mode-C proofs, D = 1..4; n = 5, t = 3 unless stated)
| ID | Case | Expected |
|---|---|---|
| O1 | honest, every 3-subset of 5 (10 subsets), D = 1..4 | open; ent[0..D] exact |
| O2 | honest, every 4- and 5-subset | open; same result as O1 |
| O3 | t−1 = 2 honest shares (every 2-subset) | refuse INSUFFICIENT. Forced Lagrange on 2 shares: recovered points ≠ ent (record on-curve fraction) |
| O4 | one member's share submitted twice to reach t | duplicate rejected → INSUFFICIENT |
| O5 | same index twice with different D_i | both copies rejected (ambiguous index) → INSUFFICIENT if no other share |
| O6 | wrong D_i (D_i + Base8; random subgroup point; s'·c1 with s' ≠ s_i and a VALID DLEQ proof w.r.t. s'·Base8) | share rejected (DLEQ vs published Y_i) |
| O7 | honest D_i, tampered proof (z+1; ch replaced; A1/A2 swapped) | share rejected |
| O8 | replay: honest share + proof from another action event (same epoch) | rejected (c1 / ev mismatch) |
| O9 | same D_i and c1 but proof relabelled to another ev | rejected (challenge binds ev) |
| O10 | epoch mixing: ciphertext under TPK_2, shares from epoch-1 members (valid DLEQ for epoch 1) | rejected EPOCH_MISMATCH; a naive combiner that skips the epoch check recovers points ≠ ent |
| O11 | mixed set: 2 shares epoch 2 + 1 share epoch 1, for an epoch-2 ciphertext | epoch-1 share rejected → INSUFFICIENT |
| O12 | robustness: 2 malicious members (O6/O7 forgeries) + 3 honest, all 5 submitted | open succeeds; both malicious members identified |
| O13 | tampered ciphertext with the original proof: c1, c2 or one e word +1 / c1 from another action | action proof fails → members refuse. Control without proof check: recovered points ≠ ent |
| O14 | invalid c1 presented to a member: identity (0,1); order-2 (0,−1); an order-8 point; off-curve; P + T (T of order 8) | member refuses (no share released) |
| O15 | TPK deployment check (A19i): honest TPK; identity; small-order; off-subgroup; off-curve; TPK ≠ A_0 | accept only the honest TPK |
| O16 | no reconstruction of tsk: combiner code path never takes s_i (API + source check); the dealer's tsk is not passed to the opening code | holds by construction (structural, recorded) |
| O17 | Feldman: dealer sends member i a corrupted share | member's check fails (complaint) |

## Unlinkability (U) — empirical, not a proof
| ID | Case | Expected |
|---|---|---|
| U1 | 20 chains × 10 actions each with CSPRNG randomness (mode C, D = 4): pairwise equality of c1, c2, every e word, and every within-action difference e[j][b] − e[k][b] across actions | no equality between any two actions (same or different chain) |
| U1-neg | negative control: the generator's default deterministic `accSeed` (same seed ⇒ same ciphertext) | identical ciphertexts across the chain's actions (test detects linkage) |
| U2 | same-chain vs different-chain action pairs; features = Hamming distance of the low 64 bits of each public ciphertext word; AUC with bootstrap 95 % CI | CI contains 0.5; negative control (fixed randomness) AUC = 1 |
Note: in mode C the prover chooses the randomness; a prover can make its own actions linkable (T3 A19d/A19h). That is a cost to the prover only.

## Performance (P)
| ID | Measurement |
|---|---|
| P1 | per action, mode C, D = 1..4, N = 30 fresh instances per D: member share time (partial decryption + DLEQ prove), DLEQ verify per share, combine + keystream decrypt, action-proof verify; committees (t, n) ∈ {(2,3), (3,5), (5,9)} at D = 4; mode A D = 4 (N = 10) |
| P2 | opening transcript size (bytes, canonical: index + epoch + D_i + (ch, z) per share) |
Statistics: mean ± SD, median, p95; machine Apple M5 Pro (15 cores), node 24.14.1, circomlibjs 0.1.7, snarkjs 0.7.6.

## Pass criterion
All "rejected / refuse" rows reject; all "open" rows recover ent[0..D] exactly; no FALSE_ACCEPT (a forged or replayed share accepted, or a wrong point output
as an opening). Deviations from this file are reported in RESULTS.md under "deviations from pre-registration"; raw outputs are not reclassified.

## Claims this can support, and what it cannot
- Supports: distributed, verifiable partial decryption with identifiable cheaters under a trusted dealer and static corruption of < t members; tsk is never
  reconstructed by the opening.
- Does not support: DKG / dealerless setup; security against ≥ t colluding members (they can open any action — governance, not cryptography); on-chain
  verification of openings; any formal proof (DLEQ soundness / ZK and ElGamal-KEM + Poseidon-PRF security are cited assumptions, not re-proved here).
