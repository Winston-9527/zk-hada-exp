#!/bin/bash
# T8 repro step 2: Hermez ptau (blake2b check against the snarkjs README value) + proving material release (sha256 check) into the paths the scripts use
source "$(dirname "$0")/common.sh"
TAG=v9-proving-material-20261010; R=Winston-9527/zk-hada-exp; D=$OUT/release; mkdir -p $D
if [ ! -f "$PTAU" ]; then log "download ptau"; mkdir -p "$(dirname "$PTAU")"; curl -fL -o "$PTAU" https://circom.info/powersOfTau28_hez_final_18.ptau; fi
b2=$(python3 -c "import hashlib,sys;h=hashlib.blake2b();f=open(sys.argv[1],'rb');[h.update(c) for c in iter(lambda:f.read(1<<20),b'')];print(h.hexdigest())" "$PTAU")
[ "$b2" = "$(awk '{print $1}' $W/ptau/hermez/EXPECTED_BLAKE2B.txt)" ] && log "ptau blake2b ok" || { log "ptau blake2b FAIL"; exit 1; }
log "download release $TAG"; ok=0   # attempt 2: a single TLS timeout aborted the download -> retry
for i in 1 2 3 4 5; do (cd $D && gh release download $TAG -R $R --clobber) && { ok=1; break; }; log "release download retry $i"; sleep 20; done
[ $ok = 1 ] && (cd $D && shasum -a 256 -c MANIFEST.sha256 > ../release_check.txt) && log "release sha256 ok" || { log "release FAIL"; exit 1; }
for k in 1 2 3 4; do mkdir -p $W/t2_circuit_fix/zkdac_v9/build/zk; cp $D/v9_c$k.zkey $W/t2_circuit_fix/zkdac_v9/build/zk/c$k.zkey; done
mkdir -p $W/t2_circuit_fix/zkdac_v8/build/zk $W/t4_registration/build/zk $W/t4_obligations/E7-obligations_20261009/revoke/build/zk
cp $D/v8_budget_transfer.zkey $W/t2_circuit_fix/zkdac_v8/build/zk/budget_transfer.zkey; cp $D/v8_budget_mint.zkey $W/t2_circuit_fix/zkdac_v8/build/zk/budget_mint.zkey
cp $D/reg20.zkey $W/t4_registration/build/zk/reg20.zkey; cp $D/revoke_rt.zkey $W/t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey
# attempt 3: the registration key (reg20) was set up on the LOCAL dev ptau 2^17 (t4_registration/RUN_RECORD.md), published in release v4 as dev_pot17.ptau
DEVP=$W/ptau/pot17_final.ptau
if [ ! -f "$DEVP" ]; then for i in 1 2 3 4 5; do gh release download v4-proving-material-20261008 -R $R -p dev_pot17.ptau -O "$DEVP" --clobber && break; sleep 20; done; fi
[ "$(shasum -a 256 "$DEVP" | awk '{print $1}')" = "28671bef15ba2c1c86aa8bc452540a12d0a7f86b8ec3fadce1565ad8c15c3a2b" ] && log "dev ptau 2^17 sha256 ok" || { log "dev ptau FAIL"; exit 1; }
log "20_fetch done"
