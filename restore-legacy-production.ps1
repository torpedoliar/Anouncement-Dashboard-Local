
# Restore Legacy Data to Production (Multi-Site Safe)
# Usage: .\restore-legacy-production.ps1 [BackupFileName]

param(
    [string]$BackupFile = "db_backup_20260205_093159.sql"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SJA Dashboard - Legacy Data Restore (Prod)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Backup File Exists locally
if (-not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file '$BackupFile' not found!" -ForegroundColor Red
    exit 1
}

# 2. Find Web Container
Write-Host "[1/4] Finding app container..." -ForegroundColor Yellow
$containerId = docker-compose ps -q web
if (-not $containerId) {
    Write-Host "ERROR: Web container not running. Is the app deployed?" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Found container: $containerId" -ForegroundColor Green

# 3. Copy files to container
Write-Host "[2/4] Copying files to container..." -ForegroundColor Yellow
docker cp $BackupFile "${containerId}:/app/${BackupFile}"
docker cp scripts/restore-legacy-data.ts "${containerId}:/app/scripts/restore-legacy-data.ts"
Write-Host "OK - Files copied" -ForegroundColor Green

# 4. Execute Restore Script
Write-Host "[3/4] Ececuting safe restore script..." -ForegroundColor Yellow
Write-Host "This will merge old articles into the Default Site..." -ForegroundColor Gray

# Use npx tsx to execute the typescript file (standard in our Docker image)
docker exec $containerId npx tsx scripts/restore-legacy-data.ts $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✅ RESTORE SUCCESSFUL" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "Legacy data has been imported to the Default Site."
}
else {
    Write-Host ""
    Write-Host "❌ Restore Failed. See errors above." -ForegroundColor Red
}
