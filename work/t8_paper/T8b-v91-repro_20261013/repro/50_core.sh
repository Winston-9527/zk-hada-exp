#!/bin/bash
# T8b step 5 (C5): deterministic re-runs compared with the recorded first-environment results — v9.1 smoke, T3 v9.1 (every row: class and failure
# location), exhaustive diff v9.1 D=4, E6 (v7) case rows. Outputs go to $OUT (never into the experiment directories).
source "$(dirname "$0")/common.sh"
fail=0
cd $W/t2_circuit_fix/zkdac_v9_1 && node scripts/smoke.mjs > "$OUT/v91_smoke.txt" 2>&1 && log "v9.1 smoke ran" || { log "v9.1 smoke FAIL"; fail=1; }
cd $W/t3_attacks && node v9_1/attacks_v9_1.mjs > "$OUT/attacks_v9_1.json" 2> "$OUT/attacks_v9_1.stderr" || fail=1
node v9_1/exhaustive_diff_v9_1.mjs 4 > "$OUT/exhaustive_diff_v9_1_d4.json" 2> "$OUT/exhaustive_diff_v9_1_d4.stderr" || fail=1
cd $W/t4_accountability/E6-threshold-opening_20261009 && node cases.mjs > "$OUT/e6_cases.json" 2> "$OUT/e6_cases.stderr" || fail=1
python3 "$REPRO/compare_core_v91.py" "$W" "$OUT" | tee "$OUT/C5.txt" || fail=1
grep -q FAIL "$OUT/C5.txt" && fail=1; log "50_core done fail=$fail"; exit $fail
