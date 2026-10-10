#!/bin/bash
# T8 repro step 1: fresh dependency install (empty npm cache) + compile the circuits used by the results; C1 constraints, C2 r1cs/wasm sha256.
source "$(dirname "$0")/common.sh"
NPMC=${NPM_CACHE:-$OUT/npm-cache}; mkdir -p "$NPMC"
for d in t2_circuit_fix/zkdac_v7 t4_registration t4_contracts; do log "npm ci $d"; (cd $W/$d && npm ci --cache "$NPMC" --no-audit --no-fund > "$OUT/npm_$(basename $d).log" 2>&1); done
for v in zkdac_v8 zkdac_v9; do ln -sfn ../zkdac_v7/node_modules $W/t2_circuit_fix/$v/node_modules; done
L7=$W/t2_circuit_fix/zkdac_v7
FLAGS="-l circuits -l ../zkdac_v7/circuits -l node_modules -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src"
cd $W/t2_circuit_fix/zkdac_v9; for D in 1 2 3 4; do log "circom v9 c$D"; circom circuits/main_c_d$D.circom --r1cs --wasm --sym $FLAGS -o build/c$D > "$OUT/circom_v9_c$D.log"; done
cd $W/t2_circuit_fix/zkdac_v8; for n in budget_transfer budget_mint; do log "circom v8 $n"; mkdir -p build/$n; circom circuits/$n.circom --r1cs --wasm --sym $FLAGS -o build/$n > "$OUT/circom_$n.log"; done
cd $W/t4_registration; log "circom reg20"; mkdir -p build/r20; circom circuits/main_reg_20.circom --r1cs --wasm --sym -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/r20 > "$OUT/circom_reg20.log"
cd $W/t4_obligations/E7-obligations_20261009/revoke; log "circom revoke"; mkdir -p build; circom circuits/revoke_transition.circom --r1cs --wasm --sym -l $L7/circuits -l $L7/node_modules -l $L7/node_modules/circomlib/circuits -o build > "$OUT/circom_revoke.log"
cd $W; fail=0
while read -r f n; do got=$($SJ r1cs info $f 2>/dev/null | grep -i '# of Constraints' | awk '{print $NF}'); [ "$got" = "$n" ] && echo "C1 ok $f $n" || { echo "C1 FAIL $f expected $n got $got"; fail=1; }; done < $REPRO/expected_constraints.txt | tee "$OUT/C1.txt"
(cd $W && shasum -a 256 -c $REPRO/expected_build.sha256) > "$OUT/C2.txt" 2>&1 && log "C2 ok" || { log "C2 FAIL (see C2.txt)"; fail=1; }
grep -q FAIL "$OUT/C1.txt" && fail=1; log "10_build done fail=$fail"; exit $fail
