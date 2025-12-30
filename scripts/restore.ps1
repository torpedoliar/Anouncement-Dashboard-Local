# ===========================================
# RESTORE SCRIPT - Announcement Dashboard
# ===========================================
# Jalankan: .\restore.ps1 backup_YYYY-MM-DD_HH-MM-SS.zip

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$RestoreDir = ".\restore_temp"

if (-not (Test-Path $BackupFile)) {
    Write-Host "Error: Backup file '$BackupFile' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Restore Announcement Dashboard" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Backup: $BackupFile" -ForegroundColor White
Write-Host ""

# Confirm
$confirm = Read-Host "Ini akan menimpa data yang ada. Lanjutkan? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Restore dibatalkan." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Extract backup
Write-Host "[1/4] Extracting backup..." -ForegroundColor Yellow
if (Test-Path $RestoreDir) {
    Remove-Item $RestoreDir -Recurse -Force
}
Expand-Archive -Path $BackupFile -DestinationPath $RestoreDir -Force
Write-Host "      Done - Backup extracted" -ForegroundColor Green

# Check if containers are running
Write-Host "[2/4] Checking Docker containers..." -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}}" 2>$null
if ($containers -notmatch "announcement-dashboard-db-1") {
    Write-Host "      Starting containers..." -ForegroundColor Yellow
    Set-Location ..
    docker-compose up -d
    Set-Location scripts
    Write-Host "      Waiting for database to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}
Write-Host "      Done - Containers running" -ForegroundColor Green

# Restore database
Write-Host "[3/4] Restoring database..." -ForegroundColor Yellow
Get-Content "$RestoreDir\database.sql" -Raw | docker exec -i announcement-dashboard-db-1 psql -U postgres announcement_db
Write-Host "      Done - Database restored" -ForegroundColor Green

# Restore uploads
Write-Host "[4/4] Restoring uploads..." -ForegroundColor Yellow
if (Test-Path "$RestoreDir\uploads") {
    if (-not (Test-Path "..\public\uploads")) {
        New-Item -ItemType Directory -Path "..\public\uploads" | Out-Null
    }
    Copy-Item -Path "$RestoreDir\uploads\*" -Destination "..\public\uploads\" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "      Done - Uploads restored" -ForegroundColor Green
}
else {
    Write-Host "      Done - No uploads to restore" -ForegroundColor Green
}

# Cleanup
Remove-Item $RestoreDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Restore Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Akses aplikasi di: http://localhost:3100" -ForegroundColor White
Write-Host ""
