#!/bin/bash
# T8 repro step 4 (C4): forge-std v1.17.0 + lean-imt symlink, then the whole forge suite (committed fixtures carry real proofs)
source "$(dirname "$0")/common.sh"
F=$W/t4_contracts/foundry; mkdir -p $F/lib
[ -d $F/lib/forge-std ] || git clone -q --depth 1 --branch v1.17.0 https://github.com/foundry-rs/forge-std $F/lib/forge-std
ln -sfn ../../node_modules/@zk-kit/lean-imt.sol $F/lib/zk-kit-lean-imt
(cd $F && forge test > "$OUT/forge_test.txt" 2>&1) || true
tail -3 "$OUT/forge_test.txt" | tee "$OUT/C4.txt"
grep -q " 0 failed" "$OUT/C4.txt" && { log "C4 ok"; exit 0; } || { log "C4 FAIL"; exit 1; }
