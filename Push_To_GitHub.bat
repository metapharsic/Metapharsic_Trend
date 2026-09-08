@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Trend MR Pharma OS - Push to GitHub Wizard
color 0B

echo =======================================================================
echo         TREND MR PHARMA OS - SECURE GITHUB PUSH WIZARD
echo =======================================================================
echo.

if not exist "logs\git" mkdir "logs\git"

where git >nul 2>nul
if errorlevel 1 goto NOGIT

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" set CURRENT_BRANCH=main
for /f "tokens=*" %%i in ('git remote get-url origin') do set REMOTE_URL=%%i

echo [REPOSITORY CONTEXT]
echo  - Active Branch : [%CURRENT_BRANCH%]
echo  - Target Remote : origin (%REMOTE_URL%)
echo =======================================================================
echo.

echo [STEP 0/5] Pre-flight self-troubleshooting & workspace cleanup...
if exist "web\dms_extracted" rmdir /s /q "web\dms_extracted" >nul 2>&1
if exist "dms_extracted" rmdir /s /q "dms_extracted" >nul 2>&1
echo  - Pre-flight cleanup complete.
echo.

echo [STEP 1/5] Inspecting local workspace changes...
echo.
set HAS_UNCOMMITTED=no
for /f "tokens=*" %%i in ('git status --porcelain') do set HAS_UNCOMMITTED=yes
if "%HAS_UNCOMMITTED%"=="no" goto CLEAN

echo -----------------------------------------------------------------------
echo  UNCOMMITTED LOCAL MODIFICATIONS DETECTED ^(files enclosed in this push^):
echo -----------------------------------------------------------------------
git status --short
echo -----------------------------------------------------------------------
echo.
echo Enter a commit message for these changes:
echo Press ENTER to auto-generate a timestamped sync message
echo -----------------------------------------------------------------------
set COMMIT_MSG=
set /p COMMIT_MSG="[Commit Message / Press ENTER]: "
if not "%COMMIT_MSG%"=="" goto HAVEMSG
for /f "tokens=*" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm"') do set ts=%%I
set COMMIT_MSG=sync: trend mr pharma os updates !ts!
:HAVEMSG
echo.
echo Staging and committing changes with: "%COMMIT_MSG%"...
git add -A
git commit -m "%COMMIT_MSG%"
echo.
goto AFTERCOMMIT

:CLEAN
echo  Workspace is clean. All local modifications are already committed.
echo.

:AFTERCOMMIT
set TARGET_BRANCH=%CURRENT_BRANCH%
echo [STEP 2/5] Target branch: [%TARGET_BRANCH%]
echo.

echo =======================================================================
echo [STEP 3/5] REVIEWING OUTGOING COMMITS TO BE PUSHED
echo =======================================================================
echo.

echo Refreshing knowledge of origin/%TARGET_BRANCH% before comparing...
git fetch origin %TARGET_BRANCH% --quiet 2>nul

git rev-parse --verify origin/%TARGET_BRANCH% >nul 2>&1
if errorlevel 1 goto FIRSTPUSH

echo --- COMMITS AHEAD OF origin/%TARGET_BRANCH% ^(about to be sent^) ---
git log origin/%TARGET_BRANCH%..HEAD --pretty=format:" [%%h] %%ad ^| %%s ^(%%an^)" --date=short
echo.
echo.
echo --- FILES ENCLOSED IN THIS PUSH ^(full diff vs origin^) ---
git diff --stat origin/%TARGET_BRANCH%..HEAD
echo.
goto SHOWLATEST

:FIRSTPUSH
color 0E
echo  origin/%TARGET_BRANCH% does not exist yet on GitHub -- this looks like
echo  the FIRST push of this branch. Showing local commit history instead:
echo -----------------------------------------------------------------------
git log -n 10 --pretty=format:" [%%h] %%ad ^| %%s ^(%%an^)" --date=short
echo.
echo.
echo --- FILES IN THIS REPOSITORY ^(tracked, about to be sent^) ---
git ls-files > "%TEMP%\trend_mr_filecount.txt"
for /f %%C in ('find /c /v "" ^< "%TEMP%\trend_mr_filecount.txt"') do echo  Total tracked files: %%C
del "%TEMP%\trend_mr_filecount.txt" >nul 2>&1
echo.
color 0B

:SHOWLATEST
echo --- LATEST COMMIT DETAILS ---
git show --stat --oneline -n 1
echo.
echo =======================================================================
echo.

echo Do you want to push these commits to GitHub right now?
echo  [Y] Yes, push now ^(Press ENTER to proceed^)
echo  [N] No, cancel push
echo.
set USER_CONFIRM=Y
set /p USER_CONFIRM="Select [Y/N] (Default: Y - Press ENTER to push): "
if /i "%USER_CONFIRM%"=="N" goto CANCELLED

echo.
echo =======================================================================
echo [STEP 4/5] PUSHING DATA TO GITHUB WITH COMPLETE LOGS
echo =======================================================================
echo.

for /f "tokens=*" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set dt=%%I
set LOG_FILE=logs\git\push_%dt%.log

echo Log File Location   : %LOG_FILE%
echo.

git push -u origin %TARGET_BRANCH% --progress --verbose > "%LOG_FILE%" 2>&1
set PUSH_RESULT=%errorlevel%
type "%LOG_FILE%"

if not %PUSH_RESULT%==0 goto PUSHFAILED

color 0A
echo.
echo =======================================================================
echo  SUCCESS: All changes pushed to GitHub successfully!
echo  Remote Branch : origin/%TARGET_BRANCH%
echo  Complete Log  : %LOG_FILE%
echo =======================================================================
echo.
echo [STEP 5/5] REMINDER: pushing to GitHub does NOT deploy to the VPS by itself.
echo  - The commit-triggered auto-sync (git-post-commit.ts) already mirrors
echo    this commit files to the VPS as part of the local git commit above.
echo  - To rebuild and restart the live VPS app now, click the Update button
echo    in the app, or run: npx tsx scripts\push-local-to-vps.ts
echo =======================================================================
echo.
goto END

:PUSHFAILED
color 0C
echo.
echo =======================================================================
echo  PUSH FAILED: Please check your SSH keys or network connection.
echo  A detailed diagnostic log was saved to:
echo  %LOG_FILE%
echo =======================================================================
echo.
goto END

:CANCELLED
color 0E
echo.
echo [CANCELLED] Push aborted by user. No data was transferred.
echo.
pause
exit /b 0

:NOGIT
color 0C
echo [ERROR] Git is not installed or not in system PATH.
echo Please install Git for Windows to use this script.
echo.
pause
exit /b 1

:END
pause
