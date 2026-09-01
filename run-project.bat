@echo off
setlocal enabledelayedexpansion
title Trend MR - Pharma OS Runner
color 0B

:: Ensure script runs from the project root directory
cd /d "%~dp0"

echo =======================================================================
echo                     TREND MR - PHARMA OS RUNNER
echo =======================================================================
echo.
echo [CONFIG] Services:
echo   - PostgreSQL Database   : localhost:5432 (trend_mr)
echo   - Web Backend/Dashboard : http://localhost:5555
echo   - Mobile Expo Client    : http://localhost:8081
echo.
echo [DEFAULT SEEDED CREDENTIALS]:
echo   - Admin Executive : email: admin@mrtracker.com        / password: Password@123 (or admin123)
echo   - MD Director     : email: md@mrtracker.com           / password: Password@123
echo   - ASM Manager     : email: asm@mrtracker.com          / password: Password@123 (or asm123)
echo   - MR Field Rep    : email: abdulmannan@mrtracker.com  / password: Password@123 (or mr12345)
echo.
echo =======================================================================
echo.

:: Ensure log directories exist
if not exist "%~dp0logs" mkdir "%~dp0logs"
if not exist "%~dp0logs\backend" mkdir "%~dp0logs\backend"
if not exist "%~dp0logs\frontend" mkdir "%~dp0logs\frontend"
if not exist "%~dp0web\logs" mkdir "%~dp0web\logs"
if not exist "%~dp0mobile\logs" mkdir "%~dp0mobile\logs"

:: 1. Check and Start PostgreSQL Service
echo [1/5] Checking PostgreSQL database on port 5432...
netstat -ano | findstr ":5432 " >nul
if %errorlevel% neq 0 (
    echo [INFO] PostgreSQL is not running. Attempting to start PostgreSQL service...
    net start postgresql-x64-18 >nul 2>&1
    ping 127.0.0.1 -n 4 >nul
    netstat -ano | findstr ":5432 " >nul
    if %errorlevel% neq 0 (
        color 0C
        echo [WARNING] PostgreSQL does not appear to be reachable on port 5432.
        echo Please ensure your PostgreSQL service is started and database 'trend_mr' exists.
        echo.
        pause
        color 0B
    ) else (
        echo [SUCCESS] PostgreSQL service started and listening on port 5432.
    )
) else (
    echo [SUCCESS] PostgreSQL is running on port 5432.
)
echo.

:: 2. Clean up any stale processes on ports 5555 and 8081
echo [2/5] Checking for stale port bindings (5555, 8081)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5555 " ^| findstr "LISTENING"') do (
    echo [INFO] Terminating stale process %%a on port 5555...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081 " ^| findstr "LISTENING"') do (
    echo [INFO] Terminating stale process %%a on port 8081...
    taskkill /F /PID %%a >nul 2>&1
)
echo [SUCCESS] Ports are clear.
echo.

:: 3. Verify dependencies
echo [3/5] Verifying Web and Mobile dependencies...
if not exist "%~dp0web\node_modules" (
    echo [INFO] web\node_modules missing. Running npm install in web...
    cd /d "%~dp0web"
    call npm install
    cd /d "%~dp0"
)
if not exist "%~dp0mobile\node_modules" (
    echo [INFO] mobile\node_modules missing. Running npm install in mobile...
    cd /d "%~dp0mobile"
    call npm install
    cd /d "%~dp0"
)
if not exist "%~dp0web\node_modules\@prisma\client" (
    echo [INFO] Generating Prisma client...
    cd /d "%~dp0web"
    call npm run db:generate
    cd /d "%~dp0"
)
echo [SUCCESS] Dependencies and Prisma client verified.
echo.

:: 4. Launch Web Backend/Dashboard and Mobile Expo
echo [4/5] Starting Web Dashboard and Mobile Client...
start "Trend MR - Web Dashboard (Port 5555)" /D "%~dp0web" cmd /k "title Trend MR - Web Dashboard (Port 5555) & npm run dev"
ping 127.0.0.1 -n 3 >nul

start "Trend MR - Mobile Client (Port 8081)" /D "%~dp0mobile" cmd /k "title Trend MR - Mobile Client (Port 8081) & npm run start"
echo [SUCCESS] Web and Mobile processes launched in dedicated terminal windows.
echo.

:: 5. Wait for Web Server to be ready before opening browser
echo [5/5] Waiting for Web Dashboard to initialize on port 5555...
set /a wait_count=0

:check_ready
ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr ":5555 " | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    set /a wait_count+=1
    if !wait_count! leq 40 (
        <nul set /p=.
        goto check_ready
    )
    echo.
    echo [INFO] Web Dashboard is compiling and will be ready shortly.
) else (
    echo.
    echo [SUCCESS] Web Dashboard is ready and listening on port 5555!
)

echo.
echo =======================================================================
echo All services are running!
echo   - Web Dashboard : http://localhost:5555
echo   - Mobile Expo   : http://localhost:8081 (scan QR code in Expo window)
echo.
echo Both terminal windows will stay open and display live logs.
echo Opening Web Dashboard in your browser...
echo =======================================================================
echo.

start "" "http://localhost:5555"

echo Launcher complete. You can keep this window open or close it at any time.
pause >nul
