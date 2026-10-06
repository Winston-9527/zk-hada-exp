# work/

All code for the ZK-HADA experiments lives here (circuits, reference model, scripts, benchmarks).

Rules:
- New experiments go in new, versioned subdirectories; never overwrite earlier evidence.
- Record commands, environment, input, source commit and results (including failures).
- Do not commit private keys, large binaries (.zkey/.ptau/.r1cs) or generated build output; record their SHA-256 instead.

Upstream historical workspace (read-only reference): ttwang-szu/ZK-HADA @ 7966d60.
