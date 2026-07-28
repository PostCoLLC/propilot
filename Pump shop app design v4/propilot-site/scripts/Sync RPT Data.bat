@echo off
REM Pro Pilot - pull full RPT history and build rpt-feed.json
REM Double-click this file. It runs the sync with Node from its own folder.
cd /d "%~dp0"
echo ============================================
echo   Pro Pilot - RPT Full History Sync
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install it from https://nodejs.org  ^(click the "LTS" button^),
  echo then double-click this file again.
  echo.
  pause
  exit /b
)
echo Pulling ~5 years of history from RodPumpTracker...
echo This can take a few minutes. Please wait.
echo.
node rpt-sync.js
echo.
echo ============================================
echo   Done. Look for rpt-feed.json in this folder.
echo ============================================
pause
