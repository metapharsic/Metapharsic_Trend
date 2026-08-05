@echo off
title Pharma OS Suite Runner with Integrated Logs
color 0B

echo =======================================================================
echo                     PHARMA OS SUITE - LOCAL RUNNER
echo =======================================================================
echo.
echo [CONFIG] Ports and Endpoints:
echo  - Local Database (PostgreSQL) : localhost:5432
echo  - Web Backend / Dashboard      : http://localhost:5555
echo  - Mobile Expo Packager         : http://localhost:8081 (default Expo port)
echo.
echo [LOGS LOCATION]:
echo  - Frontend Mobile Logs  : C:\Trend_MR\mobile\logs\
echo  - Backend Database Logs : C:\Trend_MR\web\logs\
echo.
echo [SEEDED CREDENTIALS]:
echo  - Admin Manager: email: admin@mrtracker.com | password: admin123
echo  - ASM Manager:   email: asm@mrtracker.com   | password: asm123
echo  - MR Field Rep:  email: mr@mrtracker.com    | password: mr12345
echo.
echo =======================================================================
echo.

:: Create logs folder structure if they do not exist
if not exist C:\Trend_MR\mobile\logs mkdir C:\Trend_MR\mobile\logs
if not exist C:\Trend_MR\web\logs mkdir C:\Trend_MR\web\logs

:: 1. Verify PostgreSQL Database is listening on port 5432
echo [1/3] Checking local database connection...
netstat -ano | findstr 5432 >nul
if %errorlevel% neq 0 (
    color 0C
    echo [WARNING] PostgreSQL does not appear to be running on port 5432.
    echo Please make sure your local PostgreSQL database is started and database 'mktracker' exists.
    echo.
    pause
    color 0B
) else (
    echo [SUCCESS] Local database is listening on port 5432.
)
echo.

:: 2. Launch Web Backend/Dashboard with Tee-Object Logging
echo [2/3] Starting Web Backend/Dashboard (port 5555) with logging...
start "Pharma OS - Web Dashboard" powershell -NoProfile -ExecutionPolicy Bypass -Command "cd web; npm run dev | Tee-Object -FilePath 'C:\Trend_MR\web\logs\web.log'"
timeout /t 3 /nobreak >nul

:: 3. Launch Mobile Expo Packager with Tee-Object Logging
echo [3/3] Starting Mobile Expo Packager with logging...
start "Pharma OS - Mobile Client" powershell -NoProfile -ExecutionPolicy Bypass -Command "cd mobile; npm run start | Tee-Object -FilePath 'C:\Trend_MR\mobile\logs\mobile.log'"

echo.
echo =======================================================================
echo All services have been launched in separate terminal windows!
echo  - Web dashboard is loading at: http://localhost:5555
echo  - Scan the QR code in the Expo terminal window to run on your device.
echo  - Terminal logs are mirrored to 'C:\Trend_MR\web\logs\web.log' and 'C:\Trend_MR\mobile\logs\mobile.log'.
echo =======================================================================
echo.
pause
