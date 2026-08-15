$path = "E:/Vibe/Dashboard SJA/announcement-dashboard/docs/superpowers/plans/2026-08-12-portal-app-login-field-detection.md"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($path)
$hashBytes = (New-Object System.Security.Cryptography.SHA256Managed).ComputeHash($bytes)
$hash = -join ($hashBytes[0..3] | ForEach-Object { $_.ToString("x2") })
Write-Host $hash