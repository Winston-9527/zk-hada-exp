#!/bin/bash
# E8 full run: A1, A2, A3 x 30 seeds, J concurrent, resumable. Ports: anvil 8840 + 2i (A1's gateway: anvil port + 1000).
source $HOME/projects/zkhada-tools/env.sh 2>/dev/null || true
cd "$(dirname "$0")"; J=${1:-12}; mkdir -p results; jobs=(); i=0
for a in A3 A1 A2; do for s in $(seq 0 29); do jobs+=("$a $s $((8840 + 2 * i))"); i=$((i + 1)); done; done
one() { set -- $1; a=$1 s=$2 p=$3; d=results/$a; mkdir -p $d; [ -s $d/$s.json ] && return 0
  f=$(echo $a | tr A a); SEED=$s PORT=$p node $f.mjs > $d/$s.json.tmp 2> $d/$s.err; e=$?
  if [ $e = 0 ]; then mv $d/$s.json.tmp $d/$s.json; else mv $d/$s.json.tmp $d/$s.failed.json 2>/dev/null; fi
  echo "$(date -u +%H:%M:%S) $a $s exit $e" >> results/run_status.txt; }
export -f one; date -u +%FT%H:%M:%S > results/run_start.txt
printf '%s\n' "${jobs[@]}" | xargs -P $J -I{} bash -c 'one "{}"'
date -u +%FT%H:%M:%S >> results/run_start.txt; echo "all done"
