@echo off
setlocal
chcp 65001 >nul
set "APP=%~dp0Dashboard.ps1"
if not exist "%APP%" exit /b 1
timeout /t 3 /nobreak >nul
start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%APP%" -StartAgent -Tray
endlocal
