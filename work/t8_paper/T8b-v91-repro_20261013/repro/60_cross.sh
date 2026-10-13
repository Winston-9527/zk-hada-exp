#!/bin/bash
# T8b step 6 (C6): (a) the first-environment proofs in cross/mac_proofs_d*.json verify here; (b) generate 10 proofs per D here into
# $OUT/cross/env2_proofs_d*.json (copied back and verified in the first environment with cross/verify.mjs, recorded in RESULTS.md).
source "$(dirname "$0")/common.sh"
X=$REPRO/../cross; mkdir -p $OUT/cross
node $X/verify.mjs $X/mac_proofs_d1.json $X/mac_proofs_d2.json $X/mac_proofs_d3.json $X/mac_proofs_d4.json | tee "$OUT/C6a.txt"
for D in 1 2 3 4; do node $X/gen.mjs $D 10 env2 > $OUT/cross/env2_proofs_d$D.json; done
node $X/verify.mjs $OUT/cross/env2_proofs_d*.json | tee "$OUT/C6b_self.txt"
grep -q FAIL "$OUT/C6a.txt" && { log "C6a FAIL"; exit 1; } || log "C6a ok; C6b proofs written to $OUT/cross"
