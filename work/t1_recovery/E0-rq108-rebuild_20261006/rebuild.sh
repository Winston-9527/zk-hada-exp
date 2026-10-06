#!/usr/bin/env bash
# Rebuild historical RQ108 (dmax4 delegation chain) and recount constraints.
# usage: HIST=/path/to/ttwang-szu/ZK-HADA@7966d60 ./rebuild.sh
set -euo pipefail
: "${HIST:?set HIST to a checkout of ttwang-szu/ZK-HADA @ 7966d60}"
HERE=$(cd "$(dirname "$0")" && pwd); B=${BUILD:-$HERE/build}; rm -rf "$B"; mkdir -p "$B/runs/RQ108" "$B/circuits/RQ108" "$B/out"
cp "$HERE/write_circuit.orig.py" "$B/runs/RQ108/write_circuit.py"; ln -s "$HIST/runs/RQ104" "$B/runs/RQ104"
python3 "$B/runs/RQ108/write_circuit.py"                       # emits file with literal '{{' '}}'
sed 's/{{/{/g;s/}}/}/g' "$B/circuits/RQ108/dmax4_delegation_chain.circom" > "$B/rq108_fixed.circom"
circom "$B/rq108_fixed.circom" --r1cs --wasm --sym -o "$B/out" | tee "$B/circom.log"
snarkjs r1cs info "$B/out/rq108_fixed.r1cs" | tee "$B/r1cs_info.txt"
( cd "$B" && shasum -a 256 circuits/RQ108/*.circom rq108_fixed.circom out/rq108_fixed.r1cs out/rq108_fixed_js/rq108_fixed.wasm "$HIST/runs/RQ104/artifacts/external_sources/circomlib-2.0.5.tgz" ) | tee "$B/MANIFEST.sha256"
