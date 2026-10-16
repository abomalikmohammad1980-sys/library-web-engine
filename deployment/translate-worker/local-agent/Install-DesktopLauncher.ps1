param([string]$Destination=(Join-Path ([Environment]::GetFolderPath('Desktop')) 'Khzanah-Translate.cmd'))
$ErrorActionPreference='Stop'
$dashboard=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Dashboard.ps1'))
if(-not (Test-Path -LiteralPath $dashboard -PathType Leaf)){throw 'Dashboard missing'}
# ASCII batch file; PowerShell receives the Unicode script path losslessly.
$command="& '"+$dashboard.Replace("'","''")+"' -StartAgent -Tray"
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$lines=@('@echo off','setlocal',('start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand '+$encoded),'endlocal')
[IO.File]::WriteAllText($Destination,($lines -join "`r`n")+"`r`n",[Text.Encoding]::ASCII)
Write-Output $Destination
