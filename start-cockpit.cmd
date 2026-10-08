@echo off
setlocal
title AI Cohost - Cockpit
pushd "%~dp0apps\soul\agent"
if errorlevel 1 (
  echo Could not find the Soul agent directory.
  pause
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js and try again.
  popd
  pause
  exit /b 1
)
echo Starting Cockpit. Your browser will open when the server is ready.
echo Keep this window open. Press Ctrl+C here to stop Cockpit.
node scripts\cockpit.mjs --open %*
set "cockpitExitCode=%errorlevel%"
popd
if not "%cockpitExitCode%"=="0" (
  echo.
  echo Cockpit stopped with an error. See the message above.
  pause
)
exit /b %cockpitExitCode%
