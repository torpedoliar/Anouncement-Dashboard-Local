# ===========================================
# FULL BACKUP SCRIPT - Announcement Dashboard
# ===========================================
# Backup keseluruhan: Docker images + Database + Uploads + Config
# Jalankan dari folder scripts: .\backup-full.ps1
# Output: full_backup_YYYY-MM-DD_HH-MM-SS.zip

$ErrorActionPreference = "Continue"

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupDir = ".\full_backup_temp"
$BackupName = "full_backup_$Timestamp"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Full Backup - Announcement Dashboard" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup includes:" -ForegroundColor White
Write-Host "  - Docker images (web + db)" -ForegroundColor Gray
Write-Host "  - Database dump" -ForegroundColor Gray
Write-Host "  - Upload files" -ForegroundColor Gray
Write-Host "  - Configuration files" -ForegroundColor Gray
Write-Host ""

# Create backup directory
if (Test-Path $BackupDir) {
    Remove-Item $BackupDir -Recurse -Force
}
New-Item -ItemType Directory -Path $BackupDir | Out-Null

# 1. Export Docker Images
Write-Host "[1/5] Exporting Docker images..." -ForegroundColor Yellow
Write-Host "      This may take several minutes..." -ForegroundColor Gray

try {
    docker save announcement-dashboard-web -o "$BackupDir\web_image.tar" 2>$null
    Write-Host "      Done - Web image exported" -ForegroundColor Green
}
catch {
    Write-Host "      Warning - Could not export web image" -ForegroundColor Yellow
}

try {
    docker save postgres:16-alpine -o "$BackupDir\db_image.tar" 2>$null
    Write-Host "      Done - DB image exported" -ForegroundColor Green
}
catch {
    Write-Host "      Warning - Could not export DB image" -ForegroundColor Yellow
}

# 2. Backup Database
Write-Host "[2/5] Backing up database..." -ForegroundColor Yellow
try {
    $dbDump = docker exec announcement-dashboard-db-1 pg_dump -U postgres announcement_db 2>$null
    $dbDump | Out-File -FilePath "$BackupDir\database.sql" -Encoding UTF8
    Write-Host "      Done - Database backed up" -ForegroundColor Green
}
catch {
    Write-Host "      Warning - Could not backup database" -ForegroundColor Yellow
}

# 3. Backup Uploads folder
Write-Host "[3/5] Backing up uploads..." -ForegroundColor Yellow
$uploadsPath = Join-Path $ProjectRoot "public\uploads"
if (Test-Path $uploadsPath) {
    Copy-Item -Path $uploadsPath -Destination "$BackupDir\uploads" -Recurse -Force
    Write-Host "      Done - Uploads backed up" -ForegroundColor Green
}
else {
    New-Item -ItemType Directory -Path "$BackupDir\uploads" -Force | Out-Null
    Write-Host "      Done - No uploads found" -ForegroundColor Green
}

# 4. Copy config files
Write-Host "[4/5] Backing up configuration..." -ForegroundColor Yellow
$configFiles = @("docker-compose.yml", "docker-entrypoint.sh", "version.json", ".env", "Dockerfile")
foreach ($file in $configFiles) {
    $filePath = Join-Path $ProjectRoot $file
    if (Test-Path $filePath) {
        Copy-Item $filePath "$BackupDir\$file"
    }
}
Write-Host "      Done - Config files backed up" -ForegroundColor Green

# 5. Copy restore script
Write-Host "[5/5] Adding restore script..." -ForegroundColor Yellow
$restoreScriptPath = Join-Path $PSScriptRoot "restore-full.ps1"
if (Test-Path $restoreScriptPath) {
    Copy-Item $restoreScriptPath "$BackupDir\restore-full.ps1"
}
Write-Host "      Done - Restore script added" -ForegroundColor Green

# Create archive
Write-Host ""
Write-Host "Creating archive (this may take a while)..." -ForegroundColor Yellow
$zipPath = Join-Path $ProjectRoot "$BackupName.zip"
Compress-Archive -Path "$BackupDir\*" -DestinationPath $zipPath -Force

# Cleanup temp files
Remove-Item $BackupDir -Recurse -Force -ErrorAction SilentlyContinue

$FileSize = (Get-Item $zipPath).Length / 1MB

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Full Backup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "File: $BackupName.zip" -ForegroundColor White
Write-Host ("Size: {0:N2} MB" -f $FileSize) -ForegroundColor White
Write-Host "Location: $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Untuk restore di server baru:" -ForegroundColor Cyan
Write-Host "  1. Copy file zip ke server baru" -ForegroundColor Gray
Write-Host "  2. Expand-Archive $BackupName.zip -DestinationPath ./app" -ForegroundColor Gray
Write-Host "  3. cd app" -ForegroundColor Gray
Write-Host "  4. .\restore-full.ps1" -ForegroundColor Gray
Write-Host ""
