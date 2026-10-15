#!/bin/bash
# T8e S1 setup: Hermez ptau 2^18, one local phase-2 contribution per circuit (dev only, not a trusted setup). Times and sizes -> build/setup.txt
cd "$(dirname "$0")"; SJ=../../../t2_circuit_fix/zkdac_v7/node_modules/.bin/snarkjs; PTAU=../../../ptau/hermez/powersOfTau28_hez_final_18.ptau
for f in circuits/*.circom; do n=$(basename $f .circom); s=$(date +%s)
  $SJ groth16 setup build/$n/$n.r1cs $PTAU build/$n/${n}_0.zkey > build/$n/setup.log 2>&1
  $SJ zkey contribute build/$n/${n}_0.zkey build/$n/$n.zkey --name=dev-local -e="$(head -c 32 /dev/urandom | xxd -p -c 64)" >> build/$n/setup.log 2>&1; rm -f build/$n/${n}_0.zkey
  $SJ zkey export verificationkey build/$n/$n.zkey build/$n/vk.json >> build/$n/setup.log 2>&1
  $SJ zkey export solidityverifier build/$n/$n.zkey build/$n/Verifier.sol >> build/$n/setup.log 2>&1
  echo "$n setup_s=$(( $(date +%s) - s )) zkey_bytes=$(stat -f %z build/$n/$n.zkey 2>/dev/null || stat -c %s build/$n/$n.zkey)" | tee -a build/setup.txt; done
