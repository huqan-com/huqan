#!/usr/bin/env bash
# AXIOM Backup Script
# Usage: ./scripts/backup.sh [backup-dir]
# Creates a timestamped backup of all AXIOM memory files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE="${1:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$BACKUP_BASE/$TIMESTAMP"

FILES=(
  "memory.db"
  "memory.json"
  "memory.embeddings.json"
  "memory.agent.json"
)

mkdir -p "$BACKUP_DIR"

echo "◈ AXIOM Backup — $TIMESTAMP"
echo "  Target: $BACKUP_DIR"
echo ""

# Ensure clean SQLite state before copy (flush WAL)
if command -v sqlite3 &>/dev/null && [ -f "$ROOT_DIR/memory.db" ]; then
  sqlite3 "$ROOT_DIR/memory.db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
fi

backed_up=0
skipped=0

for file in "${FILES[@]}"; do
  src="$ROOT_DIR/$file"
  if [ -f "$src" ]; then
    cp "$src" "$BACKUP_DIR/$file"
    size=$(wc -c < "$src")
    echo "  ✓ $file ($size bytes)"
    ((backed_up++))
  else
    echo "  -- $file (not found, skipped)"
    ((skipped++))
  fi
done

# Write manifest
cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "axiomVersion": "$(node -e "console.log(require('$ROOT_DIR/package.json').version)" 2>/dev/null || echo "unknown")",
  "files": $backed_up,
  "skipped": $skipped,
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "◉ Backup tamamlandi: $backed_up dosya -> $BACKUP_DIR"

# Keep only last 10 backups
if [ -d "$BACKUP_BASE" ]; then
  backup_count=$(find "$BACKUP_BASE" -maxdepth 1 -type d | grep -v "^$BACKUP_BASE$" | wc -l)
  if [ "$backup_count" -gt 10 ]; then
    oldest=$(find "$BACKUP_BASE" -maxdepth 1 -type d | grep -v "^$BACKUP_BASE$" | sort | head -1)
    echo "  ! 10'dan fazla backup var, en eski siliniyor: $oldest"
    rm -rf "$oldest"
  fi
fi
