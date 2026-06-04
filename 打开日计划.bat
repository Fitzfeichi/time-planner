@echo off
cd /d "%~dp0"

if not exist "node_modules\.bin\tauri.cmd" (
  echo Tauri dependencies are not installed. Run npm.cmd install first.
  pause
  exit /b 1
)

call npm.cmd run tauri:dev
if errorlevel 1 (
  pause
  exit /b 1
)
