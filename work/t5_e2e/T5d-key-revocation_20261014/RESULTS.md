# T5d — key revocation at scale (WP9): results

- **Pre-registration:** `PREREGISTRATION.md` (c5030b1, before the harness was written).
- **Amendments:** A1 4a9e00a (moved to the Mac); A2 46ac652 (one revocation per distinct certificate in E-oracle; one world failed and was rerun).
- **Machine:** Apple M5 Pro. No reported number depends on it.
- **Data:** `results/worlds/*.json` and `results/summary.json`.
- **Scope:** the T5 tree (1,230 agents). A share s ∈ {10, 30} % of the agents at D ≥ 2 reuse another branch's key. r ∈ {1, 10} % of the distinct delegate keys are revoked. 3 seeds, 12 worlds.
- **Methods**, all run from the same snapshot:
  - K = key revocation;
  - E-oracle = revoke every certificate held by the key;
  - E-local = one issuer revokes its own edge only.
- **Verifiers:** the revoke proofs and verifier are real. The execute verifier is accept-all, with T5b-style substitute witnesses evaluated by the real v9.2 circuit.

## Hard checks (`results/summary.json` "hard"): all pass
- **False accepts, K and E-oracle: 0** in 12 / 12 worlds. No target agent:
  - had a fresh transaction accepted;
  - could construct a fresh witness;
  - had a satisfiable substitute witness.
- **Circuit level.** 6,279 target evaluations over all methods, each with a predecessor-leaf and an own-leaf witness.
  - All targets of K and E-oracle are rejected: predecessor leaf at IMTNonMember L67 (ordering), own leaf at L59.
  - The 2,304 honest controls are accepted.
- **Collateral denial: 0** for all three methods in all worlds. Every non-target agent could build a fresh witness, and its transaction was accepted.
- **Every pre-revocation transaction** (44,280 = 1,230 × 3 methods × 12 worlds) was rejected after the 30 s window with StaleRevokedRoot, for targets and non-targets alike. Every agent re-proves once (T5's availability cost).

## Cost and coverage (mean ± SD over 3 seeds)
| s | r | revoked keys (shared) | targets | txs K | txs E-oracle | E-oracle / K txs | revoke gas K (M) | revoke gas E-oracle (M) | E-local coverage | E-local targets still acting |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 % | 1 % | 11 (1.0 ± 1.0) | 46 ± 32 | 11 | 12.3 ± 1.5 | 1.00–1.27 | 3.01 | 3.37 | 0.90–1.00 | 0–3 |
| 10 % | 10 % | 108 (12.3 ± 2.5) | 302 ± 37 | 108 | 121.7 ± 2.5 | 1.10–1.15 | 29.5 | 33.3 | 0.93–0.97 | 12–19 |
| 30 % | 1 % | 8 (3.3 ± 2.1) | 46 ± 40 | 8 | 11.7 ± 2.5 | 1.13–1.75 | 2.19 | 3.19 | 0.80–0.96 | 1–6 |
| 30 % | 10 % | 84 (33.0 ± 1.7) | 303 ± 49 | 84 | 121.0 ± 1.7 | 1.42–1.45 | 23.0 | 33.1 | 0.76–0.89 | 36–60 |

- **One revoke transaction costs 273.5k gas**, whatever the method or the IMT size, as in T5. Each revocation also needs one `registerState`.
- **Key revocation needs one transaction per key.** Revoking the edges needs one per certificate held by that key.
  - E-oracle needs 0–75 % more transactions and gas; the excess grows with key sharing (30 %: +42–45 % at r = 10 %).
  - Both methods block the same set of agents: coverage 1, false accept 0, collateral 0.
- **E-oracle assumes the revoker knows every edge of the key.**
  - With local knowledge (E-local), 0–24 % of the targets are not blocked (0 only where no revoked key was shared) and keep acting.
  - At 30 % sharing and r = 10 %, that is 36–60 agents per world.
  - Key revocation needs no such enumeration. This is the measured form of the B6 "enumerate descendants" argument.
- One world (s30-r10-1) contains a certificate shared by two edges. That happens when the issuer key and the holder key are both shared. E-oracle revokes it once (amendment A2).

## What this means for the paper (research design E3)
- Key revocation at scale works as designed. Revoking one key blocks every chain that contains it, at the circuit and gate levels, without listing the chains, and does not block anyone else.
- Its advantage over edge revocation is twofold:
  - fewer transactions when keys are shared;
  - no need to know every edge that uses the key. Partial knowledge leaves up to 24 % of the compromised branches active.
- Not covered:
  - master keys (ent[1]), which the circuit does not key-check (pre-registered limit);
  - partial knowledge between E-local and E-oracle.

## Corrections after audit #76 (2026-10-15; no new experiment)
The evidence behind "false accept 0 / collateral denial 0" is of three kinds, and only the first is circuit evidence:
1. **Circuit (real v9.2 wasm).** Every target was evaluated with predecessor-leaf and own-leaf substitute witnesses for every revoked slot, key slots included, and all were rejected. These rejections carry the false-accept claim.
   - The audit added more checks, none accepted: exhaustive leaves (1,984), end and sentinel leaves, forged `next`.
   - It also evaluated all 981 / 981 non-targets of s30-r10-1 for K and E-oracle, and all were accepted. The original runs checked 64 controls per method.
2. **Gate (accept-all verifier).** These checks are vacuous for targets: only agents whose JS predicate allowed a witness submitted a fresh transaction (`t5d.mjs:138-140`), so "target fresh transaction accepted: 0" cannot fail, and an accept-all verifier would accept anything submitted.
3. **JS predicate.** "Target could construct a fresh witness: 0" is the definition of target under K (tautological).

**Mock list, completed:** the mint and registration verifiers were accept-all too. RESULTS named only the execute verifier.

**Pre-registration vs code:** the pre-registration says a reuser's certificate has "another issuer and another hop". The code did not require another hop. Effects:
- the s30 worlds have 1–2 duplicate certificates (amendment A2);
- 4 worlds each have one chain in which the same key appears twice.

Neither affects the results.
