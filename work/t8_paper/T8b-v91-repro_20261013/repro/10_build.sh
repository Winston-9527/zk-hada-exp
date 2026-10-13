#!/bin/bash
# T8b step 1: fresh dependency install (empty npm cache) + compile v9.1 D=1..4, v9 D=1..4, budget transfer/mint, registration, revocation.
# C1 constraints (+ v9.1 public inputs), C2 r1cs/wasm sha256 against the first-environment build. Same install list as T8 (attempt-2 fix included).
source "$(dirname "$0")/common.sh"
NPMC=${NPM_CACHE:-$OUT/npm-cache}; mkdir -p "$NPMC"
for d in t2_circuit_fix/zkdac_v2 t2_circuit_fix/zkdac_v3 t2_circuit_fix/zkdac_v4 t2_circuit_fix/zkdac_v5 t2_circuit_fix/zkdac_v6 t2_circuit_fix/revocation_imt t2_circuit_fix/zkdac_v7 t3_attacks t4_registration t4_contracts; do log "npm ci $d"; (cd $W/$d && npm ci --cache "$NPMC" --no-audit --no-fund > "$OUT/npm_$(echo $d | tr / _).log" 2>&1); done
for v in zkdac_v8 zkdac_v9 zkdac_v9_1; do ln -sfn ../zkdac_v7/node_modules $W/t2_circuit_fix/$v/node_modules; done
L7=$W/t2_circuit_fix/zkdac_v7
FLAGS="-l circuits -l ../zkdac_v7/circuits -l node_modules -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src"
for v in zkdac_v9_1 zkdac_v9; do cd $W/t2_circuit_fix/$v; for D in 1 2 3 4; do log "circom $v c$D"; mkdir -p build/c$D; circom circuits/main_c_d$D.circom --r1cs --wasm --sym $FLAGS -o build/c$D > "$OUT/circom_${v}_c$D.log"; done; done
cd $W/t2_circuit_fix/zkdac_v8; for n in budget_transfer budget_mint; do log "circom v8 $n"; mkdir -p build/$n; circom circuits/$n.circom --r1cs --wasm --sym $FLAGS -o build/$n > "$OUT/circom_$n.log"; done
cd $W/t4_registration; log "circom reg20"; mkdir -p build/r20; circom circuits/main_reg_20.circom --r1cs --wasm --sym -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/r20 > "$OUT/circom_reg20.log"
cd $W/t4_obligations/E7-obligations_20261009/revoke; log "circom revoke"; mkdir -p build; circom circuits/revoke_transition.circom --r1cs --wasm --sym -l $L7/circuits -l $L7/node_modules -l $L7/node_modules/circomlib/circuits -o build > "$OUT/circom_revoke.log"
cd $W; fail=0
while read -r f n; do info=$($SJ r1cs info $f 2>/dev/null); got=$(echo "$info" | grep -i '# of Constraints' | awk '{print $NF}'); pi=$(echo "$info" | grep -i '# of Public Inputs' | awk '{print $NF}')
  [ "$got" = "$n" ] && echo "C1 ok $f $n constraints, $pi public inputs" || { echo "C1 FAIL $f expected $n got $got"; }; done < $REPRO/expected_constraints_v91.txt | tee "$OUT/C1.txt"
for D in 1 2 3 4; do pi=$($SJ r1cs info t2_circuit_fix/zkdac_v9_1/build/c$D/main_c_d$D.r1cs 2>/dev/null | grep -i '# of Public Inputs' | awk '{print $NF}'); [ "$pi" = "$((16 + D))" ] && echo "C1 ok v9.1 D=$D public inputs $pi" || echo "C1 FAIL v9.1 D=$D public inputs $pi"; done | tee -a "$OUT/C1.txt"
grep -q FAIL "$OUT/C1.txt" && fail=1
(cd $W && sha -c $REPRO/expected_build_v91.sha256) > "$OUT/C2.txt" 2>&1 && log "C2 ok (byte-identical to the first-environment build)" || log "C2 MISMATCH (reported as a finding; see C2.txt)"
log "10_build done fail=$fail"; exit $fail
