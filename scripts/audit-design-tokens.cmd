#!/usr/bin/env bash
# Design token audit — companion to audit-design-tokens.mjs
# Run from repo root. Use a second terminal tab if `npm run dev` is active.
#
# Direct (this file):
#   ./scripts/audit-design-tokens.cmd
#   ./scripts/audit-design-tokens.cmd trace
#   ./scripts/audit-design-tokens.cmd json
#   ./scripts/audit-design-tokens.cmd strict
#
# Via npm:
#   npm run audit:tokens
#   npm run audit:tokens -- --trace
#   npm run audit:tokens -- --json
#   npm run audit:tokens:strict

set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  trace)  node scripts/audit-design-tokens.mjs --trace ;;
  json)   node scripts/audit-design-tokens.mjs --json ;;
  strict) node scripts/audit-design-tokens.mjs --strict ;;
  ''|default) node scripts/audit-design-tokens.mjs ;;
  *)
    echo "Usage: $0 [default|trace|json|strict]" >&2
    exit 1
    ;;
esac
