# E7c — v9.1 proofs on the real gate: pre-registration (committed and pushed BEFORE any run)

Party A's handoff (2026-10-13, priority 3): success, rollback, action substitution and window tests with v9.1 proofs submitted to the real gate.
User (2026-10-13): run in the second environment (`ssh siyuan@RTX6000`, `~/projects`). Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP5.

## Object
- Gate: `ZkDacGateV9` (unchanged source) deployed with the v9.1 verifiers `Groth16VerifierV91CD{1..4}` (copied unchanged from release
  `v9.1-proving-material-20261013` into `foundry/src/`). The gate selects the verifier by ciphertext length, so v9.1 needs no contract change; the
  only Solidity diff is the four new verifier files and the new test files (diff recorded in `RESULTS.md`).
- All proofs are generated **in the second environment** from the frozen v9.1 wasm and the released zkeys (`gen_fixtures_v91.mjs`, `gen_batch_v91.mjs`).
  Fixtures are written to `foundry/test/fixtures_V91*.json` and committed with the results.
- Committee key: the batch fixtures encrypt to the E6 dealer committee (t = 3, n = 5, epoch 1, seed `e6-20261009`), so E6c can open the very
  ciphertexts the gate emitted (E6c O20).

## Suites
**H — history (port of `V9.t.sol`, `V91.t.sol`).** Same ordered budget history S0–S9 with v9.1 action proofs; same tests (sequence, GB2, GB4, GB5,
wrong mint amount, action-then-transfer, GB7 revocation freeze, replay of an executed proof, unregistered state, registerState, gas). The port changes
only the verifier contracts, the fixture file and the contract name (diff recorded).

**P — POLICY rows (port of `V9Policy.t.sol`, `V91Policy.t.sol`).** All 20 tests of the v9 closure plus the party-B A21c test, on the v9.1 gate.

**B — batch of independent actions (`V91Batch.t.sol`).** D = 1..4, N = 30 independent instances per D (seeds 7000 + 100·D + i): each has its own
registered root (one registration proof per instance, humans 0..119 in one Semaphore group), its own chain keys and certificates, a budget note minted
by the operator to its terminal holder (q = 10), and an execute proof spending 7 (change 3). All 120 execute proofs are made on the note root after
all mints. Per instance:

| ID | case | expected |
|---|---|---|
| B1 | submit | accepted; target called once with the amount; budget nullifier marked spent; one note inserted (size + 1, root changes); `Accountability(nf, ct)` emitted with ct equal to the proof's ciphertext words |
| B2 | business target reverts | whole call reverts ("business failure"); nullifier not spent; note tree size and root unchanged; the same proof is then accepted |
| B3 | substitution, original proof: target, method (enabled, same cap), params, nonce, amount + qSpent, chainId, gate address (same state at another address), ciphertext word + 1 (c1x, c2x, e[0], esign), gate with another valid TPK | `InvalidProof` for every variant |
| B3' | amount only (qSpent unchanged) | `AmountMismatch` |
| B4 | replay after success | `BudgetSpent` |
| B5 | windows (first 10 instances per D): clock skew 60 s at NOW + 60 (accept) / NOW + 61 and NOW − 1 (`BadClock`); note root retired exactly noteWindow ago (accept) / + 1 s (`StaleNoteRoot`); issued root retired exactly issuedWindow ago (accept) / + 1 s (`StaleIssuedRoot`); revocation window Δ ∈ {0, 12, 60, 240} s (= 0, 1, 5, 20 epochs of 12 s) after a real revocation transaction that revokes one batch certificate: at Δ accept / Δ + 1 `StaleRevokedRoot` | as stated |
| B6 | another sender submits the pending proof | accepted (the executor is not bound; disclosed POLICY row, not a failure) |

**G7 — off-curve regression (#53) on the gate.** D = 4, an off-curve chain key at hop j ∈ {1, 2, 3} in a gate-consistent instance (point from
`work/t2_circuit_fix/zkdac_v9_1/scripts/offcurve.py`, seed 1). Record for each j: v9.1 witness (expected unsatisfiable at BabyCheck), v9 witness
(expected satisfiable), the stage where the instance stops if registration or certificate construction rejects it. For every j that yields a v9 proof:
submitted to the v9.1 gate → `InvalidProof`; submitted to a gate with the v9 verifiers and identical state → accepted (shows the on-chain consequence of
#53 on v9 and that v9.1 closes it). j = 0 (root key, bound by registration) stays at witness level (v9.1 check 5).

## Pass criterion and reporting
Every row as expected. Any acceptance of a substituted, replayed, out-of-window or off-curve proof on the v9.1 gate is a FALSE_ACCEPT and fails the
corresponding claim. Reported: counts per case and D, gas of B1 (median, p95 over 30 per D, excluding fixture parsing), forge and solc versions,
the commit, and the second-environment host. A second execution client (RD E7 cross-check) is not part of this round and is disclosed as such.
Deviations are reported under "deviations from pre-registration"; raw outputs are not reclassified.
