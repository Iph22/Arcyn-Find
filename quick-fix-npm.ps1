# Quick fix for npm PATH - Run this in any PowerShell session
$env:PATH += ";C:\Program Files\nodejs"
Write-Host "✅ npm is now available in this session!" -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow

