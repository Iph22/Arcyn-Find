# Fix npm PATH issue - Add Node.js to System PATH permanently
# Run this script as Administrator

Write-Host "🔧 Fixing npm PATH issue..." -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  This script needs to be run as Administrator!" -ForegroundColor Yellow
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or manually add this to your PATH:" -ForegroundColor Yellow
    Write-Host "  C:\Program Files\nodejs" -ForegroundColor White
    Write-Host ""
    Write-Host "Steps to add manually:" -ForegroundColor Yellow
    Write-Host "1. Press Win + X, select 'System'" -ForegroundColor White
    Write-Host "2. Click 'Advanced system settings'" -ForegroundColor White
    Write-Host "3. Click 'Environment Variables'" -ForegroundColor White
    Write-Host "4. Under 'System variables', find 'Path' and click 'Edit'" -ForegroundColor White
    Write-Host "5. Click 'New' and add: C:\Program Files\nodejs" -ForegroundColor White
    Write-Host "6. Click 'OK' on all dialogs" -ForegroundColor White
    Write-Host "7. Restart PowerShell" -ForegroundColor White
    exit 1
}

$nodePath = "C:\Program Files\nodejs"

# Check if Node.js is installed
if (-not (Test-Path $nodePath)) {
    Write-Host "❌ Node.js not found at: $nodePath" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Node.js found at: $nodePath" -ForegroundColor Green

# Get current system PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Check if already in PATH
if ($currentPath -like "*$nodePath*") {
    Write-Host "✅ Node.js is already in System PATH!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If npm still doesn't work, try:" -ForegroundColor Yellow
    Write-Host "1. Close and reopen PowerShell" -ForegroundColor White
    Write-Host "2. Or restart your computer" -ForegroundColor White
    exit 0
}

# Add to System PATH
Write-Host "Adding Node.js to System PATH..." -ForegroundColor Cyan
$newPath = $currentPath + ";$nodePath"
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")

Write-Host "✅ Successfully added Node.js to System PATH!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Please close and reopen PowerShell for changes to take effect." -ForegroundColor Yellow
Write-Host "Or run this command in your current session:" -ForegroundColor Yellow
Write-Host '  $env:PATH += ";C:\Program Files\nodejs"' -ForegroundColor White
Write-Host ""

