#!/bin/bash
# T5c I2: 12 cells x 3 seeds, J concurrent runs, biggest first, resumable.
source $HOME/projects/zkhada-tools/env.sh 2>/dev/null || true
cd "$(dirname "$0")"; J=${1:-8}; mkdir -p results/i2/runs; jobs=(); i=0
for k in 128 32 8 1; do for f in 32 8 1; do for s in 0 1 2; do jobs+=("$f $k $s $((8700 + i))"); i=$((i + 1)); done; done; done
one() { set -- $1; f=$1 k=$2 s=$3 p=$4; o=results/i2/runs/f$f-k$k; mkdir -p $o; [ -s $o/$s.json ] && return 0
  F=$f K=$k SEED=$s PORT=$p node i2.mjs > $o/$s.json.tmp 2> $o/$s.err; e=$?
  if [ $e = 0 ]; then mv $o/$s.json.tmp $o/$s.json; else mv $o/$s.json.tmp $o/$s.failed.json 2>/dev/null; fi
  echo "$(date -u +%H:%M:%S) f$f-k$k $s exit $e" >> results/i2/run_status.txt; }
export -f one; date -u +%FT%H:%M:%S > results/i2/run_start.txt
printf '%s\n' "${jobs[@]}" | xargs -P $J -I{} bash -c 'one "{}"'
date -u +%FT%H:%M:%S >> results/i2/run_start.txt; echo "all done"
