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
