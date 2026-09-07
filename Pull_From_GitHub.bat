@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Trend MR Pharma OS - Pull from GitHub (Detailed Inspector and Logger)
color 0B

echo =======================================================================
echo              TREND MR PHARMA OS - GITHUB PULL WIZARD
echo =======================================================================
echo.

if not exist "logs\git" mkdir "logs\git"

where git >nul 2>&1
if errorlevel 1 goto NOGIT

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" set CURRENT_BRANCH=main
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set REMOTE_URL=%%i

echo [REPOSITORY CONTEXT]
echo  - Active Branch : [%CURRENT_BRANCH%]
echo  - Target Remote : origin (%REMOTE_URL%)
echo =======================================================================
echo.

set TARGET_BRANCH=%CURRENT_BRANCH%
echo [STEP 1/4] Branch to pull: [%TARGET_BRANCH%]
echo.

set HAS_UNCOMMITTED=no
for /f "tokens=*" %%i in ('git status --porcelain') do set HAS_UNCOMMITTED=yes
if "%HAS_UNCOMMITTED%"=="no" goto CLEANPULL

color 0E
echo [STEP 2/4] WARNING: Uncommitted local changes detected -- these files
echo will NOT be touched by pull, but review them before continuing:
echo -----------------------------------------------------------------------
git status --short
echo -----------------------------------------------------------------------
echo.
color 0B
goto AFTERWARN

:CLEANPULL
echo [STEP 2/4] Workspace is clean. Safe to pull.
echo.

:AFTERWARN
echo =======================================================================
echo [STEP 3/4] FETCHING AND PULLING LATEST COMMITS FROM GITHUB
echo =======================================================================
echo.

for /f "tokens=*" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set dt=%%I
set LOG_FILE=logs\git\pull_%dt%.log

echo Log File Location   : %LOG_FILE%
echo.

for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set BEFORE_HASH=%%i

git pull origin %TARGET_BRANCH% --progress --verbose > "%LOG_FILE%" 2>&1
set PULL_RESULT=%errorlevel%
type "%LOG_FILE%"

for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set AFTER_HASH=%%i

if not %PULL_RESULT%==0 goto PULLFAILED

color 0A
echo.
echo =======================================================================
echo [SUCCESS] LATEST UPDATES SUCCESSFULLY PULLED FROM GITHUB!
echo  - Branch      : %TARGET_BRANCH%
echo  - Before      : %BEFORE_HASH%
echo  - After       : %AFTER_HASH%
echo  - Log saved   : %LOG_FILE%
echo =======================================================================
echo.
if "%BEFORE_HASH%"=="%AFTER_HASH%" goto NONEWCOMMITS

echo [STEP 4/4] FILES RECEIVED IN THIS PULL ^(%BEFORE_HASH% to %AFTER_HASH%^):
echo -----------------------------------------------------------------------
git diff --stat %BEFORE_HASH% %AFTER_HASH%
echo -----------------------------------------------------------------------
goto AFTERFILELIST

:NONEWCOMMITS
echo [STEP 4/4] No new commits -- workspace was already up to date.

:AFTERFILELIST
echo.
echo --- RECENT 3 COMMITS ON LOCAL WORKSPACE ---
git log -n 3 --pretty=format:" [%%h] %%ad ^| %%s ^(%%an^)" --date=short
echo.
echo.
echo NOTE: pulled files are NOT yet live on the VPS. Run the apps
echo Update button, or the local push-to-VPS script, to deploy them.
goto END

:PULLFAILED
color 0C
echo.
echo =======================================================================
echo [FAILED] Pull encountered an error (Exit Code: %PULL_RESULT%).
echo Detailed logs written to: %LOG_FILE%
echo.
echo Check for local conflicting changes or uncommitted modifications.
echo =======================================================================
goto END

:NOGIT
color 0C
echo [ERROR] Git is not installed or not found in system PATH.
echo Please install Git from https://git-scm.com/ and try again.
echo.
pause
exit /b 1

:END
echo.
pause
