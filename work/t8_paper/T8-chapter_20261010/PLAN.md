# T8 — experiment chapter, figures, reproducibility package, clean build (issue #10) — plan (committed BEFORE writing the chapter or running the clean build)
Base: main 595bd45 (T2–T7b merged). Rule: paper.tex belongs to party A and is NOT edited. The chapter is delivered as standalone LaTeX
(`experiments.tex`, `appendix_repro.tex`, `figures/`) that party A can `\input`, plus alignment notes in #11.

## 1. Chapter (experiments.tex), organised by the research questions of the research design (Q1–Q6, H1–H4)
1. Setup: machine, toolchain, versions, the dev-only setup ("one local phase-2 contribution, not a trusted setup").
2. Relation conformance (Q1): T2 mutations + T3 v9 attack suite (oracle vs circuit vs proof level vs contract), with "tests ≠ proof".
3. Budget conservation (Q2/H3): E2 real-transaction races (v7 640/100 vs v8/v9 ≤ 100), T7b Lean invariants T1/T2.
4. Revocation (Q3/H2): E3 (per-hop vs ablation, Δ latency), T5 scale revocation (1 %/10 %), T7b T3/T4.
5. Accountability (Q5/H4): E6 threshold opening, mode A vs C finding, v9 compressed opening.
6. Cost (Q6): T5 lifecycle latency D = 1..4, cold vs steady, targets; gas law vs note index; T6 B0 privacy cost; component costs v6→v9.
7. Baselines (E5): T6 Table 1 + feature matrix (official native paths; N/A rules; RQ114 note).
8. Limitations / threats to validity (single machine, dev setup, anvil, not done items).
Every number in the .tex appears in `CLAIM_LEDGER.md` with: source file (repo path), the field or line, and the sha256 of that file at main 595bd45.
A script (`check_ledger.py`) re-reads each source and fails if a ledger value does not match. Numbers without a source are not written.

## 2. Figures (figures/make_figures.py; matplotlib, PDF + PNG; data read from the result files, never typed in)
- F1 lifecycle latency stacked by stage, D = 1..4, steady (T5 e4a_steady.jsonl), with cold-process totals as markers.
- F2 execute gas vs popcount(note index) (T5 rows) with the fitted law, the B0 plaintext lines per D (T6 b0_anvil.json) and verifier-only gas.
- F3 component cost: proving time v6/v7/v8/v9 by D with SD bars (T6 comp_bench.jsonl).
- F4 E2 races: accepted amount vs budget, v7 vs v8 vs v9 (E2 / v9 receipts results).
Tables are generated from the same files where possible (`make_tables.py` → .tex fragments).

## 3. Reproducibility package (REPRODUCE.md + repro/)
- `repro/00_env.sh` versions; `10_build.sh` fresh `npm ci` + compile v9 (D = 1..4), v8 budget circuits, registration, revoke circuit; check
  constraint counts against the expected table and r1cs / wasm sha256 against the reference build.
- `20_fetch.sh`: Hermez ptau (blake2b check) + proving material from a GitHub release `v9-proving-material-20261010` (v9 c1–c4, budget_transfer,
  budget_mint, reg20, rt zkeys + vks + MANIFEST). The release is created from the zkeys actually used by T5/T6 and re-downloaded and hash-checked
  after upload.
- `30_keys.sh`: `snarkjs zkey verify` of every released zkey against the freshly built r1cs + ptau; vk equality with the committed vk files.
- `40_contracts.sh`: `forge test` (expect all pass; 178 tests at 728e64d + any added since).
- `50_core.sh`: short reproductions with fixed seeds: v9 smoke; T3 v9 attack suite (classification counts must equal RESULTS_v9: 114 / 28 / 7 / 21 / 0);
  E6 cases (65 rows as pre-registered); a short T5 E4a (N = 3 per D, timings only reported, not compared).
- Full reruns (hours) are listed per experiment with their RUN_RECORD commands; not part of the clean-build criterion.

## 4. Clean build (success criteria fixed here)
Independent environment = a fresh `git clone` into a new directory outside the working clone, an empty npm cache (`npm ci --cache <new dir>`), no
copied node_modules / build / out directories. Docker is not available on this machine; the OS, compilers (circom 2.2.3, forge, node 24) are the same
binaries — disclosed as a limit.
Pass if:
- C1 all constraint counts equal the expected table;
- C2 r1cs and wasm sha256 equal the reference build;
- C3 every released zkey verifies against the fresh r1cs + ptau and its vk equals the committed vk;
- C4 forge: 0 failures;
- C5 T3 v9 counts and E6 rows equal the recorded results.

Any mismatch is reported with its cause; the criteria are not relaxed after the run.
