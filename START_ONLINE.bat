@echo off
title SellMax Pro - Online Testing Server

echo ============================================
echo   SellMax Pro - Starting Online Server
echo ============================================
echo.

:: Start the backend server
echo [1/2] Starting backend server on port 5000...
start "SellMax Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

:: Wait 4 seconds for backend to start
timeout /t 4 /nobreak >nul

:: Start the Cloudflare tunnel
echo [2/2] Starting Cloudflare tunnel...
echo.
echo ============================================
echo   Your public URL will appear below:
echo   (Look for trycloudflare.com link)
echo ============================================
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:5000

pause
