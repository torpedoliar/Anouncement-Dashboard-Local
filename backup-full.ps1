# ============================================
# BACKUP-FULL.PS1 - Complete Backup Script
# Dashboard Pengumuman Santos Jaya Abadi
# Includes: Database + All Uploads (images, videos, articles)
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard Pengumuman - FULL BACKUP" -ForegroundColor Cyan
Write-Host "  Database + Uploads (Images/Videos)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: docker-compose.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project directory." -ForegroundColor Red
    exit 1
}

# Create backup directory
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "Created backup directory: $backupDir/" -ForegroundColor Green
}

# Create timestamped backup folder
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFolder = "$backupDir/full_backup_$timestamp"
New-Item -ItemType Directory -Path $backupFolder | Out-Null

Write-Host ""
Write-Host "[1/3] Backing up database..." -ForegroundColor Yellow

# Check if database is running
$dbContainer = docker-compose ps -q db 2>$null
if (-not $dbContainer) {
    Write-Host "ERROR: Database container is not running!" -ForegroundColor Red
    Write-Host "Start it with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# Backup database
$dbBackupFile = "$backupFolder/database.sql"
docker-compose exec -T db pg_dump -U postgres announcement_db > $dbBackupFile 2>&1

if ($LASTEXITCODE -eq 0 -and (Test-Path $dbBackupFile) -and (Get-Item $dbBackupFile).Length -gt 0) {
    $dbSize = [math]::Round((Get-Item $dbBackupFile).Length / 1KB, 2)
    Write-Host "  Database backup: $dbSize KB" -ForegroundColor Green
}
else {
    Write-Host "ERROR: Database backup failed!" -ForegroundColor Red
    Remove-Item -Recurse -Force $backupFolder
    exit 1
}

Write-Host "[2/3] Backing up uploads (images, videos)..." -ForegroundColor Yellow

# Backup uploads folder
$uploadsDir = "public/uploads"
$uploadsBackupDir = "$backupFolder/uploads"

if (Test-Path $uploadsDir) {
    # Create uploads backup directory
    New-Item -ItemType Directory -Path $uploadsBackupDir | Out-Null
    
    # Copy all uploads
    Copy-Item -Path "$uploadsDir/*" -Destination $uploadsBackupDir -Recurse -Force 2>$null
    
    # Count files
    $fileCount = (Get-ChildItem -Path $uploadsBackupDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $uploadsSize = [math]::Round((Get-ChildItem -Path $uploadsBackupDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Write-Host "  Uploads backup: $fileCount files ($uploadsSize MB)" -ForegroundColor Green
}
else {
    Write-Host "  No uploads folder found, skipping..." -ForegroundColor DarkGray
    New-Item -ItemType Directory -Path $uploadsBackupDir | Out-Null
}

Write-Host "[3/3] Creating backup archive..." -ForegroundColor Yellow

# Create zip archive
$zipFile = "$backupDir/full_backup_$timestamp.zip"
Compress-Archive -Path "$backupFolder/*" -DestinationPath $zipFile -Force

# Get final sizes
$zipSize = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)

# Clean up temporary folder
Remove-Item -Recurse -Force $backupFolder

# Create backup info file
$infoContent = @"
Backup Info
===========
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Type: Full Backup (Database + Uploads)
Size: $zipSize MB
Contents:
  - database.sql (PostgreSQL dump)
  - uploads/ (all images and videos)

To restore, use: .\restore-full.ps1
"@

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  FULL BACKUP COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  File: $zipFile" -ForegroundColor Cyan
Write-Host "  Size: $zipSize MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Contents:" -ForegroundColor Yellow
Write-Host "    - Database (all articles, users, settings)" -ForegroundColor White
Write-Host "    - Uploads (images, videos, attachments)" -ForegroundColor White
Write-Host ""
Write-Host "  To restore: .\restore-full.ps1" -ForegroundColor Yellow
Write-Host ""

# List all full backups
Write-Host "All full backups:" -ForegroundColor Yellow
Get-ChildItem -Path $backupDir -Filter "full_backup_*.zip" | Sort-Object LastWriteTime -Descending | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  - $($_.Name) ($size MB)" -ForegroundColor White
}
Write-Host ""
