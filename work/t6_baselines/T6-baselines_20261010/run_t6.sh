#!/bin/bash
# T6 driver (PREREGISTRATION.md): runs every measurement sequentially on this machine (nothing else heavy in parallel). usage: ./run_t6.sh
set -u; cd "$(dirname "$0")"; mkdir -p results/logs; S=results/logs/steps.txt; echo "start $(date -u +%FT%TZ)" >> $S
step() { local name=$1; shift; /usr/bin/time -l "$@" > results/$name 2> results/logs/$name.stderr; echo "$name exit $? $(date -u +%T)" >> $S; }
(cd bench_ucan && go build -o ../results/logs/ucan_bench_bin .) && step ucan_bench.json results/logs/ucan_bench_bin 30
DYLD_LIBRARY_PATH=$(brew --prefix openssl@3)/lib step dac_bench.json vendor/dacenv/bin/python bench_dac.py 30
(cd vendor/zkcreds-rs && /usr/bin/time -l cargo bench --bench t6_micro -- "Expiry show" > ../../results/zkcreds_expiry.txt 2> ../../results/logs/zkcreds_expiry.stderr; echo "zkcreds_expiry exit $? $(date -u +%T)" >> ../../$S
  mkdir -p ../../results/zkcreds_criterion && for d in target/criterion/Expiry*; do n=$(basename "$d"); cp "$d/new/estimates.json" "../../results/zkcreds_criterion/$n.json"; done; cp proof_sizes.csv ../../results/zkcreds_proof_sizes.csv)
step b0_anvil.json node b0_anvil.mjs
for b in 1 2 3; do /usr/bin/time -l node comp_bench.mjs $b >> results/comp_bench.jsonl 2> results/logs/comp_bench_$b.stderr; echo "comp_bench $b exit $? $(date -u +%T)" >> $S; done
echo "end $(date -u +%FT%TZ)" >> $S
