#!/bin/bash
# T5c I1: 12 cells x 3 seeds on the Mac (amendment A3), J concurrent runs, resumable.
cd "$(dirname "$0")"; J=${1:-6}; mkdir -p results/runs; jobs=(); i=0
for r in 10 1 0; do for d in 0 1 5 20; do for s in 0 1 2; do jobs+=("$r $d $s $((8800 + i))"); i=$((i + 1)); done; done; done
one() { set -- $1; r=$1 d=$2 s=$3 p=$4; o=results/runs/r$r-d$d; mkdir -p $o; [ -s $o/$s.json ] && return 0
  RATE=$r DEP=$d SEED=$s PORT=$p node t5c.mjs > $o/$s.json.tmp 2> $o/$s.err; e=$?
  if [ $e = 0 ]; then mv $o/$s.json.tmp $o/$s.json; else mv $o/$s.json.tmp $o/$s.failed.json 2>/dev/null; fi
  echo "$(date -u +%H:%M:%S) r$r-d$d $s exit $e" >> results/run_status.txt; }
export -f one; date -u +%FT%H:%M:%S > results/run_start.txt
printf '%s\n' "${jobs[@]}" | xargs -P $J -I{} bash -c 'one "{}"'
date -u +%FT%H:%M:%S >> results/run_start.txt; echo "all done"
