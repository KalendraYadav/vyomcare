#!/bin/bash
# ─── VyomCare / BioTrack — Automated MySQL Production Backup Script ──────────
# Usage:
#   ./scripts/backup-db.sh
# Scheduled via cron (e.g. daily at 02:00 UTC):
#   0 2 * * * /path/to/vyomcare/scripts/backup-db.sh >> /var/log/biotrack-backup.log 2>&1
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/biotrack}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/biotrack_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Ensure backup destination directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] 📦 Starting BioTrack database backup..."

# Execute mysqldump inside the running MySQL container
docker exec biotrack_prod_mysql mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "${MYSQL_DATABASE:-biotrack_prod}" | gzip > "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] ✅ Database backup successfully created at ${BACKUP_FILE} (${FILESIZE})"

# Prune backups older than RETENTION_DAYS
echo "[$(date -Iseconds)] 🧹 Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "biotrack_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] 🎉 Backup rotation complete."
