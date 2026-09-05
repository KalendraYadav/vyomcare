#!/bin/bash
# ─── VyomCare / BioTrack — Database Restoration Script ───────────────────────
# Usage:
#   ./scripts/restore-db.sh /path/to/backup_file.sql.gz
#
# CAUTION:
# This script restores data into the target database.
# Never run blindly on a live production instance without verifying the target.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "❌ Error: Missing backup file argument."
  echo "Usage: $0 <path-to-biotrack-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Backup file '${BACKUP_FILE}' does not exist."
  exit 1
fi

echo "⚠️  WARNING: About to restore database from: ${BACKUP_FILE}"
echo "    Target Database: ${MYSQL_DATABASE:-biotrack_prod}"
echo "    Container: biotrack_prod_mysql"
read -p "Are you sure you want to proceed? [y/N]: " CONFIRM
if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
  echo "Restoration aborted."
  exit 0
fi

echo "📦 Decompressing and importing backup into MySQL..."
gunzip -c "${BACKUP_FILE}" | docker exec -i biotrack_prod_mysql mysql \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  "${MYSQL_DATABASE:-biotrack_prod}"

echo "✅ Database restore successfully completed!"
