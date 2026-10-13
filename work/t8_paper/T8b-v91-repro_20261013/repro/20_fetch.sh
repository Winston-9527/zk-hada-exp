#!/bin/bash
# T8b step 2: Hermez ptau (blake2b), dev ptau 2^17 (sha256), releases v9-proving-material-20261010 and v9.1-proving-material-20261013 (sha256) into the
# paths the scripts use. Public repository: plain curl, no gh login needed.
source "$(dirname "$0")/common.sh"
R=https://github.com/Winston-9527/zk-hada-exp/releases/download
get() { local tag=$1 dir=$2; shift 2; mkdir -p "$dir"; for f in MANIFEST.sha256 "$@"; do local ok=0; for i in 1 2 3 4 5; do curl -fsSL -o "$dir/$f" "$R/$tag/$f" && { ok=1; break; }; log "retry $tag/$f $i"; sleep 20; done; [ $ok = 1 ] || { log "download FAIL $tag/$f"; exit 1; }; done
  (cd "$dir" && sha -c MANIFEST.sha256 > "$OUT/release_check_$tag.txt" 2>&1) && log "release $tag sha256 ok" || { log "release $tag FAIL"; exit 1; }; }
if [ ! -f "$PTAU" ]; then log "download ptau"; mkdir -p "$(dirname "$PTAU")"; curl -fL -o "$PTAU" https://circom.info/powersOfTau28_hez_final_18.ptau || curl -fL -o "$PTAU" https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_18.ptau; fi
b2=$(python3 -c "import hashlib,sys;h=hashlib.blake2b();f=open(sys.argv[1],'rb');[h.update(c) for c in iter(lambda:f.read(1<<20),b'')];print(h.hexdigest())" "$PTAU")
[ "$b2" = "$(awk '{print $1}' $W/ptau/hermez/EXPECTED_BLAKE2B.txt)" ] && log "ptau blake2b ok" || { log "ptau blake2b FAIL"; exit 1; }
D9=$OUT/release_v9; get v9-proving-material-20261010 $D9 reg20.zkey revoke_rt.zkey revoke_vk_rt.json v8_budget_mint.zkey v8_budget_transfer.zkey v8_vk_budget_mint.json v8_vk_budget_transfer.json v9_c1.zkey v9_c2.zkey v9_c3.zkey v9_c4.zkey v9_vk_c1.json v9_vk_c2.json v9_vk_c3.json v9_vk_c4.json vk_reg20.json
D91=$OUT/release_v91; get v9.1-proving-material-20261013 $D91 v91_c1.zkey v91_c2.zkey v91_c3.zkey v91_c4.zkey v91_vk_c1.json v91_vk_c2.json v91_vk_c3.json v91_vk_c4.json Groth16VerifierV91CD1.sol Groth16VerifierV91CD2.sol Groth16VerifierV91CD3.sol Groth16VerifierV91CD4.sol
for k in 1 2 3 4; do mkdir -p $W/t2_circuit_fix/zkdac_v9/build/zk $W/t2_circuit_fix/zkdac_v9_1/build/zk; cp $D9/v9_c$k.zkey $W/t2_circuit_fix/zkdac_v9/build/zk/c$k.zkey; cp $D91/v91_c$k.zkey $W/t2_circuit_fix/zkdac_v9_1/build/zk/c$k.zkey
  cmp -s $D91/Groth16VerifierV91CD$k.sol $W/t4_contracts/foundry/src/Groth16VerifierV91CD$k.sol && log "verifier V91CD$k = release" || { log "verifier V91CD$k differs from release"; exit 1; }; done
mkdir -p $W/t2_circuit_fix/zkdac_v8/build/zk $W/t4_registration/build/zk $W/t4_obligations/E7-obligations_20261009/revoke/build/zk
cp $D9/v8_budget_transfer.zkey $W/t2_circuit_fix/zkdac_v8/build/zk/budget_transfer.zkey; cp $D9/v8_budget_mint.zkey $W/t2_circuit_fix/zkdac_v8/build/zk/budget_mint.zkey
cp $D9/reg20.zkey $W/t4_registration/build/zk/reg20.zkey; cp $D9/revoke_rt.zkey $W/t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey
DEVP=$W/ptau/pot17_final.ptau
if [ ! -f "$DEVP" ]; then for i in 1 2 3 4 5; do curl -fsSL -o "$DEVP" $R/v4-proving-material-20261008/dev_pot17.ptau && break; sleep 20; done; fi
[ "$(sha "$DEVP" | awk '{print $1}')" = "28671bef15ba2c1c86aa8bc452540a12d0a7f86b8ec3fadce1565ad8c15c3a2b" ] && log "dev ptau 2^17 sha256 ok" || { log "dev ptau FAIL"; exit 1; }
log "20_fetch done"
