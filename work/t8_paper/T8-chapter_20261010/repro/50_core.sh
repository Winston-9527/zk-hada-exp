#!/bin/bash
# T8 repro step 5 (C5): deterministic re-runs compared with the recorded results — T3 v9 classification counts and exhaustive diff, E6 case rows.
# Outputs go to $OUT (never into the experiment directories).
source "$(dirname "$0")/common.sh"
fail=0
cd $W/t2_circuit_fix/zkdac_v9 && node scripts/smoke.mjs > "$OUT/v9_smoke.txt" 2>&1 && log "v9 smoke ok" || { log "v9 smoke FAIL"; fail=1; }
cd $W/t3_attacks && node v9/attacks_v9.mjs > "$OUT/attacks_v9.json" 2> "$OUT/attacks_v9.stderr" || fail=1
node v9/exhaustive_diff_v9.mjs 4 > "$OUT/exhaustive_diff_v9_d4.json" 2> "$OUT/exhaustive_diff_v9_d4.stderr" || fail=1
cd $W/t4_accountability/E6-threshold-opening_20261009 && node cases.mjs > "$OUT/e6_cases.json" 2> "$OUT/e6_cases.stderr" || fail=1
python3 "$REPRO/compare_core.py" "$W" "$OUT" | tee "$OUT/C5.txt" || fail=1
grep -q FAIL "$OUT/C5.txt" && fail=1; log "50_core done fail=$fail"; exit $fail
