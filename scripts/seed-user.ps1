# ===========================================
# SEED USER SCRIPT - Fixed Version
# ===========================================
# Jalankan di server baru: .\seed-user.ps1

param(
    [string]$ContainerName = "newfolder-db-1"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Insert Admin User - Direct SQL" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Container: $ContainerName" -ForegroundColor Gray
Write-Host ""

# Cek schema
Write-Host "Checking table structure..." -ForegroundColor Yellow
docker exec $ContainerName psql -U postgres announcement_db -c "\d users"

# Password hash untuk "admin123" dengan bcrypt (verified)
# Simpan ke file untuk menghindari masalah escape
$sqlContent = @'
-- Delete existing admin if exists
DELETE FROM users WHERE email = 'admin@example.com';

-- Insert admin user with correct password hash for 'admin123'
INSERT INTO users (id, email, "passwordHash", name, role, "createdAt", "updatedAt")
VALUES (
    'admin-001',
    'admin@example.com',
    '$2b$12$r5MtMNfN73M/qCn.2wi.8eAes1Q53KHANSP9XOjTG/Wqc7I/3CxDe',
    'Administrator',
    'ADMIN',
    NOW(),
    NOW()
);

-- Verify
SELECT id, email, name, role FROM users;
'@

# Save to temp file
$tempFile = ".\temp_seed.sql"
$sqlContent | Out-File -FilePath $tempFile -Encoding ASCII

Write-Host ""
Write-Host "Inserting admin user..." -ForegroundColor Yellow
Get-Content $tempFile | docker exec -i $ContainerName psql -U postgres announcement_db

# Cleanup
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Login dengan:" -ForegroundColor White
Write-Host "  Email: admin@example.com" -ForegroundColor Cyan
Write-Host "  Password: admin123" -ForegroundColor Cyan
Write-Host ""
