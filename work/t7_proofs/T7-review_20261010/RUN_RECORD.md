# Run record: T7 (#9)
Date 2026-10-10. Apple M5 Pro. elan 4.2.4 (Homebrew `elan-init`, installed for this task), Lean v4.31.0-rc2 (from the project's lean-toolchain),
mathlib 261b5e31 via `lake exe cache get` (attempt 1 failed on a network error: cache_get_run1_network_error.log; attempt 2 ok: cache_get.log).
`mech_copy/` = unmodified copy of ZK-HADA mechanization/ @ 7966d60 (diff -r identical; .lake/ git-ignored, 7.6 GB).
Commands (from mech_copy/): `lake build > ../L1_build.log` (exit 1: TNFF fails); `lake env lean ../Audit.lean > ../Audit_output.txt` (exit 0);
L2: `grep -n -E "^axiom|^\s*sorry|:= 0$|PrWin : ℝ :=|PMF.pure" ZkHada/*.lean > ../L2_inventory.txt`.
