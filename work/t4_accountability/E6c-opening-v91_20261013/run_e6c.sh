#!/bin/bash
# E6c run (second environment): fixtures for every committee (parallel, one process per file), then the cases. Needs T8b steps 10-30 and E7c (O20/O21).
set -euo pipefail
E=$(cd "$(dirname "$0")" && pwd); R=$E/results; mkdir -p $R; cd $E
{ echo "host $(hostname) $(uname -sm)"; date -u; } > $R/run_info.txt
s=$(date +%s)
node fixtures_v91.mjs 2 3 1 "1 2 3 4" ${N:-30} 2> $R/fixtures_t2n3_e1.stderr & p1=$!
node fixtures_v91.mjs 3 5 1 "1 2 3 4" ${N:-30} 2> $R/fixtures_t3n5_e1.stderr & p2=$!
node fixtures_v91.mjs 5 9 1 "1 2 3 4" ${N:-30} 2> $R/fixtures_t5n9_e1.stderr & p3=$!
node fixtures_v91.mjs 3 5 2 "1 2 3 4" ${N2:-10} 2> $R/fixtures_t3n5_e2.stderr & p4=$!
wait $p1 $p2 $p3 $p4; echo "fixtures $(( $(date +%s) - s ))s" >> $R/run_info.txt
s=$(date +%s); node cases_v91.mjs > $R/cases.json 2> $R/cases.stderr; echo "cases $(( $(date +%s) - s ))s" >> $R/run_info.txt
tail -n 1 $R/cases.stderr
