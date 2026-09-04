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

# Step 1: Cek secret produksi SEBELUM apa pun (fail-fast: jangan sentuh container dulu
# baru ketahuan secret kosong). Karena docker-compose.yml kini ter-commit (tanpa secret),
# pastikan secret tersedia via .env / .env.server. Supaya tidak deploy dengan
# PORTAL_CREDENTIAL_KEY blank (data kredensial tak terbaca) — dan supaya perintah
# docker-compose di langkah berikut tidak memunculkan warning "CRON_SECRET not set".
Write-Host ""
Write-Host "[1/6] Checking production secrets..." -ForegroundColor Yellow

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
Get-SecFromEnv "PORTAL_SESSION_MAX_AGE" $envSource | Out-Null

# Pastikan AUTH_TRUST_HOST (dari .env.production ter-commit) ikut env proses,
# supaya docker compose interpolasi + runtime dapat nilai yang benar.
if (-not [Environment]::GetEnvironmentVariable("AUTH_TRUST_HOST")) {
    $authTrust = (Get-Content -Path ".env.production" -ErrorAction SilentlyContinue | Where-Object { $_ -match "^AUTH_TRUST_HOST=" }) -join ""
    if ($authTrust) {
        [Environment]::SetEnvironmentVariable("AUTH_TRUST_HOST", $authTrust.Substring($authTrust.IndexOf("=") + 1).Trim())
    }
}

Write-Host "OK - Secret tersedia (PORTAL_CREDENTIAL_KEY, NEXTAUTH_SECRET, CRON_SECRET)" -ForegroundColor Green

# Step 2: Backup database
Write-Host ""
Write-Host "[2/6] Backing up database..." -ForegroundColor Yellow
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

# Step 3: Pull latest code SEBELUM stop container.
# (Lama: down dulu baru pull utk hindari file-lock .git di Windows. Sekarang pull
# dulu sambil app tetap jalan — bila pull gagal kena lock, app tidak ikut mati.)
Write-Host ""
Write-Host "[3/6] Pulling latest code from GitHub..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Git pull failed!" -ForegroundColor Red
    Write-Host "Pastikan tidak ada proses yang masih mengunci file .git (Windows Defender / antivirus)." -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - Code updated" -ForegroundColor Green

# Step 4: Check for schema changes
Write-Host ""
Write-Host "[4/6] Checking for database schema changes..." -ForegroundColor Yellow
$schemaChanged = git diff HEAD~1 --name-only 2>$null | Select-String "prisma/schema.prisma"
if ($schemaChanged) {
    Write-Host "Schema changes detected - will sync after rebuild" -ForegroundColor Cyan
}
else {
    Write-Host "No schema changes detected" -ForegroundColor Green
}

# Step 5: Rebuild image BARU dulu, sementara app lama masih jalan (zero-downtime-ish).
# Pakai cache Docker (tanpa --no-cache): layer deps + build cuma diulang bila berubah.
# Catatan: db/browserless TIDAK disentuh di sini — schema change dijalankan container
# web lewat `prisma migrate deploy`, bukan container db.
Write-Host ""
Write-Host "[5/6] Building new image (app keeps running)..." -ForegroundColor Yellow
docker-compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    Write-Host "App lama masih jalan, tidak ada downtime. Fix code lalu ulangi." -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - Build completed" -ForegroundColor Green

# Step 6: Swap container web saja (db & browserless tetap hidup), lalu sync database.
# Recreate web = downtime ~5 detik, bukan down -> build -> up (dulu bisa 5 menit).
Write-Host ""
Write-Host "[6/6] Swapping web container and syncing database..." -ForegroundColor Yellow
docker-compose up -d --no-deps web
Start-Sleep -Seconds 8

# Sync database schema (use migrations for safety)
# NOTE: prisma migrate deploy gagal (exit != 0) JIKA ada migrasi failed (P3009) — jangan
# diteruskan sebagai warning, langsung stop. Kalau ini memang deploy pertama / fresh,
# jalankan baseline dulu. Restore backup jika perlu.
Write-Host ""
Write-Host "Syncing database schema..." -ForegroundColor Yellow
$migrateResult = docker-compose exec -T web npx prisma migrate deploy 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Database migrations applied" -ForegroundColor Green
}
else {
    Write-Host "ERROR - Database migration application FAILED:" -ForegroundColor Red
    Write-Host $migrateResult -ForegroundColor Red
    if ($migrateResult -match "P3009") {
        Write-Host ""
        Write-Host "P3009 berarti ada migrasi yang pernah FAILED di DB. Perbaiki manual lalu jalankan:" -ForegroundColor Yellow
        Write-Host "  docker-compose exec -T web npx prisma migrate resolve --applied <NAMA_MIGRASI>" -ForegroundColor Cyan
        Write-Host "Restore dari backup bila perlu:  .\restore.ps1" -ForegroundColor Yellow
    }
    exit 1
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
