#!/bin/bash
# E2b: all 16 cells x 30 seeds, J concurrent runs (each its own anvil), biggest cells first; resumable (a run with a non-empty JSON is skipped).
# usage (second environment): nohup bash run_all.sh 16 > results/run_all.log 2>&1 &
source $HOME/projects/zkhada-tools/env.sh 2>/dev/null || true
cd "$(dirname "$0")"; J=${1:-16}; mkdir -p results/runs
jobs=(); i=0
for k in 128 32 8 1; do for c in A B; do for b in 1 2; do for s in $(seq 0 29); do jobs+=("$c $k $b $s $((9000 + i))"); i=$((i + 1)); done; done; done; done
one() { set -- $1; c=$1 k=$2 b=$3 s=$4 p=$5; d=results/runs/$c-k$k-b$b; mkdir -p $d
  [ -s $d/$s.json ] && return 0
  COND=$c K=$k BLK=$b SEED=$s PORT=$p node e2b.mjs > $d/$s.json.tmp 2> $d/$s.err; e=$?
  if [ $e = 0 ]; then mv $d/$s.json.tmp $d/$s.json; else mv $d/$s.json.tmp $d/$s.failed.json 2>/dev/null; fi
  echo "$(date -u +%H:%M:%S) $c-k$k-b$b $s exit $e" >> results/run_status.txt; }
export -f one
date -u +%FT%H:%M:%S > results/run_start.txt
printf '%s\n' "${jobs[@]}" | xargs -P $J -I{} bash -c 'one "{}"'
date -u +%FT%H:%M:%S >> results/run_start.txt; echo "all done"
