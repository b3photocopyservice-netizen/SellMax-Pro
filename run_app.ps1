# Startup Script for SellMax Pro with Log Redirection

# 1. Start Backend Server in a new window and redirect logs
Write-Host "Launching Backend Server (port 5000)..." -ForegroundColor Green
Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "server.js" -WorkingDirectory "backend" -RedirectStandardOutput "backend_out.log" -RedirectStandardError "backend_err.log"

# 2. Start Frontend Server in a new window and redirect logs
Write-Host "Launching Frontend Dev Server (port 5173)..." -ForegroundColor Green
Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" -ArgumentList "run dev" -WorkingDirectory "frontend" -RedirectStandardOutput "frontend_out.log" -RedirectStandardError "frontend_err.log"

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "SellMax Pro launch script executed!" -ForegroundColor Cyan
Write-Host "Check 'backend/backend_out.log' and 'backend/backend_err.log' for backend status." -ForegroundColor Gray
Write-Host "Check 'frontend/frontend_out.log' and 'frontend/frontend_err.log' for frontend status." -ForegroundColor Gray
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
