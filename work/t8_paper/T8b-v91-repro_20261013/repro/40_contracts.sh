#!/bin/bash
# T8b step 4 (C4): forge-std v1.17.0 + lean-imt symlink, then the whole forge suite. Run AFTER E7c's run_e7c.sh has generated fixtures_V91*.json in this
# environment (the other fixtures are the committed first-environment proofs, so this step also verifies them here).
source "$(dirname "$0")/common.sh"
F=$W/t4_contracts/foundry; mkdir -p $F/lib
[ -d $F/lib/forge-std ] || git clone -q --depth 1 --branch v1.17.0 https://github.com/foundry-rs/forge-std $F/lib/forge-std
ln -sfn ../../node_modules/@zk-kit/lean-imt.sol $F/lib/zk-kit-lean-imt
[ -f $F/test/fixtures_V91.json ] && [ -f $F/test/fixtures_V91_batch.json ] || { log "C4 FAIL: run E7c first (fixtures_V91*.json missing)"; exit 1; }
(cd $F && forge test > "$OUT/forge_test.txt" 2>&1) || true
grep -E "Ran [0-9]+ test suites" "$OUT/forge_test.txt" | tee "$OUT/C4.txt"
grep -qE "Ran [0-9]+ test suites.*: [0-9]+ tests passed, 0 failed" "$OUT/C4.txt" && { log "C4 ok"; exit 0; } || { log "C4 FAIL"; exit 1; }
