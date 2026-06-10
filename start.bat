@echo off
title SellMax Pro Launcher
color 0A

echo ============================================
echo       SellMax Pro - Local App Launcher
echo ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    SET "NODE_PATH=C:\Program Files\nodejs"
    SET "PATH=%NODE_PATH%;%PATH%"
)

echo [1/2] Starting Backend API Server on port 5000...
start "SellMax Backend (port 5000)" cmd /k "cd /d "e:\Development Projects\Updated Projects\SellMax Pro\backend" && echo Backend starting... && node server.js"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Dev Server on port 5173...
start "SellMax Frontend (port 5173)" cmd /k "cd /d "e:\Development Projects\Updated Projects\SellMax Pro\frontend" && echo Frontend starting... && npm run dev"

echo.
echo ============================================
echo  Both servers are now starting!
echo  Backend  API: http://localhost:5000
echo  Frontend App: http://localhost:5173
echo ============================================
echo.
echo  Wait ~5 seconds, then open your browser to:
echo  http://localhost:5173
echo.
pause
