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

# Pull latest code
Write-Host "[1/5] Pulling latest code from GitHub..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Git pull failed!" -ForegroundColor Red
    Write-Host "Try: git stash && git pull origin main && git stash pop" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - Code updated" -ForegroundColor Green

# Check for schema changes
Write-Host ""
Write-Host "[2/5] Checking for database schema changes..." -ForegroundColor Yellow
$schemaChanged = git diff HEAD~1 --name-only | Select-String "prisma/schema.prisma"
if ($schemaChanged) {
    Write-Host "Schema changes detected - migration will run after rebuild" -ForegroundColor Cyan
} else {
    Write-Host "No schema changes detected" -ForegroundColor Green
}

# Stop containers
Write-Host ""
Write-Host "[3/5] Stopping containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "OK - Containers stopped" -ForegroundColor Green

# Rebuild
Write-Host ""
Write-Host "[4/5] Rebuilding (this may take 2-5 minutes)..." -ForegroundColor Yellow
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Build completed" -ForegroundColor Green

# Start containers
Write-Host ""
Write-Host "[5/5] Starting containers and running migrations..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 5

# Run database migrations
Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Yellow
docker-compose exec -T web npx prisma migrate deploy 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Database migrations applied" -ForegroundColor Green
} else {
    Write-Host "WARN - Migration may have failed or no migrations needed" -ForegroundColor Yellow
}

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
docker-compose exec -T web npx prisma generate 2>&1 | Out-Null
Write-Host "OK - Prisma client generated" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  UPDATE COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Application: http://localhost:3100" -ForegroundColor Cyan
Write-Host ""
