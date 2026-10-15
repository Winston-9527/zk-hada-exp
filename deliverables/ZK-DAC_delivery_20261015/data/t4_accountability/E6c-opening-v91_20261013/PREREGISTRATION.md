# E6c — adversarial opening regression on v9.1: pre-registration (committed and pushed BEFORE any run)

Party A's handoff (2026-10-13, priority 3): after the migration to v9.1, the wrong-share, cross-event, wrong-epoch and ciphertext-substitution suites.
User (2026-10-13): run in the second environment (`ssh siyuan@RTX6000`, `~/projects`). Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP6.
Previous evidence: E6 (`../E6-threshold-opening_20261009`, O1–O17) ran on **v7** ciphertexts only; v9/v9.1 use the compressed mode-C ciphertext
(c1, c2, e[0..D], esign; D + 6 words) and only had an honest 3-of-5 check (`zkdac_v9_1/results/opening_check.json`, 10 per D).

## Object
- Threshold library: `../E6-threshold-opening_20261009/threshold.mjs`, imported unchanged (trusted dealer + Feldman, partial decryptions with
  Chaum–Pedersen DLEQ, combination in the group; no reconstruction of tsk).
- New front end for v9.1 (`lib_v91_open.mjs`): public-signal layout of v9.1 (`state_root, now, ctx_hash, act_req_cap, tpk[2], c1[2], c2[2],
  e[D+1], esign, note_root, budget_nf, cm_change, q_spent`), event id = SHA-256 of the public signals (as E6), decryption by `openWithS` of
  `zkdac_v9_1/scripts/lib_v9.mjs` (K = c2 − S, Poseidon keystream, parity word). Truth = the chain keys ent[0..D] of the witness.
- Fixtures (`fixtures_v91.mjs`, generated in the second environment): real v9.1 proofs (released zkeys), fresh instance and CSPRNG ciphertext
  randomness per action, each checked (proof verifies with the committed v9.1 VK; parsed ciphertext equals the witness). Committees (t, n) ∈
  {(2, 3), (3, 5), (5, 9)}, epoch 1: N = 30 per D = 1..4; (3, 5) epoch 2: N = 10 per D. 480 proofs.

## Cases (as E6, run on every D = 1..4 unless stated; "every action" = all fixtures of that cell)
| ID | case | expected |
|---|---|---|
| O1 / O2 | honest: every t-subset / every larger subset, every committee, first 3 actions per (committee, D) | open, exact |
| O1-all | honest, one fixed t-subset, every action of every cell | open, exact (30/30 per cell) |
| O3 | every (t−1)-subset; forced Lagrange control | INSUFFICIENT; forced control recovers wrong keys (record how many recovered points are valid curve points) |
| O4 / O5 | duplicate share; same index twice with different D_i | rejected → INSUFFICIENT |
| O6 | wrong D_i: + Base8; random point; s'·c1 with a valid DLEQ for its own Y' | rejected (DLEQ vs published Y_i) |
| O7 | tampered DLEQ: z + 1; A1 replaced; A1/A2 swapped | rejected |
| O8 / O9 | cross-event: share for action B submitted for A; ev relabelled; same D_i and c1 under another event id | rejected |
| O10 / O11 | wrong epoch: epoch-1 member asked for an epoch-2 action; three epoch-1 shares for an epoch-2 action; 2 epoch-2 + 1 epoch-1 share; naive combiner control | refuse / EPOCH_MISMATCH / INSUFFICIENT; control outputs wrong keys |
| O12 | robustness: n − t malicious (forged with valid own DLEQ, or tampered proof) + t honest, all n submitted; every committee | open exact; exactly the malicious members blamed |
| O13 | ciphertext substitution with the original proof: c1x + 1, c1y + 1, c2x + 1, e[0] + 1, e[D] + 1, esign + 1, c1 taken from another action | action proof fails → members refuse; control without the proof check: wrong keys or member refuses |
| O14 | invalid c1 to a member: identity, order 2, order 8, off-curve, c1 + order-8 point | refuse INVALID_C1 |
| O15 | TPK deployment check: honest, identity, order 2, order 8, outside subgroup, off-curve, valid point ≠ A_0; every committee | accept only the honest TPK |
| O16 | no reconstruction (structural) | combine() never touches member secrets |
| O17 | Feldman complaint; every committee | honest shares pass; corrupted share fails |
| O20 | ciphertexts emitted by the real v9.1 gate (E7c batch, 120 actions, `Accountability` events asserted equal to the proofs' ciphertext words) | opened by the (3, 5) committee: exact for 120/120 |
| O21 | the v9 off-curve proofs of E7c G7 (accepted by a v9-verifier gate) | opening returns a wrong key exactly at the off-curve hop (documents #53 on v9; no such v9.1 proof exists) |

## Performance (recorded, not criteria)
Per committee and D (all actions of the cell): member share time (partial decryption + DLEQ prove), DLEQ verify per share, combine + decrypt, action-proof
verify; median, p95, mean ± SD. Opening transcript size (canonical bytes). Second-environment machine.

## Pass criterion
All "rejected / refuse / INSUFFICIENT" rows reject; all "open" rows recover ent[0..D] exactly; no FALSE_ACCEPT (a forged, replayed, cross-event or
wrong-epoch share accepted, or a wrong key output as an opening). Results are reported in a table labelled v9.1, separate from the v7 table of E6.
Not claimed: DKG, security against ≥ t colluding members, on-chain verification of openings, any formal proof.
