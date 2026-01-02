# ============================================
# RESTORE.PS1 - Database Restore Script
# Dashboard Pengumuman Santos Jaya Abadi
# ============================================

param(
    [string]$BackupFile = ""
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard Pengumuman - Restore Database" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: docker-compose.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project directory." -ForegroundColor Red
    exit 1
}

$backupDir = "backups"

# If no backup file specified, list available backups
if (-not $BackupFile) {
    Write-Host "Available backups:" -ForegroundColor Yellow
    Write-Host ""
    
    if (Test-Path $backupDir) {
        $backups = Get-ChildItem -Path $backupDir -Filter "db_backup_*.sql" | Sort-Object LastWriteTime -Descending
        
        if ($backups.Count -eq 0) {
            Write-Host "  No backup files found in $backupDir/" -ForegroundColor Red
            exit 1
        }
        
        $i = 1
        foreach ($backup in $backups) {
            $size = [math]::Round($backup.Length / 1KB, 2)
            $date = $backup.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "  [$i] $($backup.Name) ($size KB) - $date" -ForegroundColor White
            $i++
        }
        
        Write-Host ""
        $selection = Read-Host "Enter number to restore (or press Enter to cancel)"
        
        if ($selection -match '^\d+$') {
            $index = [int]$selection - 1
            if ($index -ge 0 -and $index -lt $backups.Count) {
                $BackupFile = $backups[$index].FullName
            }
            else {
                Write-Host "Invalid selection" -ForegroundColor Red
                exit 1
            }
        }
        else {
            Write-Host "Cancelled" -ForegroundColor Yellow
            exit 0
        }
    }
    else {
        Write-Host "  Backup directory not found: $backupDir/" -ForegroundColor Red
        exit 1
    }
}

# Verify backup file exists
if (-not (Test-Path $BackupFile)) {
    # Try with backups/ prefix
    if (Test-Path "$backupDir/$BackupFile") {
        $BackupFile = "$backupDir/$BackupFile"
    }
    else {
        Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
        exit 1
    }
}

$fileSize = [math]::Round((Get-Item $BackupFile).Length / 1KB, 2)
Write-Host ""
Write-Host "Selected backup: $BackupFile ($fileSize KB)" -ForegroundColor Cyan
Write-Host ""

# Confirm restore
Write-Host "WARNING: This will REPLACE all current data in the database!" -ForegroundColor Red
$confirm = Read-Host "Type 'yes' to confirm restore"

if ($confirm -ne "yes") {
    Write-Host "Restore cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting restore..." -ForegroundColor Yellow

# Check if containers are running
$dbContainer = docker-compose ps -q db 2>$null
if (-not $dbContainer) {
    Write-Host "Starting database container..." -ForegroundColor Yellow
    docker-compose up -d db
    Start-Sleep -Seconds 5
}

# Drop and recreate database
Write-Host "Preparing database..." -ForegroundColor Yellow
docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS announcement_db;" 2>&1 | Out-Null
docker-compose exec -T db psql -U postgres -c "CREATE DATABASE announcement_db;" 2>&1 | Out-Null

# Restore from backup
Write-Host "Restoring data from backup..." -ForegroundColor Yellow
Get-Content $BackupFile | docker-compose exec -T db psql -U postgres announcement_db 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  RESTORE COMPLETE!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Restored from: $BackupFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Restart application to apply changes:" -ForegroundColor Yellow
    Write-Host "  docker-compose restart web" -ForegroundColor DarkGray
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "ERROR: Restore may have failed!" -ForegroundColor Red
    Write-Host "Check the database manually:" -ForegroundColor Yellow
    Write-Host "  docker-compose exec db psql -U postgres announcement_db" -ForegroundColor DarkGray
    exit 1
}
