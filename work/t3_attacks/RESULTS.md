# T3 results (issue #5) — differential attacks, v2 vs independent oracle
Env: macOS arm64, node 24.14.1, circom 2.2.3, snarkjs 0.7.6, circomlib 2.0.5, circomlibjs 0.1.7, poseidon-lite 0.3.0.
Run: `npm ci` in `../t2_circuit_fix/zkdac_v2` and here; build circuits per t2 RUN_RECORD; `node attacks.mjs > results/attacks_v2.json`, `node baseline.mjs`, `node exhaustive_diff.mjs 4`.
Criterion is witness-level (witness generation succeeds). The attack list was committed before running (`ATTACKS_PREREGISTRATION.md`, commit "pre-register").

## v2 (D=4; A02b also D=1..3) — results/attacks_v2.json
AGREE_REJECT 37, AGREE_ACCEPT 6, BAD_WITNESS_ONLY 4, FALSE_ACCEPT 5 (all policy-dependent), COMPLETENESS_GAP 1.
- **No statement-level false accept**: every non-policy attack (A02-A09, A11, A12a/b, A13, A15, A16) is rejected; legit controls accepted.
- **FALSE_ACCEPT, all pre-registered as POLICY-DEPENDENT** (the circuit alone accepts, the verifier must reject):
  - A10 replay of a spent nullifier (needs on-chain nullifier set).
  - A12c proof against a stale, pre-revocation `revoked_root` for revoked certs 0, 1, 3. Revocation only takes effect if the verifier requires `revoked_root` to be current (or within window Δ). **The claim "revocation is enforced by the proof" is conditional on that root check; T4/E3 must measure the window.**
  - A14 `now = 0`: expired certificates look valid unless the verifier binds `now` to block time.
- **COMPLETENESS_GAP (A13b)**: honest cert1 whose exclusion proof needs 19 siblings (two revoked keys sharing 17 low bits with it) cannot be proven by RD=16 circuits (`check_a13b.mjs`: unpadded proof length 19). No valid witness exists for a legitimate statement. With ~10^3 revoked ids the expected max SMT depth is ~2*log2(N)≈20, and an issuer-side grinder needs only ~2^17 hashes to create such a collision. Needs RD >= ~32 (cost: see t2 ablation, D=4 RD=32 ≈ +67k constraints) or a bounded-depth/keyed tree. **Open; not fixed in v2.**
- BAD_WITNESS_ONLY (A08/A09): path from the wrong leaf / non-boolean bits: circuit rejects, oracle (statement-level) accepts since a valid witness exists. Not a gap.
- Oracle amendment (transparent): run 1 (`results/attacks_v2_run1.json`) labelled these FALSE_REJECT because the oracle does not model witness-path validity, and one A04 case (cap 0xFF) did not change the value (my test bug; changed to 0xFE). Class `BAD_WITNESS_ONLY/COMPLETENESS_GAP` was added afterwards; no attack outcome changed.

## Oracle sanity: exhaustive single-field mutation, D=4 — results/exhaustive_diff_d4.json
247 mutations: oracle and circuit agree on every statement-level field (keys, sigs, caps, expiries, holder_sk, action context, roots, nullifier, digest). The 205 disagreements are circuit-reject/oracle-accept on witness-only fields (`m_sib, m_bit, r_*`; by design) and `now` (+1: circuit accepts; oracle with trusted clock rejects).
Caveat: the oracle shares circomlibjs' EdDSA verify and BabyJub arithmetic with the generator; hashing is independent (poseidon-lite). It is not a formal spec.

## Baseline: committed RQ108 (46,593) — results/attacks_baseline.json
FALSE_ACCEPT 3: forged signature with eddsa switch=0; all switches 0 with arbitrary issued/revoked roots; **free nullifier secret** (5 different secrets for the same chain and action -> 5 accepted, 5 distinct nullifiers: one holder can mint unlimited nullifiers, so replay/uniqueness by nullifier does not hold). Claims G-DEL/G-UNF/G-REV and nullifier-based uniqueness FAIL for that circuit. Expectation column here is the stated semantics, not the full oracle.

## Not covered (honest list)
- Witness-level only; no proofs, so no soundness-of-proof-system testing. Poseidon/EdDSA/Groth16 assumptions untouched.
- Attacks that require a malicious *issuer/registry* (root anchoring, admitting identity-point holders) are out of the model.
- R1 (domain nullifier / human uniqueness) and R6 (accountability) are not in the circuit and have no attacks here.
- Single seed per attack; not a statistical claim.
- `ssh 201` is not reachable from this machine (`201` resolves to 0.0.0.201, no ~/.ssh/config alias); nothing here used it.
