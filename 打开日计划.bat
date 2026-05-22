@echo off
cd /d "%~dp0"
set "ELECTRON_EXE=%~dp0node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON_EXE%" (
  echo Electron is not installed. Run npm.cmd install first.
  pause
  exit /b 1
)

call npm.cmd run build
if errorlevel 1 (
  pause
  exit /b 1
)

start "" "%ELECTRON_EXE%" .
