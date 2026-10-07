# T1 finding 001: static audit of historical RQ108 (issue #3)
Source: `ttwang-szu/ZK-HADA @ 7966d60`. Static inspection only; no rebuild yet. Date 2026-10-06.

| # | Observation | Evidence | Consequence |
|---|---|---|---|
| 1 | Committed `circuits/RQ108/dmax4_delegation_chain.circom` sha256 = `0921dbf1...8a8d90d`; `runs/RQ108/artifacts/compile_metrics.json` records `circuit_sha256 = d8bfc954...a1260b`. | `shasum -a 256`, compile_metrics.json | The 46,585 compile result was not produced from the committed file. |
| 2 | Committed file contains Python-format `{{`/`}}` (lines 7, 29, 54, 61), i.e. template output that was never rendered. | `grep -n '{{'` | Not valid Circom as committed. |
| 3 | Includes point at `./circomlib_shared/...`; generator `write_circuit.py` uses absolute `runs/RQ104/.../circomlib-2.0.5` paths. | circuit lines 2-4, write_circuit.py | Source is not self-contained; circomlib 2.0.5 must be re-fetched. |
| 4 | `runs/RQ108/artifacts` has no r1cs/zkey/witness, `runs/RQ112` only claim_ledger.json, `runs/RQ116` only c4_e2e_benchmark.json. | `ls` | Build chain source->r1cs->zkey->proof cannot be hashed end to end. |
| 5 | Paper Table 1/3 numbers (46,593; 235,891 gas; 1.51 s) have no matching artifact; RQ108 gives 46,585 constraints, gas 215,598. | issue #1 + compile_metrics.json | Mark UNSOURCED until reproduced. |

Local tool versions: circom 2.2.3 (paper says 2.1.6), snarkjs 0.7.6. Version drift to be recorded in T1 rebuild.

Next: render the template (`write_circuit.py` with unescaped braces), fetch circomlib 2.0.5, compile, recompute constraints from the r1cs.

## Correction (2026-10-07)
Row 2 is **wrong**. circom 2.2.3 compiles the committed file with the literal `{{`/`}}` unchanged (verified: raw file + circomlib 2.0.5 in `./circomlib_shared/`
-> 46,593 constraints, 36,275 non-linear + 10,318 linear, identical to the brace-replaced build). I never compiled the raw file before making the claim.
The `sed` brace replacement in E0-rq108-rebuild and E0-rq108-committed-variant is unnecessary but harmless (same R1CS).
Row 1's explanation is superseded by `work/t1/FINDINGS.md` (parallel T1 work on main): the recorded `circuit_sha256 d8bfc954…` is exactly the RQ108 file at
commit f494963 (2026-06-07), i.e. the 46,585 circuit is a different *version*, not a rendering artefact; the difference is not only include paths.
