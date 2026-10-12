# T5b — revocation at scale evaluated by the circuit, and T5 latency CIs (post hoc, audit #56 / #57)
Written 2026-10-12 after audit #56 / #57. Committed and pushed before any run. T5 (`../T5-e2e-scale_20261010/`) stays as it is; this directory only
reads its final world (`state/`, after the 1 % + 10 % revocations) and its result files.

## Why
- In T5, "0 false accepts among descendants of revoked edges" came from the witness generator: `prepare` throws NO_WITNESS when a chain
  certificate is in the revocation tree, so the circuit was never evaluated for the 301 blocked agents. The expected set (`blockedBy`) uses the same
  data as that check, so the number was close to a tautology. (The "0 collateral denials" side was a real circuit evaluation.)
- The T5 p95 values (N = 30) had no confidence interval.

## A. Circuit evaluation of blocked agents (`revoke_circuit.mjs`)
- For each of the 301 agents blocked in the final T5 world, build the full action witness as T5 does (current roots, issued paths, the agent's
  current note and its path, compressed accountability). Then, for every hop whose certificate is revoked, substitute the best available non-membership
  witness against the current revocation root:
  - **pred**: the revoked key's predecessor leaf (A12b′ style). Expected rejection: IMTNonMember ordering check (L67).
  - **own**: the revoked key's own leaf (A13-own style). Expected rejection: IMTNonMember (L59).
- Hops that are not revoked, and the key slots, get honest witnesses.
- Each witness is evaluated on the v9 circuit (the one T5 used) and on v9.1. The failing template and line are recorded.
- **Control:** 64 unblocked agents (seeded sample) with honest witnesses. Expected: all accept on v9 and v9.1. This shows that the harness
  builds valid witnesses for this world.
- **Decision:** any blocked agent accepted under either variant on either circuit is a false accept and is reported as found.

## B. Latency CIs (`latency_ci.mjs`)
For every T5 latency cell, compute a percentile-bootstrap 95 % CI (10^4 resamples, fixed seed) of p95 from `../T5-e2e-scale_20261010/results/
e4a_{steady,cold}.jsonl`. N = 30, so p99 stays "not estimable" (the maximum is shown).

## Not done (disclosed)
- Key revocation at scale (T5 revoked certificates only).
- Real indexer timing for S1 (T5 timed only the in-memory mirror).
- Multi-sender, random-order concurrency (E2) and the E2–E4 sweep axes.
