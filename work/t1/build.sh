#!/usr/bin/env bash
# Rebuild the three T1 baseline R1CS files. Requires circom 2.2.3, node/npm, and a checkout of
# ttwang-szu/ZK-HADA at 7966d60 (set HIST=/path/to/it).  Writes only under work/t1/*/build and lib.
set -euo pipefail
HIST=${HIST:?set HIST to the historical repo checkout}
T=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$T/rq108-f494963/lib" && cd "$T/rq108-f494963/lib"
npm pack circomlib@2.0.5 --silent >/dev/null && tar xzf circomlib-2.0.5.tgz --strip-components=2 package/circuits
echo "circomlib@2.0.5 tarball sha1: $(shasum circomlib-2.0.5.tgz | cut -d' ' -f1) (expect 183c703e53ed7d011811842dbeeeb9819f4cc1d6)"
cd "$T/rq108-f494963" && mkdir -p src build
git -C "$HIST" show f494963:circuits/RQ108/dmax4_delegation_chain.circom > src/dmax4_original_f494963.circom
sed 's#/home/xyh/code/ZK-HADA/runs/RQ104/artifacts/external_sources/circomlib-2.0.5/package/circuits/#../lib/#' src/dmax4_original_f494963.circom > src/dmax4_includes_relative.circom
(cd build && circom ../src/dmax4_includes_relative.circom --r1cs --sym --wasm -o .)
for t in rq108-head:circuits/RQ108/dmax4_delegation_chain.circom rq112-head:circuits/RQ112/dmax4_delegation_chain_acct.circom; do
  d=$T/${t%%:*}; p=${t#*:}; mkdir -p "$d/src" "$d/build"
  git -C "$HIST" show 7966d60:$p > "$d/src/$(basename $p)"
  ln -sfn ../../rq108-f494963/lib "$d/src/circomlib_shared"
  (cd "$d/build" && circom ../src/$(basename $p) --r1cs -o .)
  rm -f "$d/src/circomlib_shared"
done
shasum -a 256 "$T"/*/src/*.circom "$T"/*/build/*.r1cs
