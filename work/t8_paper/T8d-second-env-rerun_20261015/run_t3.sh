#!/bin/bash
# T8d R1: T3 v9.1 and v9.2 (unchanged scripts) in this environment. usage: bash run_t3.sh <out dir>
source $HOME/projects/zkhada-tools/env.sh 2>/dev/null || true
H=$(cd "$(dirname "$0")" && pwd); O=$1; mkdir -p $O; cd $H/../../t3_attacks
for v in v9_1 v9_2; do node $v/attacks_$v.mjs > $O/attacks_$v.json 2> $O/attacks_$v.stderr; echo "attacks $v exit $?" >> $O/steps.txt
  node $v/exhaustive_diff_$v.mjs 4 > $O/exhaustive_diff_${v}_d4.json 2> $O/exhaustive_diff_${v}_d4.stderr; echo "exhaustive $v exit $?" >> $O/steps.txt; done
