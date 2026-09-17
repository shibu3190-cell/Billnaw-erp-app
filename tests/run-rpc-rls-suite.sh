#!/usr/bin/env bash
# Sets up the throwaway RPC/RLS test database, runs the suite, tears the
# database down, and propagates the suite's real exit code either way.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/rpc-rls-setup.sh" || exit 1
node "$SCRIPT_DIR/rpc-rls-tests.js"
RESULT=$?
"$SCRIPT_DIR/rpc-rls-setup.sh" teardown >/dev/null 2>&1
exit $RESULT
