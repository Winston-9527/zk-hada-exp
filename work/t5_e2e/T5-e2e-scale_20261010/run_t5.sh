#!/bin/bash
# T5 driver (PREREGISTRATION.md): one anvil for the whole run, then world -> issuance bench -> E4a steady (3 blocks) -> E4a cold (40 processes) -> E4b.
# Every node process runs under /usr/bin/time -l (peak RSS in its stderr). Exit codes go to results/logs/steps.txt. usage: ./run_t5.sh
set -u; cd "$(dirname "$0")"; mkdir -p state results/logs; export T5_PORT=8560
anvil --port 8560 --chain-id 31337 --hardfork prague --gas-limit 30000000 --silent --state state/anvil_state.json --state-interval 120 > results/logs/anvil.log 2>&1 &
ANVIL=$!; trap 'kill $ANVIL' EXIT; sleep 3
S=results/logs/steps.txt; echo "start $(date -u +%FT%TZ) anvil $(anvil --version | head -1)" >> $S
step() { local name=$1; shift; /usr/bin/time -l "$@" > results/$name.json 2> results/logs/$name.stderr; local rc=$?; echo "$name exit $rc $(date -u +%T)" >> $S; return $rc; }
step world_build node build_world.mjs || exit 1
step issuance_bench node issuance_bench.mjs
node e4a.mjs plan > results/e4a_plan.json
for b in 1 2 3; do /usr/bin/time -l node e4a.mjs steady $b 2> results/logs/steady_$b.stderr; echo "steady $b exit $? $(date -u +%T)" >> $S; done
for s in $(seq 0 39); do /usr/bin/time -l node e4a.mjs cold $s 2> results/logs/cold_$s.stderr; echo "cold $s exit $? $(date -u +%T)" >> $S; done
step e4b_epoch1 node e4b_epoch1.mjs
step e4b_revoke_1 node e4b_revoke.mjs 1
step e4b_revoke_10 node e4b_revoke.mjs 10
echo "end $(date -u +%FT%TZ)" >> $S
