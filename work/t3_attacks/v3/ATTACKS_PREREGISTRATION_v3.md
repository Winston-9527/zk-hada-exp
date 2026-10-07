# T3 re-run on v3 (layout C) — attack mapping, committed BEFORE running (issue #5)
The original pre-registration (`../ATTACKS_PREREGISTRATION.md`, run on v2) stays authoritative for the attack *classes*. This addendum only maps them to v3,
where the 7 action-context fields are replaced by one opaque public `ctx_hash` (computed by the contract with keccak) plus public `req_cap` and `now`.
Oracle changes for v3 (`oracle_v3.mjs`): the world additionally holds the action the verifier is executing (`world.action`) and the contract's
required capability; rules 11–12 become: ctx_hash == keccak(world.action) >> 8, req_cap == world.requiredCap; digest = Poseidon(ctx_hash, req_cap).
All other rules (registry/revocation as sets, signatures, attenuation, expiry, holder secret, nullifier, spent set, trusted clock, current roots) are unchanged.

| ID | v2 form | v3 form | expected oracle |
|---|---|---|---|
| A00 | valid control | same | accept |
| A02/A02b | wrong terminal secret / legit shorter chain | same | reject / accept |
| A03/A03b | unregistered padding hop / identity holder key | same | reject |
| A04 | signature reuse, field replaced | same | reject |
| A05 | chain splice | same | reject (A05c control accept) |
| A06 | holder key substitution | same | reject |
| A07 | nullifier variants | same (digest = Poseidon(ctx_hash, req_cap)) | reject |
| A08/A09 | registry mis-binding / non-boolean bits | same | BAD_WITNESS_ONLY (valid witness exists) |
| A10 | replay | same | POLICY (contract nullifier set) |
| A11 | change one context field (chain id, verifier, method, amount, params, nonce) | **v3: proof for action X presented while the verifier executes action Y** — (a) unchanged public inputs; (b) attacker replaces ctx_hash by keccak(Y) | reject (a: ctx mismatch; b: nullifier mismatch) |
| A11-req | — | **new:** prover-chosen req_cap = 0 with consistent nullifier | circuit accepts; oracle (requiredCap) rejects → POLICY (contract sets req_cap; closed in #18) |
| A12a/b/c | revocation | same | reject / reject / POLICY (root freshness) |
| A13/A13b | SMT depth overflow / liveness | same | reject / COMPLETENESS_GAP expected (RD=16 unchanged) |
| A14 | time | same | POLICY / reject / reject |
| A15 | capability smuggling | same (req_cap is now a public input) | reject |
| A16 | expiry inversion / wrap | same | reject / accept / reject |
Pass criterion unchanged: zero FALSE_ACCEPT outside POLICY-DEPENDENT rows. Also re-run: exhaustive oracle-vs-circuit agreement on every single-field mutation (D=4).
