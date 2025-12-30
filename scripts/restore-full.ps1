# ===========================================
# RESTORE FULL SCRIPT - Announcement Dashboard
# ===========================================
# Jalankan dari folder hasil extract: .\restore-full.ps1

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Restore Full Backup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check required files
if (-not (Test-Path "docker-compose.yml")) {
  Write-Host "Error: docker-compose.yml not found!" -ForegroundColor Red
  Write-Host "Make sure you run this from the extracted backup folder." -ForegroundColor Yellow
  exit 1
}

# 1. Load Docker images
Write-Host "[1/6] Loading Docker images..." -ForegroundColor Yellow
if (Test-Path "web_image.tar") {
  docker load -i web_image.tar 2>$null
  Write-Host "      Done - Web image loaded" -ForegroundColor Green
}
else {
  Write-Host "      Skip - Web image not found" -ForegroundColor Yellow
}

if (Test-Path "db_image.tar") {
  docker load -i db_image.tar 2>$null
  Write-Host "      Done - DB image loaded" -ForegroundColor Green
}
else {
  Write-Host "      Skip - DB image not found" -ForegroundColor Yellow
}

# 2. Modify docker-compose to use image instead of build
Write-Host "[2/6] Configuring docker-compose..." -ForegroundColor Yellow

# Create new docker-compose for restore (use image, not build)
$dockerCompose = @"
services:
  web:
    image: announcement-dashboard-web:latest
    ports:
      - "3100:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/announcement_db?schema=public
      - NEXTAUTH_SECRET=your-secret-key-change-in-production
      - NEXTAUTH_URL=http://localhost:3100
    volumes:
      - ./public/uploads:/app/public/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=announcement_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -U postgres" ]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
"@
$dockerCompose | Out-File -FilePath "docker-compose.yml" -Encoding UTF8
Write-Host "      Done - docker-compose configured" -ForegroundColor Green

# 3. Create uploads directory
Write-Host "[3/6] Preparing directories..." -ForegroundColor Yellow
if (-not (Test-Path ".\public\uploads")) {
  New-Item -ItemType Directory -Path ".\public\uploads" -Force | Out-Null
}
Write-Host "      Done" -ForegroundColor Green

# 4. Start containers
Write-Host "[4/6] Starting containers..." -ForegroundColor Yellow
docker-compose down 2>$null
docker-compose up -d 2>$null
Write-Host "      Waiting for database to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 20
Write-Host "      Done - Containers started" -ForegroundColor Green

# 5. Restore database
Write-Host "[5/6] Restoring database..." -ForegroundColor Yellow

# Run prisma migration first to ensure schema exists
Write-Host "      Running database migration..." -ForegroundColor Gray
docker exec announcement-dashboard-web-1 npx prisma db push --accept-data-loss 2>$null

if (Test-Path "database.sql") {
  # Check if database.sql has actual data
  $sqlContent = Get-Content "database.sql" -Raw
  if ($sqlContent.Length -gt 100) {
    Write-Host "      Restoring data from backup..." -ForegroundColor Gray
    $sqlContent | docker exec -i announcement-dashboard-db-1 psql -U postgres announcement_db 2>$null
    Write-Host "      Done - Database restored from backup" -ForegroundColor Green
  }
  else {
    Write-Host "      Backup file is empty, seeding default data..." -ForegroundColor Yellow
    docker exec announcement-dashboard-web-1 npx prisma db seed 2>$null
    Write-Host "      Done - Database seeded with default data" -ForegroundColor Green
  }
}
else {
  Write-Host "      No backup found, seeding default data..." -ForegroundColor Yellow
  docker exec announcement-dashboard-web-1 npx prisma db seed 2>$null
  Write-Host "      Done - Database seeded with default data" -ForegroundColor Green
}

# 6. Restore uploads
Write-Host "[6/6] Restoring uploads..." -ForegroundColor Yellow
if (Test-Path "uploads") {
  Copy-Item -Path "uploads\*" -Destination ".\public\uploads\" -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "      Done - Uploads restored" -ForegroundColor Green
}
else {
  Write-Host "      Skip - No uploads to restore" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Restore Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Container status:" -ForegroundColor White
docker-compose ps
Write-Host ""
Write-Host "Akses aplikasi di: http://localhost:3100" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default login:" -ForegroundColor White
Write-Host "  Email: admin@example.com" -ForegroundColor Gray
Write-Host "  Password: admin123" -ForegroundColor Gray
Write-Host ""
