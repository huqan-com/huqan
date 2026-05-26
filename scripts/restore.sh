#!/usr/bin/env bash
# AXIOM Restore Script
# Usage: ./scripts/restore.sh [backup-dir]
# Restores memory files from a backup. Defaults to latest backup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE="$ROOT_DIR/backups"

# Find backup to restore
if [ -n "${1:-}" ]; then
  BACKUP_DIR="$1"
else
  if [ ! -d "$BACKUP_BASE" ]; then
    echo "✗ Backup dizini bulunamadi: $BACKUP_BASE"
    echo "   Once: ./scripts/backup.sh"
    exit 1
  fi
  BACKUP_DIR=$(find "$BACKUP_BASE" -maxdepth 1 -type d | grep -v "^$BACKUP_BASE$" | sort | tail -1)
  if [ -z "$BACKUP_DIR" ]; then
    echo "✗ Hic backup bulunamadi."
    exit 1
  fi
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "✗ Backup dizini bulunamadi: $BACKUP_DIR"
  exit 1
fi

echo "◈ AXIOM Restore -- $(basename "$BACKUP_DIR")"
echo "  Source: $BACKUP_DIR"
echo ""

# Show manifest if exists
if [ -f "$BACKUP_DIR/manifest.json" ]; then
  echo "  Manifest:"
  cat "$BACKUP_DIR/manifest.json" | sed 's/^/    /'
  echo ""
fi

FILES=(
  "memory.db"
  "memory.json"
  "memory.embeddings.json"
  "memory.agent.json"
)

# Safety: backup current state before restoring
SAFETY_DIR="$BACKUP_BASE/pre-restore-$(date +%Y%m%d_%H%M%S)"
echo "  Mevcut durum yedekleniyor -> $SAFETY_DIR"
mkdir -p "$SAFETY_DIR"

for file in "${FILES[@]}"; do
  if [ -f "$ROOT_DIR/$file" ]; then
    cp "$ROOT_DIR/$file" "$SAFETY_DIR/$file"
  fi
done

# Flush WAL before restore
if command -v sqlite3 &>/dev/null && [ -f "$ROOT_DIR/memory.db" ]; then
  sqlite3 "$ROOT_DIR/memory.db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
fi

echo ""

# Restore
restored=0
skipped=0

for file in "${FILES[@]}"; do
  src="$BACKUP_DIR/$file"
  dst="$ROOT_DIR/$file"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    echo "  ✓ $file restore edildi"
    ((restored++))
  else
    echo "  -- $file (backup'ta yok, atlandi)"
    ((skipped++))
  fi
done

# Clean up stale WAL files after restore
rm -f "$ROOT_DIR/memory.db-shm" "$ROOT_DIR/memory.db-wal"

echo ""
echo "◉ Restore tamamlandi: $restored dosya"
echo "  Eski durum suraya kaydedildi: $SAFETY_DIR"
