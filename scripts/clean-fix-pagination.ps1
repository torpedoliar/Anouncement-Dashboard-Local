# Clean fix for all pagination bugs - one by one, carefully

Write-Host "Starting clean pagination fix..." -ForegroundColor Cyan

# Fix 1: announcements
$announcementsPath = "e:\Vibe\Dashboard SJA\announcement-dashboard\app\api\announcements\route.ts"
$content = Get-Content $announcementsPath -Raw

# Find the exact broken lines and replace
$oldPattern1 = "        const pageParam = url\.searchParams\.get\(`"page`"\) \|\| searchParams\.get\(`"page`"\);"
$newPattern1 = "        const pageParam = searchParams.get(`"page`");"

$oldPattern2 = "        const limitParam = url\.searchParams\.get\(`"limit`"\) \|\| searchParams\.get\(`"limit`"\);"
$newPattern2 = "        const limitParam = searchParams.get(`"limit`");"

$content = $content -replace [regex]::Escape($oldPattern1), $newPattern1
$content = $content -replace [regex]::Escape($oldPattern2), $newPattern2

Set-Content $announcementsPath -Value $content -NoNewline
Write-Host "✓ Fixed announcements/route.ts" -ForegroundColor Green

# Fix 2: newsletter  
$newsletterPath = "e:\Vibe\Dashboard SJA\announcement-dashboard\app\api\newsletter\route.ts"
$content = Get-Content $newsletterPath -Raw

$content = $content -replace [regex]::Escape($oldPattern1), $newPattern1
$content = $content -replace [regex]::Escape($oldPattern2), $newPattern2

Set-Content $newsletterPath -Value $content -NoNewline
Write-Host "✓ Fixed newsletter/route.ts" -ForegroundColor Green

# Fix 3: media
$mediaPath = "e:\Vibe\Dashboard SJA\announcement-dashboard\app\api\media\route.ts"
$content = Get-Content $mediaPath -Raw

$content = $content -replace [regex]::Escape($oldPattern1), $newPattern1
$content = $content -replace [regex]::Escape($oldPattern2), $newPattern2

Set-Content $mediaPath -Value $content -NoNewline
Write-Host "✓ Fixed media/route.ts" -ForegroundColor Green

Write-Host "`n✅ All pagination bugs fixed cleanly!" -ForegroundColor Cyan
