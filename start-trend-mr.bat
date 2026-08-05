@echo off
title Trend MR - Starting...
cd /d "%~dp0web"

echo ============================================
echo   TREND MR - Full Stack Startup
echo ============================================
echo.

echo [1/4] Checking Postgres service...
sc query postgresql-x64-18 | find "RUNNING" >nul
if errorlevel 1 (
    echo   Postgres not running, starting it...
    net start postgresql-x64-18 >nul 2>&1
) else (
    echo   Postgres already running.
)

echo [2/4] Checking dependencies...
if not exist node_modules (
    echo   node_modules missing, running npm install...
    call npm install
)

echo [3/4] Syncing Prisma client...
call npx prisma generate

echo [4/4] Launching Next.js (frontend + API backend on port 5555)...
echo.
start "Trend MR Server" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5555"

echo.
echo Trend MR is starting at http://localhost:5555
echo Close the "Trend MR Server" window to stop it.
exit
