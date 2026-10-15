#!/bin/bash
# T8d R3: scaled-down T5 on v9.2 (t5s/). One anvil, then world -> E4a steady x3 -> E4b epoch 1 -> E4b revocation 1 % and 10 %. usage: bash run_t5s.sh <out dir> [port]
source $HOME/projects/zkhada-tools/env.sh 2>/dev/null || true
H=$(cd "$(dirname "$0")" && pwd); O=$(cd "$1" 2>/dev/null || mkdir -p "$1"; cd "$1"; pwd); P=${2:-8561}; mkdir -p $O/state $O/results/logs
export T5_PORT=$P T5_STATE=$O/state/ T5_RES=$O/results/ T5_NM=8 T5_FAN=4
anvil --port $P --chain-id 31337 --hardfork prague --gas-limit 30000000 --silent > $O/results/logs/anvil.log 2>&1 & A=$!; trap 'kill $A' EXIT; sleep 3
S=$O/results/logs/steps.txt; echo "start $(date -u +%FT%TZ) host $(hostname) anvil $(anvil --version | head -1)" >> $S; cd $H/t5s
step() { local n=$1; shift; "$@" > $O/results/$n.json 2> $O/results/logs/$n.stderr; local rc=$?; echo "$n exit $rc $(date -u +%T)" >> $S; return $rc; }
step world_build node build_world.mjs || exit 1
node e4a.mjs plan > $O/results/e4a_plan.json
for b in 1 2 3; do node e4a.mjs steady $b 2> $O/results/logs/steady_$b.stderr; echo "steady $b exit $? $(date -u +%T)" >> $S; done
step e4b_epoch1 node e4b_epoch1.mjs
step e4b_revoke_1 node e4b_revoke.mjs 1
step e4b_revoke_10 node e4b_revoke.mjs 10
echo "end $(date -u +%FT%TZ)" >> $S
