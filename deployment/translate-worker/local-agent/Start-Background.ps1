$ErrorActionPreference='Stop'
# All background entry points delegate to the one tray owner.
$powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$dashboard=Join-Path $PSScriptRoot 'Dashboard.ps1'
Start-Process $powershell -ArgumentList @('-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',('"'+$dashboard+'"'),'-StartAgent','-Tray') -WindowStyle Hidden | Out-Null