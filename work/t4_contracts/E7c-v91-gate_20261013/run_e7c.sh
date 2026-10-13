#!/bin/bash
# E7c run (second environment): generate the v9.1 fixtures HERE (released zkeys), then the V91 forge suites, then the summary.
# Needs T8b steps 10-30 (builds, zkeys). Usage: work/t4_contracts/E7c-v91-gate_20261013/run_e7c.sh
set -euo pipefail
E=$(cd "$(dirname "$0")" && pwd); C=$E/..; R=$E/results; mkdir -p $R
F=$C/foundry; mkdir -p $F/lib; [ -d $F/lib/forge-std ] || git clone -q --depth 1 --branch v1.17.0 https://github.com/foundry-rs/forge-std $F/lib/forge-std
ln -sfn ../../node_modules/@zk-kit/lean-imt.sol $F/lib/zk-kit-lean-imt
cd $C
{ echo "host $(hostname) $(uname -sm)"; date -u; } > $R/run_info.txt
s=$(date +%s); node E7c-v91-gate_20261013/gen_fixtures_v91.mjs 2> $R/gen_fixtures_v91.stderr; echo "gen_fixtures_v91 $(( $(date +%s) - s ))s" >> $R/run_info.txt
s=$(date +%s); N=${N:-30} node E7c-v91-gate_20261013/gen_batch_v91.mjs 2> $R/gen_batch_v91.stderr; echo "gen_batch_v91 $(( $(date +%s) - s ))s" >> $R/run_info.txt
sha256sum $F/test/fixtures_V91.json $F/test/fixtures_V91_batch.json | sed "s#$C/##" > $R/fixtures.sha256
cd $F; forge --version | head -1 >> $R/run_info.txt
(forge test --match-path "test/V91*.t.sol" -vv > $R/forge_v91.txt 2>&1) || true
python3 $E/analyze_e7c.py $R/forge_v91.txt $F/test/fixtures_V91_batch.json > $R/summary.json
tail -n 25 $R/summary.json
