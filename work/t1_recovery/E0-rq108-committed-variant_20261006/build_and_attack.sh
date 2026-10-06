#!/usr/bin/env bash
# Build the *committed* RQ108 circuit (412 lines, with *_enabled private inputs) and test switch-zero acceptance at witness level.
# usage: HIST=<checkout of ttwang-szu/ZK-HADA@7966d60> ./build_and_attack.sh   (needs ../E0-rq108-witness_20261006 node_modules + build/input_d4.json)
set -euo pipefail
: "${HIST:?}"; HERE=$(cd "$(dirname "$0")" && pwd); B=$HERE/build; rm -rf "$B"; mkdir -p "$B/circomlib_shared"
cp "$HIST"/runs/RQ104/artifacts/external_sources/circomlib-2.0.5/package/circuits/*.circom "$B/circomlib_shared/"
sed 's/{{/{/g;s/}}/}/g' "$HIST/circuits/RQ108/dmax4_delegation_chain.circom" > "$B/committed.circom"
( cd "$B" && circom committed.circom --r1cs --wasm -o . | tee circom.log && snarkjs r1cs info committed.r1cs | tee r1cs_info.txt && shasum -a 256 "$HIST/circuits/RQ108/dmax4_delegation_chain.circom" committed.r1cs | tee MANIFEST.sha256 )
python3 "$HERE/switch_zero_attack.py" "$B" "$HERE/../E0-rq108-witness_20261006/build/input_d4.json" | tee "$B/attack_results.txt"
