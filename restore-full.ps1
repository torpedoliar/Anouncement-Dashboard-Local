# ============================================
# RESTORE-FULL.PS1 - Complete Restore Script
# Dashboard Pengumuman Santos Jaya Abadi
# Restores: Database + All Uploads (images, videos, articles)
# ============================================

param(
    [string]$BackupFile = ""
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard Pengumuman - FULL RESTORE" -ForegroundColor Cyan
Write-Host "  Database + Uploads (Images/Videos)" -ForegroundColor Cyan
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
    Write-Host "Available full backups:" -ForegroundColor Yellow
    Write-Host ""
    
    if (Test-Path $backupDir) {
        $backups = Get-ChildItem -Path $backupDir -Filter "full_backup_*.zip" | Sort-Object LastWriteTime -Descending
        
        if ($backups.Count -eq 0) {
            Write-Host "  No full backup files found in $backupDir/" -ForegroundColor Red
            Write-Host "  Run .\backup-full.ps1 first to create a backup." -ForegroundColor Yellow
            exit 1
        }
        
        $i = 1
        foreach ($backup in $backups) {
            $size = [math]::Round($backup.Length / 1MB, 2)
            $date = $backup.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "  [$i] $($backup.Name) ($size MB) - $date" -ForegroundColor White
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

$fileSize = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
Write-Host ""
Write-Host "Selected backup: $BackupFile ($fileSize MB)" -ForegroundColor Cyan
Write-Host ""

# Confirm restore
Write-Host "WARNING: This will REPLACE all current data!" -ForegroundColor Red
Write-Host "  - Database (all articles, users, comments)" -ForegroundColor Red
Write-Host "  - Uploads (all images and videos)" -ForegroundColor Red
Write-Host ""
$confirm = Read-Host "Type 'yes' to confirm FULL restore"

if ($confirm -ne "yes") {
    Write-Host "Restore cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Create temp extraction folder
$tempDir = "$backupDir/temp_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $tempDir | Out-Null

Write-Host "[1/4] Extracting backup archive..." -ForegroundColor Yellow
Expand-Archive -Path $BackupFile -DestinationPath $tempDir -Force

# Verify extracted contents
$dbFile = "$tempDir/database.sql"
$uploadsBackupDir = "$tempDir/uploads"

if (-not (Test-Path $dbFile)) {
    Write-Host "ERROR: database.sql not found in backup!" -ForegroundColor Red
    Remove-Item -Recurse -Force $tempDir
    exit 1
}

Write-Host "[2/4] Restoring database..." -ForegroundColor Yellow

# Check if containers are running
$dbContainer = docker-compose ps -q db 2>$null
if (-not $dbContainer) {
    Write-Host "  Starting database container..." -ForegroundColor DarkGray
    docker-compose up -d db
    Start-Sleep -Seconds 5
}

# Drop and recreate database
Write-Host "  Preparing database..." -ForegroundColor DarkGray
docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS announcement_db;" 2>&1 | Out-Null
docker-compose exec -T db psql -U postgres -c "CREATE DATABASE announcement_db;" 2>&1 | Out-Null

# Restore from backup
Write-Host "  Restoring data..." -ForegroundColor DarkGray
Get-Content $dbFile | docker-compose exec -T db psql -U postgres announcement_db 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Database restored successfully!" -ForegroundColor Green
}
else {
    Write-Host "  WARNING: Database restore may have issues" -ForegroundColor Yellow
}

Write-Host "[3/4] Restoring uploads (images/videos)..." -ForegroundColor Yellow

$uploadsDir = "public/uploads"

# Create uploads directory if it doesn't exist
if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
}

# Backup current uploads (just in case)
$currentUploadsBackup = "$backupDir/uploads_before_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

if ((Get-ChildItem -Path $uploadsDir -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
    Write-Host "  Backing up current uploads to: $currentUploadsBackup" -ForegroundColor DarkGray
    New-Item -ItemType Directory -Path $currentUploadsBackup | Out-Null
    Copy-Item -Path "$uploadsDir/*" -Destination $currentUploadsBackup -Recurse -Force 2>$null
    
    # Clear current uploads
    Remove-Item -Path "$uploadsDir/*" -Recurse -Force 2>$null
}

# Restore uploads from backup
if (Test-Path $uploadsBackupDir) {
    $backupFileCount = (Get-ChildItem -Path $uploadsBackupDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    
    if ($backupFileCount -gt 0) {
        Copy-Item -Path "$uploadsBackupDir/*" -Destination $uploadsDir -Recurse -Force 2>$null
        $restoredCount = (Get-ChildItem -Path $uploadsDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
        Write-Host "  Restored $restoredCount files" -ForegroundColor Green
    }
    else {
        Write-Host "  No upload files in backup" -ForegroundColor DarkGray
    }
}
else {
    Write-Host "  No uploads folder in backup" -ForegroundColor DarkGray
}

Write-Host "[4/4] Cleaning up..." -ForegroundColor Yellow

# Clean up temp folder
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  FULL RESTORE COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Restored from: $(Split-Path $BackupFile -Leaf)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  What was restored:" -ForegroundColor Yellow
Write-Host "    - Database (all articles, users, settings)" -ForegroundColor White
Write-Host "    - Uploads (images, videos, attachments)" -ForegroundColor White
Write-Host ""
Write-Host "  Restart the application:" -ForegroundColor Yellow
Write-Host "  docker-compose restart web" -ForegroundColor DarkGray
Write-Host ""

# Offer to restart
$restartConfirm = Read-Host "Restart web container now? (y/n)"
if ($restartConfirm -eq "y" -or $restartConfirm -eq "Y") {
    Write-Host "Restarting web container..." -ForegroundColor Yellow
    docker-compose restart web
    Write-Host "Web container restarted!" -ForegroundColor Green
}

Write-Host ""
