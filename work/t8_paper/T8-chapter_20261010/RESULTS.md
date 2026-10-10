# T8 — experiment chapter, figures, reproducibility package, clean build (issue #10) — results
Plan: `PLAN.md` (f5675a9, committed before writing the chapter or running the clean build).

## Deliverables
| item | file |
|---|---|
| Experiments chapter (standalone LaTeX for party A to `\input`; paper.tex not edited) | `experiments.tex` |
| Artifact appendix | `appendix_repro.tex` |
| Every number as a macro generated from the result files | `numbers.tex` ← `make_numbers.py` |
| Claim ledger: macro → value → source file, field, sha256; design parameters listed separately | `CLAIM_LEDGER.md` |
| Figures from data (F1 latency by stage, F2 gas vs note index with B0 / verifier lines, F3 component cost); palette validated with the dataviz validator | `figures/make_figures.py` → `figures/*.pdf, *.png` |
| Preview (two-column, compiles with no warnings) | `preview.tex` → `preview.pdf` |
| Reproduction guide + scripts | `REPRODUCE.md`, `repro/00–50*.sh`, `repro/compare_core.py`, `repro/expected_*` |
| Proving material release (8 zkeys + vks), re-downloaded and verified | GitHub release `v9-proving-material-20261010` (16 / 16 sha256 OK) |

## Clean build (criteria fixed in PLAN.md §4) — PASS
- **Environment.** Fresh `git clone` of branch t8-chapter into `~/Developer/zk-hada-exp-cleanbuild3`, empty npm cache, ptau and keys downloaded fresh.
  Same machine and tool binaries; Docker is not available (disclosed).
- **Result** (`cleanbuild/attempt3_pass.log`, `cleanbuild/attempt3_out/`):
  - **C1** all 8 constraint counts equal;
  - **C2** all 16 r1cs / wasm files byte-identical to the reference build;
  - **C3** all 8 released zkeys verify against the fresh r1cs and the right ptau, and every exported vk equals the committed vk;
  - **C4** forge 178 / 178;
  - **C5** T3 v9 summary and all 170 per-row classes, the exhaustive diff (534 / 89 / 3 statement-level) and all 65 E6 rows equal the recorded results.

**Attempts** (all logs kept in `cleanbuild/`). The criteria were not changed; each fix is to the repro scripts or to which ptau a key is checked against.
1. `attempt1_missing_output_dir.log`: circom needs an existing `-o` directory, and `build/` is not in git.
   - Fixed in 10_build.sh.
   - In the same run forge already passed.
2. `attempt2_missing_deps_and_network.log`:
   - **reproducibility gap**: the v9 scripts import the v2..v6 libraries (and T3 its own package), whose `node_modules` existed only in the working
     clone. Fixed by `npm ci` of every lockfile directory.
   - A TLS timeout aborted the release download; retries were added.
   - E6 already matched.
3. `attempt3_pass.log`: C1, C2, C4 and C5 passed; C3 failed for `reg20` only.
   - **Finding:** the registration key was set up on the *local dev ptau 2^17* (t4_registration/RUN_RECORD.md), not on Hermez. It verifies against
     that file (`dev_pot17.ptau` from release v4, sha256 equal to the local file).
   - 30_keys.sh now uses the correct ptau for reg20. Steps 20 and 30 were re-run in the same clean clone after `git pull` of the fix: C3 pass.

**Consequence for the paper.** The setup statement now says that phase 1 is Hermez for the action, budget and revocation circuits, but a locally
generated file for the registration circuit (`experiments.tex` §Setup, `appendix_repro.tex`).

## Deviations from PLAN.md
- **F4** (E2 races as a figure) was dropped. It would be two bars; the numbers are in the text (§Budget) instead.
- **Ledger check.** PLAN.md planned a separate `check_ledger.py`. Instead, every number is *generated* from its source by `make_numbers.py`, which
  fails on a missing file or field. This is stronger: there is no hand-typed value to check.
- **C5** compared T3, the exhaustive diff and E6 as planned. The short T5 timing run was not part of the criteria and was not run.
- **One unsupported sentence was removed while drafting.** It read "all spending stayed within the minted amount" for the T5 world, and T5 did not
  check that.

## Not done
- No Docker / other-OS build.
- No full re-run of the multi-hour experiments in the clean clone (REPRODUCE.md lists them).
- The chapter is not merged into paper.tex (party A's file).
