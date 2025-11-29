# Quick setup script to add Node.js to PATH for current session
# Run this in PowerShell: . .\setup-npm.ps1

Write-Host "Adding Node.js to PATH for this session..." -ForegroundColor Cyan

$nodePath = "C:\Program Files\nodejs"

if (Test-Path $nodePath) {
    if ($env:PATH -notlike "*$nodePath*") {
        $env:PATH += ";$nodePath"
        Write-Host "✅ Node.js added to PATH!" -ForegroundColor Green
    } else {
        Write-Host "✅ Node.js is already in PATH!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Testing npm..." -ForegroundColor Cyan
    $npmVersion = & "$nodePath\npm.cmd" --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ npm is working! Version: $npmVersion" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now run: npm run dev" -ForegroundColor Yellow
    } else {
        Write-Host "❌ npm test failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Node.js not found at: $nodePath" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
}

