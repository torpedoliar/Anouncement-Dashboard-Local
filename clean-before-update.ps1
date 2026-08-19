# ============================================
# CLEAN-BEFORE-UPDATE.PS1 - Bersihkan cache sebelum git pull + rebuild
# Dashboard Pengumuman Santos Jaya Abadi
# JALANKAN DI SERVER PRODUKSI (PowerShell, dari folder proyek)
# Aman: TIDAK menghapus volume DB, TIDAK `docker system prune -a`
# Setelah script selesai: jalankan .\update.ps1 (pull + build + migrate + up)
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard - Clean Before Update" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 0. Cek di folder proyek
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: docker-compose.yml not found! Jalankan dari folder proyek." -ForegroundColor Red
    exit 1
}

# 0.5. Load secret produksi ke env proses (sama seperti update.ps1)
# docker-compose baca `.env` default, padahal secret produksi ada di .env.server.
# Tanpa ini, tiap perintah compose muncul warning "CRON_SECRET not set" dsb,
# dan (dengan ErrorActionPreference=Stop) bisa mematikan script di tengah jalan.
Write-Host "[0/5] Memuat secret produksi (.env.server / .env)..." -ForegroundColor Yellow
$envSource = ".env.server"
if (-not (Test-Path $envSource)) { $envSource = ".env" }
foreach ($name in @("CRON_SECRET", "PORTAL_CREDENTIAL_KEY", "NEXTAUTH_SECRET", "PEXELS_API_KEY", "AUTH_TRUST_HOST", "DATABASE_URL", "PORTAL_SESSION_MAX_AGE")) {
    $raw = (Get-Content -Path $envSource -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$name=" }) -join "`n"
    if ($raw) {
        $val = $raw.Substring($raw.IndexOf("=") + 1).Trim().Trim('"')
        [Environment]::SetEnvironmentVariable($name, $val)
        if ($name -ne "DATABASE_URL") { Write-Host "  - OK $name" -ForegroundColor DarkGray }
    }
    # PORTAL_CREDENTIAL_KEY wajib — fail fast tanpa membongkar container
    elseif ($name -eq "PORTAL_CREDENTIAL_KEY") {
        Write-Host "ERROR: PORTAL_CREDENTIAL_KEY tidak ada di '$envSource'!" -ForegroundColor Red
        Write-Host "Isi dulu (lihat .env.server.example), lalu jalankan ulang." -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "OK - Secret termuat ke proses" -ForegroundColor Green

# 1. Backup DB dulu (aman: kalau update gagal, ada jalur restore).
#    Non-fatal: kalau backup gagal, bersih disarankan tetap lanjut (warning saja).
Write-Host "[1/5] Backup database (opsional tapi disarankan)..." -ForegroundColor Yellow
if (Test-Path ".\backup.ps1") {
    try {
        & .\backup.ps1
    }
    catch {
        Write-Host "WARN - Backup gagal: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "       Lanjut bersihkan cache (container mungkin belum jalan)." -ForegroundColor Yellow
    }
} else {
    Write-Host "SKIP - backup.ps1 tidak ada; update.ps1 akan backup saat dijalankan." -ForegroundColor Yellow
}

# 2. Stop container (juga melepas lock file .git yang bikin git pull hang di Windows)
Write-Host "[2/5] Menghentikan container..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "OK - Container dihentikan (volume DB AMAN, tidak dihapus)" -ForegroundColor Green

# 3. Bersihkan cache build korup/stale (.next, tsbuildinfo, prisma cache)
Write-Host "[3/5] Membersihkan cache build stale..." -ForegroundColor Yellow
$targets = @(
    ".next",
    "node_modules/.cache",
    "tsconfig.tsbuildinfo",
    ".portal-local"
)
foreach ($t in $targets) {
    if (Test-Path $t) {
        Remove-Item -Recurse -Force $t -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "  - hapus: $t" -ForegroundColor DarkGray
    }
}
Write-Host "OK - Cache build dibersihkan" -ForegroundColor Green

# 4. Bersihkan Docker build cache (layers lambda) -- HANYA builder cache, bukan image/container
Write-Host "[4/5] Membersihkan Docker build cache..." -ForegroundColor Yellow
docker builder prune -f 2>&1 | Out-Null
Write-Host "OK - Docker build cache dibersihkan (image lama tetap ada)" -ForegroundColor Green

# 5. Verifikasi state bersih
Write-Host "[5/5] Verifikasi..." -ForegroundColor Yellow
$gitClean = git status --porcelain 2>$null | Where-Object { $_ -notmatch '^ M (CLAUDE|graphify-out|\.planning)' }
if ($gitClean) {
    Write-Host "WARN - Ada perubahan lokal yang TIDAK ter-commit:" -ForegroundColor Yellow
    $gitClean | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkYellow }
    Write-Host "       Pastikan ini sengaja (mis. file .env yang di-ignore), bukan kerja yang hilang." -ForegroundColor Yellow
} else {
    Write-Host "OK - Working tree bersih (hanya .env/.planning/graphify yang biasa)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  CLEANUP SELESAI" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Lanjutkan update:" -ForegroundColor Cyan
Write-Host "  .\update.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  (update.ps1 akan: git pull -> docker-compose build --no-cache ->"
Write-Host "   prisma migrate deploy -> docker-compose up -d -> cleanup backup)" -ForegroundColor DarkGray
Write-Host ""