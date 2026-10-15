# E6c — adversarial opening regression on v9.1: results

Pre-registration: `PREREGISTRATION.md` (de2bc37, pushed before any run).

Run in the second environment (T8b attempt 3, commit `f441c56`): host `enine`, Intel Xeon w7-3445 (40 CPUs), node 24.14.1, 2026-10-13 07:30–08:35 UTC.
- Fixtures: 480 real v9.1 proofs, generated there in 449 s (4 parallel processes). Every fixture was checked: its proof verifies with the committed v9.1 VK, and the parsed ciphertext equals the witness.
- Cases: 3,468 s.
- Outputs: `results/cases.json` (every row and the timings) and `results/fixtures_*.json`. They were copied back unchanged (sha256 checked).

This table is **v9.1**. It is separate from the v7 table of E6.

## Verdict: 256 / 256 rows as pre-registered; no false accept
| ID | case | (2, 3) | (3, 5) | (5, 9) |
|---|---|---|---|---|
| O1 | every t-subset, 3 actions × D = 1..4 | 36 / 36 exact | 120 / 120 exact | 1,512 / 1,512 exact |
| O2 | every larger subset | 12 / 12 exact | 72 / 72 exact | 1,560 / 1,560 exact |
| O3 | every (t − 1)-subset | 36 / 36 INSUFFICIENT | 120 / 120 INSUFFICIENT | 1,512 / 1,512 INSUFFICIENT |
| O3 control | forced Lagrange on t − 1 shares | 36 / 36 wrong; 0 of 126 recovered keys are curve points | 120 / 120 wrong; 0 of 420 on curve | 1,512 / 1,512 wrong; 0 of 5,292 on curve |
| O1-all | one fixed t-subset, **every** action (30 per D) | 120 / 120 exact | 120 / 120 exact | 120 / 120 exact |
| O12 | n − t malicious (own-key DLEQ or z + 1) + t honest, all n submitted, D = 1..4 | opens exactly; member 1 blamed | opens exactly; members 1, 2 blamed | opens exactly; members 1–4 blamed |
| O15 | TPK deployment check (7 cases) | only the honest TPK accepted | same | same |
| O17 | Feldman: honest shares pass, a corrupted share fails | 6 / 6, complaint | 10 / 10, complaint | 18 / 18, complaint |

Cases run with (3, 5) at every D = 1..4, in the groups party A named:

| group | ID | cases | result |
|---|---|---|---|
| wrong shares | O4, O5 | duplicate share; same index twice | INSUFFICIENT, blamed `DUPLICATE_INDEX` (4 / 4; 4 / 4) |
| | O6 | D_i + Base8; random point; s'·c1 with a valid DLEQ for its own key | rejected against the published Y_i (12 / 12) |
| | O7 | z + 1; A1 replaced; A1/A2 swapped | `DLEQ_FAIL` (12 / 12) |
| cross-event | O8 | share for action B submitted for A; the same share with ev relabelled | rejected (8 / 8) |
| | O9 | same D_i and c1 under another event id | `DLEQ_FAIL` (4 / 4) |
| wrong epoch | O10 | epoch-2 action, epoch derived from the public TPK; epoch-1 member asked to share; 3 epoch-1 shares | refused `EPOCH_MISMATCH` / rejected `EPOCH_MISMATCH` |
| | O10 control | combiner that trusts the shares' epoch | outputs wrong keys |
| | O10 | every epoch-2 action opened by epoch-2 members | 40 / 40 exact |
| | O11 | 2 epoch-2 shares + 1 epoch-1 share | INSUFFICIENT (4 / 4) |
| ciphertext substitution | O13 | c1x, c1y, c2x, e[0], e[D] or esign + 1, or c1 from another action, with the original proof | proof fails, members refuse (28 / 28) |
| | O13 control | same, without the proof check | wrong keys or member refuses (28 / 28) |
| invalid c1 | O14 | identity, order 2, order 8, off-curve, c1 + order-8 point | refuse `INVALID_C1` (20 / 20) |
| structure | O16 | combine() and member secrets | combine() never touches member secrets (threshold.mjs unchanged from E6) |

**Gate link.**
- **O20.** The 120 ciphertexts that the real v9.1 gate emitted in E7c were opened by members 1, 3 and 5: 120 / 120 exact. E7c B1 asserts that each `Accountability` event equals these words, and the words equal the proofs' ciphertext (120 / 120).
- **O21.** The v9 off-curve proofs that a v9 gate accepted in E7c G7 open to a wrong key **exactly at the off-curve hop** (j = 1, 2, 3). This is the accountability consequence of #53 on v9. No such v9.1 proof exists (E7c G7).

## Timings at D = 4, second environment (recorded, not criteria; n = 30 actions per committee)
| committee | action-proof verify | member share (partial decryption + DLEQ) | DLEQ verify, per share | combine + decrypt (t shares) |
|---|---|---|---|---|
| (2, 3) | 9.6 ms | 51 ms | 76 ms | 193 ms (p95 259) |
| (3, 5) | 10.3 ms | 53 ms | 76 ms | 280 ms (p95 384) |
| (5, 9) | 9.8 ms | 51 ms | 76 ms | 469 ms (p95 631) |

All values are medians unless a p95 is given. Combining grows with t because every share's DLEQ is verified. Per-share work does not depend on D: the compressed ciphertext has one c1. All D values are in `results/cases.json` under `perf`.

## What this supports and what it does not
It supports the following:
- **Correct opening after the migration.** After the migration to v9.1's compressed ciphertext, distributed opening with verifiable partial decryptions works at 2-of-3, 3-of-5 and 5-of-9, for every D.
- **Rejection and blame.** Wrong, duplicated, cross-event and wrong-epoch shares are rejected and blamed. Fewer than t shares open nothing.
- **Ciphertext substitution.** A substituted ciphertext is caught by the action proof before any member releases a share.
- **Opening real gate output.** The ciphertexts the real gate emits open to the chain keys.

It does not support:
- a DKG (the dealer is trusted);
- security against t or more colluding members;
- on-chain verification of openings;
- any formal proof.
