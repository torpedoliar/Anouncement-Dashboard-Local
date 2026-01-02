# ============================================
# BACKUP.PS1 - Manual Database Backup Script
# Dashboard Pengumuman Santos Jaya Abadi
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard Pengumuman - Backup Database" -ForegroundColor Cyan
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

# Check if database is running
$dbContainer = docker-compose ps -q db 2>$null
if (-not $dbContainer) {
    Write-Host "ERROR: Database container is not running!" -ForegroundColor Red
    Write-Host "Start it with: docker-compose up -d db" -ForegroundColor Yellow
    exit 1
}

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir/db_backup_$timestamp.sql"

Write-Host "Creating backup..." -ForegroundColor Yellow
docker-compose exec -T db pg_dump -U postgres announcement_db > $backupFile 2>&1

if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile) -and (Get-Item $backupFile).Length -gt 0) {
    $fileSize = [math]::Round((Get-Item $backupFile).Length / 1KB, 2)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  BACKUP COMPLETE!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  File: $backupFile" -ForegroundColor Cyan
    Write-Host "  Size: $fileSize KB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  To restore: .\restore.ps1" -ForegroundColor Yellow
    Write-Host ""
}
else {
    Write-Host "ERROR: Backup failed!" -ForegroundColor Red
    if (Test-Path $backupFile) {
        Remove-Item $backupFile -Force
    }
    exit 1
}

# List all backups
Write-Host "All backups:" -ForegroundColor Yellow
Get-ChildItem -Path $backupDir -Filter "db_backup_*.sql" | Sort-Object LastWriteTime -Descending | ForEach-Object {
    $size = [math]::Round($_.Length / 1KB, 2)
    Write-Host "  - $($_.Name) ($size KB)" -ForegroundColor White
}
Write-Host ""
