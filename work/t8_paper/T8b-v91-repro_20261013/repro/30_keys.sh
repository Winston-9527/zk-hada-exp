#!/bin/bash
# T8b step 3 (C3): every released zkey verifies against the r1cs built in THIS environment + ptau; exported vk == committed vk
source "$(dirname "$0")/common.sh"
fail=0
chk() { local r1cs=$1 zkey=$2 vk=$3 name=$4 ptau=${5:-$PTAU}
  if $SJ zkey verify $r1cs "$ptau" $zkey > "$OUT/zkey_verify_$name.log" 2>&1 && grep -q "ZKey Ok" "$OUT/zkey_verify_$name.log"; then echo "C3 zkey ok $name"; else echo "C3 FAIL zkey $name"; fi
  $SJ zkey export verificationkey $zkey "$OUT/vk_$name.json" > /dev/null 2>&1
  if python3 -c "import json,sys;sys.exit(0 if json.load(open(sys.argv[1]))==json.load(open(sys.argv[2])) else 1)" "$OUT/vk_$name.json" $vk; then echo "C3 vk ok $name"; else echo "C3 FAIL vk $name"; fi; }
{ for D in 1 2 3 4; do chk $W/t2_circuit_fix/zkdac_v9_1/build/c$D/main_c_d$D.r1cs $W/t2_circuit_fix/zkdac_v9_1/build/zk/c$D.zkey $W/t2_circuit_fix/zkdac_v9_1/zk/vk_c$D.json v91_c$D; done
  for D in 1 2 3 4; do chk $W/t2_circuit_fix/zkdac_v9/build/c$D/main_c_d$D.r1cs $W/t2_circuit_fix/zkdac_v9/build/zk/c$D.zkey $W/t2_circuit_fix/zkdac_v9/zk/vk_c$D.json v9_c$D; done
  chk $W/t2_circuit_fix/zkdac_v8/build/budget_transfer/budget_transfer.r1cs $W/t2_circuit_fix/zkdac_v8/build/zk/budget_transfer.zkey $W/t2_circuit_fix/zkdac_v8/zk/vk_budget_transfer.json budget_transfer
  chk $W/t2_circuit_fix/zkdac_v8/build/budget_mint/budget_mint.r1cs $W/t2_circuit_fix/zkdac_v8/build/zk/budget_mint.zkey $W/t2_circuit_fix/zkdac_v8/zk/vk_budget_mint.json budget_mint
  chk $W/t4_registration/build/r20/main_reg_20.r1cs $W/t4_registration/build/zk/reg20.zkey $W/t4_registration/zk/vk_reg20.json reg20 $W/ptau/pot17_final.ptau
  chk $W/t4_obligations/E7-obligations_20261009/revoke/build/revoke_transition.r1cs $W/t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey $W/t4_obligations/E7-obligations_20261009/revoke/zk/vk_rt.json revoke
} | tee "$OUT/C3.txt"
grep -q FAIL "$OUT/C3.txt" && fail=1; log "30_keys done fail=$fail"; exit $fail
