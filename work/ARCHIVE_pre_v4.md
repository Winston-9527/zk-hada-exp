# Archive note: v3 superseded by v4 — 2026-10-08
Decision #24: the main circuit's revocation check changes from circomlib SMT (RD=16) to an indexed Merkle tree (depth 20) → `t2_circuit_fix/zkdac_v4`.
Nothing was moved or deleted. v3 evidence stays where it is:
| item | location |
|---|---|
| v3 circuit, generator, T2 results | `t2_circuit_fix/zkdac_v3` (RUN_RECORD.md, results/) |
| v3 T3 results | `t3_attacks/v3` (RESULTS_v3.md, results/) |
| SMT vs IMT measurements (why v3 was replaced) | `t2_circuit_fix/revocation_imt` (RUN_RECORD.md, results/) — PR #25 |
| v3 D=2 proving key | identical circuit body to layout C → `layoutC_d2.zkey` in release `archive-pre-v3-20261007` |
Earlier designs: see `ARCHIVE_pre_v3.md`.
