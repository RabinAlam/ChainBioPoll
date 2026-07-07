#!/usr/bin/env bash
# ──────────────────────────────────────────────────
# ChainBioPoll — Foundry Setup Script
# Run this once to install Foundry + forge-std dependency.
# ──────────────────────────────────────────────────

set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   ChainBioPoll — Foundry Setup               ║"
echo "╚══════════════════════════════════════════════╝"

# 1. Ensure foundryup is available
if ! command -v foundryup &> /dev/null; then
    echo "→ Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
    foundryup
else
    echo "✓ Foundry already installed"
    forge --version
fi

# 2. Install forge-std
echo ""
echo "→ Installing forge-std (test framework)..."
cd "$CONTRACTS_DIR"
forge install foundry-rs/forge-std --no-git --no-commit 2>/dev/null || true

# 3. Build
echo ""
echo "→ Building contracts..."
forge build

# 4. Test
echo ""
echo "→ Running tests..."
forge test -vvv

echo ""
echo "✅ Setup complete! All tests passed."
