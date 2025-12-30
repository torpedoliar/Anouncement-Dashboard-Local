#!/bin/bash
# ===========================================
# BACKUP SCRIPT - Announcement Dashboard
# ===========================================
# Jalankan: ./backup.sh
# Output: backup_YYYY-MM-DD_HH-MM-SS.tar.gz

set -e

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="./backups"
BACKUP_NAME="backup_${TIMESTAMP}"

echo "=========================================="
echo "  Backup Announcement Dashboard"
echo "=========================================="

# Create backup directory
mkdir -p $BACKUP_DIR

# 1. Backup Database
echo "[1/3] Backing up database..."
docker exec announcement-dashboard-db-1 pg_dump -U postgres announcement_db > "${BACKUP_DIR}/database.sql"
echo "      ✓ Database backed up"

# 2. Backup Uploads folder
echo "[2/3] Backing up uploads..."
if [ -d "./public/uploads" ]; then
    cp -r ./public/uploads "${BACKUP_DIR}/uploads"
    echo "      ✓ Uploads backed up"
else
    mkdir -p "${BACKUP_DIR}/uploads"
    echo "      ✓ No uploads to backup"
fi

# 3. Copy version info
echo "[3/3] Saving version info..."
cp version.json "${BACKUP_DIR}/version.json" 2>/dev/null || echo '{"version":"unknown"}' > "${BACKUP_DIR}/version.json"
echo "      ✓ Version info saved"

# Create archive
echo ""
echo "Creating archive..."
cd $BACKUP_DIR
tar -czf "../${BACKUP_NAME}.tar.gz" database.sql uploads version.json
cd ..

# Cleanup temp files
rm -rf "${BACKUP_DIR}/database.sql" "${BACKUP_DIR}/uploads" "${BACKUP_DIR}/version.json"

echo ""
echo "=========================================="
echo "  ✓ Backup Complete!"
echo "=========================================="
echo "File: ${BACKUP_NAME}.tar.gz"
echo "Size: $(du -h ${BACKUP_NAME}.tar.gz | cut -f1)"
echo ""
echo "Transfer ke server baru dengan:"
echo "  scp ${BACKUP_NAME}.tar.gz user@server:/path/to/destination/"
echo ""
