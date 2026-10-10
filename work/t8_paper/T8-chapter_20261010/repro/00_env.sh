#!/bin/bash
# T8 repro step 0: record tool versions (Apple silicon macOS used for every result; see REPRODUCE.md)
source "$(dirname "$0")/common.sh"
{ uname -a; sw_vers 2>/dev/null || true; echo "node $(node -v)"; echo "npm $(npm -v)"; circom --version; forge --version | head -1; anvil --version | head -1
  echo "git HEAD $(git -C "$ROOT" rev-parse HEAD)"; } > "$OUT/env.txt" 2>&1
cat "$OUT/env.txt"
