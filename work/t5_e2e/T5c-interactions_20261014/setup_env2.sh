#!/bin/bash
# T5c on RTX6000: separate worktree ~/projects/zk-hada-exp-t5c (E2b runs in the main clone; never switch its branch).
# node_modules and build outputs are symlinked from the main clone; v9.2 c1/c3/c4 are built there and their zkeys fetched from the release.
set -euo pipefail
source $HOME/projects/zkhada-tools/env.sh
M=$HOME/projects/zk-hada-exp; T=$HOME/projects/zk-hada-exp-t5c
cd $M && git fetch -q origin && { [ -d $T ] || git worktree add -q $T origin/t5c-interactions; } && cd $T && git checkout -q --detach origin/t5c-interactions
H=$T/work/t5_e2e/T5c-interactions_20261014; S=$H/results/setup; mkdir -p $S; log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a $S/steps.log; }
log "worktree $(git rev-parse --short HEAD) host $(hostname)"
cd $M; for d in $(find work -maxdepth 4 -name node_modules -not -path "*/node_modules/*"); do [ -e $T/$d ] || ln -s $M/$d $T/$d; done
for d in t4_contracts/foundry/out t2_circuit_fix/zkdac_v9_2/build t2_circuit_fix/zkdac_v8/build t4_obligations/E7-obligations_20261009/revoke/build t4_registration/build ptau/hermez; do [ -e $T/work/$d ] || ln -s $M/work/$d $T/work/$d; done
SJ=$M/work/t2_circuit_fix/zkdac_v7/node_modules/.bin/snarkjs; V=$M/work/t2_circuit_fix/zkdac_v9_2; cd $V
declare -A NC=([1]=60629 [3]=150239 [4]=195044)
R=https://github.com/Winston-9527/zk-hada-exp/releases/download/v9.2-proving-material-20261013; D=$S/release_v92; mkdir -p $D
curl -fsSL -o $D/MANIFEST.sha256 $R/MANIFEST.sha256
for k in 1 3 4; do
  if [ ! -f build/c$k/main_c_d${k}_js/main_c_d$k.wasm ]; then mkdir -p build/c$k; circom circuits/main_c_d$k.circom --r1cs --wasm --sym -l circuits -l ../zkdac_v7/circuits -l node_modules -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/c$k > $S/circom_c$k.log; fi
  n=$($SJ r1cs info build/c$k/main_c_d$k.r1cs 2>/dev/null | grep -i '# of Constraints' | awk '{print $NF}'); [ "$n" = "${NC[$k]}" ] && log "c$k constraints $n ok" || { log "FAIL c$k constraints $n"; exit 1; }
  for i in 1 2 3 4 5; do curl -fsSL -o $D/v92_c$k.zkey $R/v92_c$k.zkey && break; sleep 20; done
  (cd $D && grep " v92_c$k.zkey" MANIFEST.sha256 | sha256sum -c >> $S/release_check.txt) && cp $D/v92_c$k.zkey build/zk/c$k.zkey && log "zkey c$k sha256 ok"
  $SJ zkey export verificationkey build/zk/c$k.zkey $S/vk_c$k.json > /dev/null 2>&1
  python3 -c "import json,sys;sys.exit(0 if json.load(open(sys.argv[1]))==json.load(open(sys.argv[2])) else 1)" $S/vk_c$k.json zk/vk_c$k.json && log "vk c$k = committed" || { log "FAIL vk c$k"; exit 1; }
done
log "setup done"
