# E7d — v9.2 proofs on the real gate (zkdac_v9_2/PREREGISTRATION.md check 7): results
Local, 2026-10-13, forge 1.5.1. The E7c suites with the V92 verifiers and fixtures generated from the v9.2 circuit (paths only), plus the F-2 contrast.
- **75 / 75 tests pass:**
  - V92 history: 11;
  - V92Policy: 34;
  - V92Batch: 28, i.e. B1–B6 and G7 at N = 30 per D, with the same per-case counts as E7c;
  - F-2: 2.
- **F-2 on the gate:** identity-holder proofs (D = 2, 4; holder O registered and issued; holder_sk = 0), made with the v9.1 circuit, are **accepted by a v9.1 gate** (`F2v91`) and **rejected by the v9.2 gate** (`F2v92`, InvalidProof). v9.2 cannot produce a witness for them (L204).
- B1 execute gas at D = 4 (excluding intrinsic and calldata): median 505,691, p95 625,361. This equals E7c, as expected for an unchanged verifier structure.
- The full forge suite after adding the V92 files: 42 suites, **367 / 367** (`results/forge_all.txt`).

Files:
- `results/forge_v92.txt`, `results/summary.json`;
- `results/fixtures.sha256` (fixtures in `foundry/test/fixtures_V92*.json`, `fixtures_V92_batch/`);
- `results/gen_*.stderr`.

The generator variable `V91` points to zkdac_v9_2 (see zkdac_v9_2/RESULTS.md, deviations).
