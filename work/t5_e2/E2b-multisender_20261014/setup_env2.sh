#!/bin/bash
# E2b on the second environment (RTX6000): bring the T8b clone to this branch, build what E2b needs, check it. Logs to results/setup/.
# Untracked T8b outputs (copied to the first environment earlier) are MOVED, not deleted, to ~/projects/attempts/untracked_before_e2b/.
set -euo pipefail
source $HOME/projects/zkhada-tools/env.sh
ROOT=$HOME/projects/zk-hada-exp; W=$ROOT/work; H=$W/t5_e2/E2b-multisender_20261014
cd $ROOT
BK=$HOME/projects/attempts/untracked_before_e2b; mkdir -p $BK
git ls-files --others --exclude-standard | while read -r f; do mkdir -p "$BK/$(dirname "$f")"; mv "$f" "$BK/$f"; done
git fetch -q origin && git checkout -q -B e2b-multisender origin/e2b-multisender
mkdir -p $H/results/setup; S=$H/results/setup; log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a $S/steps.log; }
log "commit $(git rev-parse --short HEAD) host $(hostname) node $(node --version) anvil $(anvil --version | head -1)"
SJ=$W/t2_circuit_fix/zkdac_v7/node_modules/.bin/snarkjs
ln -sfn ../zkdac_v7/node_modules $W/t2_circuit_fix/zkdac_v9_2/node_modules
cd $W/t2_circuit_fix/zkdac_v9_2; mkdir -p build/c2 build/zk
circom circuits/main_c_d2.circom --r1cs --wasm --sym -l circuits -l ../zkdac_v7/circuits -l node_modules -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/c2 > $S/circom_v92_c2.log
n=$($SJ r1cs info build/c2/main_c_d2.r1cs 2>/dev/null | grep -i '# of Constraints' | awk '{print $NF}'); [ "$n" = "105434" ] && log "v9.2 c2 constraints 105434 ok" || { log "FAIL v9.2 c2 constraints $n"; exit 1; }
R=https://github.com/Winston-9527/zk-hada-exp/releases/download/v9.2-proving-material-20261013; D=$S/release_v92; mkdir -p $D
for f in MANIFEST.sha256 v92_c2.zkey; do for i in 1 2 3 4 5; do curl -fsSL -o $D/$f $R/$f && break; sleep 20; done; done
(cd $D && grep v92_c2.zkey MANIFEST.sha256 | sha256sum -c) > $S/release_check.txt && log "release v92_c2.zkey sha256 ok" || { log "FAIL release sha256"; exit 1; }
cp $D/v92_c2.zkey build/zk/c2.zkey
$SJ zkey verify build/c2/main_c_d2.r1cs $W/ptau/hermez/powersOfTau28_hez_final_18.ptau build/zk/c2.zkey > $S/zkey_verify_c2.log 2>&1 && grep -q "ZKey Ok" $S/zkey_verify_c2.log && log "zkey verify c2 ok" || { log "FAIL zkey verify"; exit 1; }
$SJ zkey export verificationkey build/zk/c2.zkey $S/vk_c2.json > /dev/null 2>&1
python3 -c "import json,sys;sys.exit(0 if json.load(open(sys.argv[1]))==json.load(open(sys.argv[2])) else 1)" $S/vk_c2.json zk/vk_c2.json && log "vk c2 = committed" || { log "FAIL vk"; exit 1; }
cd $W/t4_contracts/foundry; mkdir -p lib; [ -d lib/forge-std ] || git clone -q --depth 1 --branch v1.17.0 https://github.com/foundry-rs/forge-std lib/forge-std
ln -sfn ../../node_modules/@zk-kit/lean-imt.sol lib/zk-kit-lean-imt
forge build > $S/forge_build.txt 2>&1 && log "forge build ok" || { log "FAIL forge build"; exit 1; }
for c in Groth16VerifierV92CD2 ZkDacGateV9 T7cSumTarget; do ls out/*/$c.json > /dev/null && log "artifact $c ok"; done
log "setup done"
