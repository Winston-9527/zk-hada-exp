# T8e — WP14 residual single-axis sweeps: tree height, D = 8, number of agents — pre-registration

Committed and pushed BEFORE any variant circuit is written or any run is made.
- Base: main 5ba04b5 (v9.2). Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP14 (PR #61), lowest priority.
- **Machine.** Proving and client timings: the Mac M5 Pro, otherwise idle. Constraints, sizes and gas do not depend on the machine.
- **Every run reports timeouts and OOMs** (plan). A step that exceeds its limit is recorded as such, and it is not retried with other settings without an amendment.

## S1 — tree height h ∈ {10, 20, 24}
- **Definition.** The circuit has four Merkle structures: the issued-certificate tree (MD), the revocation IMT (RD), the registered-root LeanIMT (RT) and the note LeanIMT (NT). v9.2 uses (MD, RD, RT, NT) = (16, 20, 20, 20). Here **all four are set to h**.
- **Variants.** `zkdac_v9_2` main files with `ZkDacChainV9(D, h, h, h, h)`; the template is unchanged. D ∈ {2, 4} × h ∈ {10, 20, 24} = 6 circuits.
- **Setup.** One local phase-2 contribution on the Hermez ptau of the smallest sufficient power: 2^18, or 2^19 / 2^20 if the constraint count needs it.
- **Instances.** The v9.2 instance builder, with the four trees built at depth h and every path padded to h. A JS check that the instance is satisfiable comes first.
- **Measurements:**
  - constraints;
  - zkey size;
  - setup time;
  - Mac proving: `prove_bench`-style, 10 fresh instances per circuit, witness / prove / verify ms. Run order: h = 10, 20, 24, then repeated (two runs).
  - Verifier gas is unchanged, because the public inputs do not depend on h. This is confirmed once per D, with a real verifier call.
- **Reported:** per (D, h): constraints, proving time (mean of two runs, with the run-to-run spread), and capacity 2^h for each structure.

## S2 — depth D = 8 (scaling variant)
- **Why a variant.** v9.2 cannot be compiled at D = 8: the budget-note commitment fixes the lineage to 4 certificates (`lin[4]`, `assert(D <= 4)`, note = Poseidon(8)).
- **The variant `zkdac_v9_2_d8`:**
  - lineage length L = max(4, D); note = Poseidon(4 + L), which is Poseidon(12) at D = 8;
  - nothing else changed;
  - the diff against v9.2 must show only these lines.

  **This changes the note format**: a D = 8 note is not a v9.2 note. That is reported.
- **Circuits.** D = 8 with the default trees (16, 20, 20, 20). Ptau 2^19 or 2^20, as needed.
- **Measurements:** constraints, public inputs (D + 16 = 24), Mac proving (10 instances, 2 runs), and verifier gas from a real verifier call. As a consistency control, the variant is also built at D = 4: its constraint count shows the cost of the longer lineage alone.

## S3 — number of agents N ∈ {32, 128, 1,024, 10,000}
- **World.** The T5 structure scaled to N:
  - masters at D = 1, fan-out 8 per hop to D = 4;
  - roughly 1 / 8 of the agents at each intermediate level, and the rest at D = 4;
  - the generator is deterministic and gives exactly N agents.
- **Credentials:** off-chain issuance of all N certificates, timed on the Mac and parallelised over 8 processes.
- **Chain:**
  - ZkDacGateV9 with **real v9.2 action verifiers**;
  - the budget transfer and mint verifiers are accept-all, only for building the note tree quickly;
  - registration and revocation as in T5 (no revocations here);
  - one budget note per agent, minted on chain, so the note tree holds N notes.
- **Actions:** at each N, **10 real actions** by agents sampled uniformly (seeded) across depths, sequentially on the Mac. For N = 10,000 this is the plan's "at least 10".
- **Measurements:**
  - world-build wall time and peak RSS;
  - client mirror size and load time;
  - per action: revocation-path fetch, witness assembly, witness calc, prove, verify, and execute gas with the change-note index.
- **Expectations:** execute gas grows with the note index (T5: +27k per set bit), and proving does not depend on N.

## Outputs
- `s1/`, `s2/`, `s3/` with `results/`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

Failures (including OOM and timeouts) are kept. Changes after this commit are amendments, recorded before the affected run.

## Amendment A1 (2026-10-15T08:15Z): S2 reduced, by user decision
- The D = 8 variant has 375,148 constraints, above the 2^18 = 262,144 capacity of the Hermez ptau used everywhere in this project. A setup would need a 2^19 ptau.
- The user decided not to download one, and not to generate one locally.
- **S2 therefore reports only:**
  - the constraint count, 375,148;
  - the public-input count, 24;
  - the D = 4 control of the same variant (195,044, identical to v9.2's D = 4).
- No setup, proving time or verifier gas is reported for D = 8. Everything else in S2 and in S1 / S3 is unchanged.
