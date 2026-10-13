# T5b — results (post hoc, audit #56 / #57)
Pre-registration: `PREREGISTRATION.md` (e579d62, pushed before any run). Runs: `node latency_ci.mjs > results/latency_p95_ci.json`,
`node revoke_circuit.mjs > results/revoke_circuit.json` (3 min 56 s, Apple M5 Pro).

## A. Revocation at scale, evaluated by the circuit (`results/revoke_circuit.json`)
Final T5 world: 120 revoked edges, 301 blocked agents.
| | v9 (circuit T5 used) | v9.1 |
|---|---|---|
| blocked agents, predecessor-leaf witness | **301 / 301 rejected**, all at IMTNonMember L67 (ordering) | 301 / 301 rejected, IMTNonMember L67 |
| blocked agents, own-leaf witness | **301 / 301 rejected**, all at IMTNonMember L59 | 301 / 301 rejected, IMTNonMember L59 |
| unblocked controls, honest witness | 64 / 64 accepted | 64 / 64 accepted |

- **False accepts: 0.** This replaces the T5 statement, which came from the witness generator refusing to build a witness. The "0 collateral
  denials" side of T5 was already a circuit evaluation and is unchanged.
- The stderr line "ERROR: 4 Error in template IMTNonMember_320 line: 59" is the witness calculator's message for an expected rejection.
- **Limits:**
  - two substitute witnesses per agent (the predecessor leaf and the own leaf), not every leaf;
  - certificate revocation only; key revocation at scale is not tested.

## B. p95 with 95 % CI (`results/latency_p95_ci.json`, local ms)
| D | steady p95 [CI] (N = 30) | cold p95 [CI] (N = 10) |
|---|---|---|
| 1 | 927 [925, 936] | 1,030 [1,019, 1,034] |
| 2 | 1,578 [1,568, 1,664] | 1,719 [1,662, 1,724] |
| 3 | 2,449 [2,434, 2,512] | 2,610 [2,547, 2,619] |
| 4 | 2,855 [2,752, 3,008] | 2,935 [2,897, 2,950] |
- With N = 30 (cold: 10) the upper bound is at or near the sample maximum, so these CIs are rough.
- The 10 s target holds with a wide margin either way. p99 is not estimable.
