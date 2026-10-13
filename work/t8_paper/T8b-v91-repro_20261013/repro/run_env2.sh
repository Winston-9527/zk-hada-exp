#!/bin/bash
# Whole second-environment run in the pre-registered order: T8b 00-30, E7c, T8b 40-60, E6c. Each step's log is in repro/out (T8b) or the experiment's
# results/ directory. Stops at the first failing step (the failure is the result; see PREREGISTRATION.md "Attempts").
set -euo pipefail
H=$(cd "$(dirname "$0")" && pwd); W=$(git -C "$H" rev-parse --show-toplevel)/work
for s in 00_env 10_build 20_fetch 30_keys; do bash $H/$s.sh; done
bash $W/t4_contracts/E7c-v91-gate_20261013/run_e7c.sh
for s in 40_contracts 50_core 60_cross; do bash $H/$s.sh; done
bash $W/t4_accountability/E6c-opening-v91_20261013/run_e6c.sh
