# Run record: E0-rq108-rebuild
- Date: 2026-10-06; issue #3
- Historical commit: ttwang-szu/ZK-HADA @ 7966d60 (read-only)
- Env: macOS 25.4 arm64, circom 2.2.3 (paper says 2.1.6), snarkjs 0.7.6, circomlib 2.0.5 (tgz sha256 9f80fa85...efe3... see below)
- Command: `HIST=<checkout of 7966d60> ./rebuild.sh`  (runs original generator, unescapes `{{`->`{`, `}}`->`}`, compiles, `snarkjs r1cs info`)
- Result: **46,585 constraints, 4 public, 69 private inputs, 0 outputs** (36,251 non-linear + 10,334 linear). Matches historical `compile_metrics.json` (46,585 / 4 / 69).
- Conclusion: the number 46,585 originates from `write_circuit.py` output with doubled braces unescaped (the generator's templates are raw strings that carry `{{`, so its direct output is not valid Circom). The committed .circom is that unrendered output with a different include path.
- Hash note: circuit sha256 is not reproducible across machines because include paths are absolute (`/home/xyh/...` historically -> recorded d8bfc954...). The R1CS content is what we pin: r1cs sha256 a26c62ff...7d39 (circom 2.2.3).
- Not done: witness / zkey / proof / verify (no historical zkey; needs fresh ptau + setup), so 'source->r1cs' is closed, the rest of the chain is open.
- Claims: supports "RQ108 has 46,585 constraints"; does NOT support paper's 46,593 (still UNSOURCED), nor any security claim (circuit has the T2 vulnerabilities).
Manifest: see rebuild output `build/MANIFEST.sha256` (not committed; r1cs sha256 a26c62ffde3657e41b1c77f583e0f6261400e06fb61796acbe6de8a174857d39, tgz 9f80fa85d9c186589998d15e6dcb8ec59a6ed3fe1ec3cb2f753e493d94dd46b6).

## Correction (same day, see E0-rq108-committed-variant_20261006)
The committed 412-line .circom is NOT the generator's output. Two distinct circuits exist:
- generator variant (335 lines, `enabled` hardwired to 1): 46,585 constraints, 69 private inputs  <- RQ108 compile_metrics
- committed variant (412 lines, 12 private `*_enabled` switches): **46,593 constraints**, 81 private inputs <- the paper's C5 number
So 46,593 is sourced (committed variant) but that variant has the switch vulnerability; it is not the circuit that RQ108's recorded metrics describe.

## Correction (2026-10-07)
"the generator's templates are raw strings that carry `{{`, so its direct output is not valid Circom" is **wrong**: circom 2.2.3 accepts `{{`/`}}` as written.
The 46,585 vs 46,593 split is a version difference (RQ108 @ f494963 vs @ 7966d60/HEAD after commit 11b988b), established with an exact source-hash match in
`work/t1/FINDINGS.md`. The constraint counts and r1cs hashes reported here are unaffected.
