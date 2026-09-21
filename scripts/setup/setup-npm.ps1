# Quick setup script to add Node.js to PATH for current session
# Run this in PowerShell: . .\setup-npm.ps1
#
# This only affects the current session, on purpose.
#
# There used to be a fix-npm-path.ps1 here that made it permanent by writing
# the Machine PATH. Windows Defender blocks that file from being read at all
# (os error 225) -- editing the machine-wide PATH is a persistence technique,
# so the heuristic fires on a benign script -- and because Tailwind reads every
# file in the project, an unreadable one took the dev server down with it. It
# was deleted rather than worked around.
#
# To make it permanent, do it by hand instead:
#   1. Win + X -> System -> Advanced system settings
#   2. Environment Variables -> System variables -> Path -> Edit
#   3. New -> C:\Program Files\nodejs
#   4. OK on all dialogs, then restart PowerShell

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

