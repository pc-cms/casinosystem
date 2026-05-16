#!/usr/bin/env bash
# Alias of public/install (kept for backward compatibility with old links
# pointing at /install.sh). See public/install for behaviour.
set -euo pipefail
exec bash <(curl -fsSL https://casinosystem.app/install) "$@"
