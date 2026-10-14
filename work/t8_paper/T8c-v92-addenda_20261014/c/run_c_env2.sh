#!/bin/bash
# T8c item C on RTX6000, in the worktree ~/projects/zk-hada-exp-t8c (the main clone runs E2b), every step at nice 19. Logs: results/c/.
set -uo pipefail
source $HOME/projects/zkhada-tools/env.sh
M=$HOME/projects/zk-hada-exp; T=$HOME/projects/zk-hada-exp-t8c
cd $M && git fetch -q origin && { [ -d $T ] || git worktree add -q $T origin/t8c-v92-addenda; } && cd $T && git checkout -q --detach origin/t8c-v92-addenda
H=$T/work/t8_paper/T8c-v92-addenda_20261014; O=$H/results/c; mkdir -p $O; log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a $O/steps.log; }
cd $M; for d in $(find work -maxdepth 4 -name node_modules -not -path "*/node_modules/*"); do [ -e $T/$d ] || ln -s $M/$d $T/$d; done
ln -sfn ../zkdac_v7/node_modules $T/work/t2_circuit_fix/zkdac_v9_2/node_modules; [ -e $T/work/ptau/hermez/powersOfTau28_hez_final_18.ptau ] || ln -s $M/work/ptau/hermez/powersOfTau28_hez_final_18.ptau $T/work/ptau/hermez/
[ -e $T/work/t4_contracts/foundry/lib ] || ln -s $M/work/t4_contracts/foundry/lib $T/work/t4_contracts/foundry/lib
log "T8c C: worktree $(git -C $T rev-parse --short HEAD) host $(hostname)"
V=$T/work/t2_circuit_fix/zkdac_v9_2; SJ=$T/work/t2_circuit_fix/zkdac_v7/node_modules/.bin/snarkjs; cd $V; declare -A NC=([1]=60629 [2]=105434 [3]=150239 [4]=195044)
for k in 1 2 3 4; do mkdir -p build/c$k; nice -n 19 circom circuits/main_c_d$k.circom --r1cs --wasm --sym -l circuits -l ../zkdac_v7/circuits -l node_modules -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/c$k > $O/circom_c$k.log 2>&1
  info=$($SJ r1cs info build/c$k/main_c_d$k.r1cs 2>/dev/null); n=$(echo "$info" | grep -i '# of Constraints' | awk '{print $NF}'); pi=$(echo "$info" | grep -i '# of Public Inputs' | awk '{print $NF}')
  [ "$n" = "${NC[$k]}" ] && [ "$pi" = "$((16 + k))" ] && log "C1 ok c$k $n constraints, $pi public inputs" || log "C1 FAIL c$k $n / $pi"; done
(cd $V && sha256sum -c $H/c/expected_build_v92_mac.sha256) > $O/C2.txt 2>&1 && log "C2 ok: r1cs and wasm byte-identical to the Mac build" || log "C2 MISMATCH (finding; see C2.txt)"
R=https://github.com/Winston-9527/zk-hada-exp/releases/download/v9.2-proving-material-20261013; Dd=$O/release_v92; mkdir -p $Dd build/zk; curl -fsSL -o $Dd/MANIFEST.sha256 $R/MANIFEST.sha256
for k in 1 2 3 4; do for i in 1 2 3 4 5; do curl -fsSL -o $Dd/v92_c$k.zkey $R/v92_c$k.zkey && break; sleep 20; done
  (cd $Dd && grep " v92_c$k.zkey" MANIFEST.sha256 | sha256sum -c >> $O/release_check.txt 2>&1) && cp $Dd/v92_c$k.zkey build/zk/c$k.zkey || log "C3 FAIL release sha c$k"
  nice -n 19 $SJ zkey verify build/c$k/main_c_d$k.r1cs $T/work/ptau/hermez/powersOfTau28_hez_final_18.ptau build/zk/c$k.zkey > $O/zkey_verify_c$k.log 2>&1 && grep -q "ZKey Ok" $O/zkey_verify_c$k.log && log "C3 zkey ok c$k" || log "C3 FAIL zkey c$k"
  $SJ zkey export verificationkey build/zk/c$k.zkey $O/vk_c$k.json > /dev/null 2>&1
  python3 -c "import json,sys;sys.exit(0 if json.load(open(sys.argv[1]))==json.load(open(sys.argv[2])) else 1)" $O/vk_c$k.json zk/vk_c$k.json && log "C3 vk ok c$k" || log "C3 FAIL vk c$k"; done
cd $T/work/t4_contracts/foundry; nice -n 19 forge build > $O/forge_build.txt 2>&1 || log "C4 FAIL forge build"
nice -n 19 forge test --match-path "test/V92*.t.sol" > $O/forge_test_v92.txt 2>&1; grep -E "Suite result|Ran [0-9]+ test suites" $O/forge_test_v92.txt | tail -4 | tee -a $O/steps.log
nice -n 19 forge test > $O/forge_test_all.txt 2>&1; grep -E "Ran [0-9]+ test suites" $O/forge_test_all.txt | tee -a $O/steps.log
cd $H; nice -n 19 node c/c5_gen.mjs 2000 10 > $O/c5_proofs_env2.json 2> $O/c5_gen.stderr && log "C5 generated $(python3 -c "import json;print(len(json.load(open('$O/c5_proofs_env2.json'))['proofs']))") proofs on env2"
[ -f $H/results/c5_proofs_mac.json ] && nice -n 19 node c/c5_verify.mjs $H/results/c5_proofs_mac.json > $O/c5_verify_mac_on_env2.json && log "C5 Mac proofs on env2: $(cat $O/c5_verify_mac_on_env2.json)"
log "T8c C done"
