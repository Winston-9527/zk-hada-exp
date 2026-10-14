#!/bin/bash
# T5d: 12 worlds on the Mac (amendment A1), J concurrent, resumable.
cd "$(dirname "$0")"; J=${1:-3}; mkdir -p results/worlds; jobs=(); i=0
for s in 30 10; do for r in 10 1; do for e in 0 1 2; do jobs+=("$s $r $e $((8900 + i))"); i=$((i + 1)); done; done; done
one() { set -- $1; s=$1 r=$2 e=$3 p=$4; o=results/worlds/s$s-r$r-$e; [ -s $o.json ] && return 0
  S=$s R=$r SEED=$e PORT=$p node t5d.mjs > $o.json.tmp 2> $o.err; x=$?
  if [ $x = 0 ]; then mv $o.json.tmp $o.json; else mv $o.json.tmp $o.failed.json 2>/dev/null; fi
  echo "$(date -u +%H:%M:%S) s$s-r$r-$e exit $x" >> results/run_status.txt; }
export -f one; date -u +%FT%H:%M:%S > results/run_start.txt
printf '%s\n' "${jobs[@]}" | xargs -P $J -I{} bash -c 'one "{}"'
date -u +%FT%H:%M:%S >> results/run_start.txt; echo "all done"
