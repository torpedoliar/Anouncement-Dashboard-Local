# ============================================
# UPDATE.PS1 - One-Click Update Script
# Dashboard Pengumuman Santos Jaya Abadi
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard Pengumuman - Update" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: docker-compose.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project directory." -ForegroundColor Red
    exit 1
}

# Step 1: Backup database
Write-Host "[1/6] Backing up database..." -ForegroundColor Yellow
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir/db_backup_$timestamp.sql"

# Get database container name
$dbContainer = docker-compose ps -q db 2>$null
if ($dbContainer) {
    docker-compose exec -T db pg_dump -U postgres announcement_db > $backupFile 2>&1
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile) -and (Get-Item $backupFile).Length -gt 0) {
        Write-Host "OK - Database backed up to: $backupFile" -ForegroundColor Green
    }
    else {
        Write-Host "WARN - Backup may have failed, but continuing..." -ForegroundColor Yellow
        Write-Host "       (Database might not be running yet)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "SKIP - Database container not running (first install?)" -ForegroundColor Yellow
}

# Step 2: Pull latest code
Write-Host ""
Write-Host "[2/6] Pulling latest code from GitHub..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Git pull failed!" -ForegroundColor Red
    Write-Host "Try: git stash && git pull origin main && git stash pop" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - Code updated" -ForegroundColor Green

# Step 2.5: Karena docker-compose.yml kini ter-commit (tanpa secret), pastikan
# secret produksi tersedia via .env / .env.server di server. Fail-fast bila kosong
# supaya tidak deploy dengan PORTAL_CREDENTIAL_KEY blank (data kredensial tak terbaca).
Write-Host ""
Write-Host "[2.5/6] Checking production secrets..." -ForegroundColor Yellow

# File env sumber: prioritaskan .env.server, fallback .env
if (Test-Path ".env.server") { $envSource = ".env.server" } else { $envSource = ".env" }

# Ambil nilai secret dari $envSource (dengan [Environment]::SetEnvironmentVariable agar
# berlaku utk seluruh proses saat ini juga)
function Get-SecFromEnv($Name, $Source) {
    $raw = (Get-Content -Path $Source -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$Name=" }) -join "`n"
    if ($raw) {
        $val = $raw.Substring($raw.IndexOf("=") + 1).Trim().Trim('"')
        [Environment]::SetEnvironmentVariable($Name, $val)
        return $val
    }
    return ""
}

# Blokir bila PORTAL_CREDENTIAL_KEY (critical) tidak terisi
$portalKey = Get-SecFromEnv "PORTAL_CREDENTIAL_KEY" $envSource
if ([string]::IsNullOrWhiteSpace($portalKey) -or $portalKey -eq "CHANGE_ME") {
    Write-Host "ERROR: PORTAL_CREDENTIAL_KEY tidak ada di '$envSource' atau masih placeholder!" -ForegroundColor Red
    Write-Host "Isi dulu (contoh di .env.server.example), lalu jalankan ulang." -ForegroundColor Red
    Write-Host "PERINGATAN: ganti key ini = data kredensial portal terenkripsi LAMA tidak terbaca." -ForegroundColor Yellow
    exit 1
}

# NEXTAUTH_SECRET juga wajib
$naSecret = Get-SecFromEnv "NEXTAUTH_SECRET" $envSource
if ([string]::IsNullOrWhiteSpace($naSecret) -or $naSecret -eq "super-secret-key-for-development" -or $naSecret -eq "CHANGE_ME") {
    Write-Host "ERROR: NEXTAUTH_SECRET tidak valid di '$envSource'!" -ForegroundColor Red
    exit 1
}

# Ambil juga secret lain (biar compose ${...} terisi)
Get-SecFromEnv "CRON_SECRET" $envSource | Out-Null
Get-SecFromEnv "PEXELS_API_KEY" $envSource | Out-Null

# Pastikan AUTH_TRUST_HOST (dari .env.production ter-commit) ikut env proses,
# supaya docker compose interpolasi + runtime dapat nilai yang benar.
if (-not [Environment]::GetEnvironmentVariable("AUTH_TRUST_HOST")) {
    $authTrust = (Get-Content -Path ".env.production" -ErrorAction SilentlyContinue | Where-Object { $_ -match "^AUTH_TRUST_HOST=" }) -join ""
    if ($authTrust) {
        [Environment]::SetEnvironmentVariable("AUTH_TRUST_HOST", $authTrust.Substring($authTrust.IndexOf("=") + 1).Trim())
    }
}

Write-Host "OK - Secret tersedia (PORTAL_CREDENTIAL_KEY, NEXTAUTH_SECRET, CRON_SECRET)" -ForegroundColor Green

# Step 3: Check for schema changes
Write-Host ""
Write-Host "[3/6] Checking for database schema changes..." -ForegroundColor Yellow
$schemaChanged = git diff HEAD~1 --name-only 2>$null | Select-String "prisma/schema.prisma"
if ($schemaChanged) {
    Write-Host "Schema changes detected - will sync after rebuild" -ForegroundColor Cyan
}
else {
    Write-Host "No schema changes detected" -ForegroundColor Green
}

# Step 4: Stop containers
Write-Host ""
Write-Host "[4/6] Stopping containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "OK - Containers stopped" -ForegroundColor Green

# Step 5: Rebuild
Write-Host ""
Write-Host "[5/6] Rebuilding (this may take 2-5 minutes)..." -ForegroundColor Yellow
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To restore database from backup:" -ForegroundColor Yellow
    Write-Host "  docker-compose up -d db" -ForegroundColor Cyan
    Write-Host "  Get-Content $backupFile | docker-compose exec -T db psql -U postgres announcement_db" -ForegroundColor Cyan
    exit 1
}
Write-Host "OK - Build completed" -ForegroundColor Green

# Step 6: Start containers and sync database
Write-Host ""
Write-Host "[6/6] Starting containers and syncing database..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 8

# Sync database schema (use migrations for safety)
Write-Host ""
Write-Host "Syncing database schema..." -ForegroundColor Yellow
$migrateResult = docker-compose exec -T web npx prisma migrate deploy 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Database migrations applied" -ForegroundColor Green
}
else {
    Write-Host "WARN - Migration deployment had warnings (check logs)" -ForegroundColor Yellow
    Write-Host "If this is a new deployment, run baseline setup first" -ForegroundColor Yellow
}

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
docker-compose exec -T web npx prisma generate 2>&1 | Out-Null
Write-Host "OK - Prisma client generated" -ForegroundColor Green

# Cleanup old backups (keep last 5)
Write-Host ""
Write-Host "Cleaning up old backups (keeping last 5)..." -ForegroundColor Yellow
Get-ChildItem -Path $backupDir -Filter "db_backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force 2>$null
Write-Host "OK - Cleanup completed" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  UPDATE COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Application: http://localhost:3100" -ForegroundColor Cyan
Write-Host "  Backup file: $backupFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To restore if needed:" -ForegroundColor Yellow
Write-Host "  .\restore.ps1" -ForegroundColor DarkGray
Write-Host ""
