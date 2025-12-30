# ===========================================
# SEED DATABASE SCRIPT - Announcement Dashboard
# ===========================================
# Jalankan untuk seed default admin user
# .\seed-database.ps1

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Seed Database - Announcement Dashboard" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if container is running
$containers = docker ps --format "{{.Names}}" 2>$null
if ($containers -notmatch "announcement-dashboard-web-1") {
    Write-Host "Error: Container tidak berjalan!" -ForegroundColor Red
    Write-Host "Jalankan: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# Run prisma migration
Write-Host "[1/2] Running database migration..." -ForegroundColor Yellow
docker exec announcement-dashboard-web-1 npx prisma db push 2>$null
Write-Host "      Done" -ForegroundColor Green

# Run prisma seed
Write-Host "[2/2] Seeding database..." -ForegroundColor Yellow
docker exec announcement-dashboard-web-1 npx prisma db seed 2>$null
Write-Host "      Done" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Database Seeded!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Default login:" -ForegroundColor White
Write-Host "  Email: admin@example.com" -ForegroundColor Cyan
Write-Host "  Password: admin123" -ForegroundColor Cyan
Write-Host ""
