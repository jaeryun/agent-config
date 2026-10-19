#!/usr/bin/env bash
set -euo pipefail
umask 077
command -v node >/dev/null || { printf '%s\n' 'Error: Node.js >=22 is required.' >&2; exit 1; }
repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
exec node "$repo_dir/scripts/install.mjs" "$@"
