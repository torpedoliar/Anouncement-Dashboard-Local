# ============================================
# DEPLOY.PS1 - One-Click Docker Deployment
# Dashboard Pengumuman Santos Jaya Abadi
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Dashboard Pengumuman - Docker Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running! Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "OK - Docker is running" -ForegroundColor Green

# Stop existing containers
Write-Host ""
Write-Host "[2/5] Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "OK - Containers stopped" -ForegroundColor Green

# Build containers
Write-Host ""
Write-Host "[3/5] Building containers (this may take 2-5 minutes)..." -ForegroundColor Yellow
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed! Check Dockerfile for errors." -ForegroundColor Red
    exit 1
}
Write-Host "OK - Build completed" -ForegroundColor Green

# Start containers
Write-Host ""
Write-Host "[4/5] Starting containers..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start containers!" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Containers started" -ForegroundColor Green

# Wait for health check
Write-Host ""
Write-Host "[5/5] Waiting for application to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if app is accessible
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3100" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    Write-Host "OK - Application is running!" -ForegroundColor Green
}
catch {
    Write-Host "WARNING: Application may still be starting. Please wait a moment." -ForegroundColor Yellow
}

# Final message
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Access your dashboard at:" -ForegroundColor White
Write-Host "  http://localhost:3100" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Admin panel:" -ForegroundColor White
Write-Host "  http://localhost:3100/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Default login:" -ForegroundColor White
Write-Host "  Email: admin@example.com" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
