#!/bin/bash
# T8 repro step 2: Hermez ptau (blake2b check against the snarkjs README value) + proving material release (sha256 check) into the paths the scripts use
source "$(dirname "$0")/common.sh"
TAG=v9-proving-material-20261010; R=Winston-9527/zk-hada-exp; D=$OUT/release; mkdir -p $D
if [ ! -f "$PTAU" ]; then log "download ptau"; mkdir -p "$(dirname "$PTAU")"; curl -fL -o "$PTAU" https://circom.info/powersOfTau28_hez_final_18.ptau; fi
b2=$(python3 -c "import hashlib,sys;h=hashlib.blake2b();f=open(sys.argv[1],'rb');[h.update(c) for c in iter(lambda:f.read(1<<20),b'')];print(h.hexdigest())" "$PTAU")
[ "$b2" = "$(awk '{print $1}' $W/ptau/hermez/EXPECTED_BLAKE2B.txt)" ] && log "ptau blake2b ok" || { log "ptau blake2b FAIL"; exit 1; }
log "download release $TAG"; (cd $D && gh release download $TAG -R $R --clobber && shasum -a 256 -c MANIFEST.sha256 > ../release_check.txt) && log "release sha256 ok" || { log "release FAIL"; exit 1; }
for k in 1 2 3 4; do mkdir -p $W/t2_circuit_fix/zkdac_v9/build/zk; cp $D/v9_c$k.zkey $W/t2_circuit_fix/zkdac_v9/build/zk/c$k.zkey; done
mkdir -p $W/t2_circuit_fix/zkdac_v8/build/zk $W/t4_registration/build/zk $W/t4_obligations/E7-obligations_20261009/revoke/build/zk
cp $D/v8_budget_transfer.zkey $W/t2_circuit_fix/zkdac_v8/build/zk/budget_transfer.zkey; cp $D/v8_budget_mint.zkey $W/t2_circuit_fix/zkdac_v8/build/zk/budget_mint.zkey
cp $D/reg20.zkey $W/t4_registration/build/zk/reg20.zkey; cp $D/revoke_rt.zkey $W/t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey
log "20_fetch done"
