$ErrorActionPreference='Stop'
$settings=Join-Path $env:LOCALAPPDATA 'KhzanahLocalTranslation'
$launcher=Join-Path $PSScriptRoot 'Start-Translation.ps1'
$agent=Join-Path $PSScriptRoot 'agent.mjs'
$mutex=New-Object Threading.Mutex($false,'Local\KhzanahBackgroundLaunch')
$locked=$false
try {
    try {$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(-not $locked){exit}
    foreach($file in @('worker-url.txt','agent-token.xml')){
        if(-not (Test-Path -LiteralPath (Join-Path $settings $file))){throw 'Missing connection settings. Open Start-Translation.cmd once.'}
    }
    # Check both loading and running stages before opening the same log files.
    $existing=@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='node.exe'" | Where-Object {
        $_.CommandLine -and ($_.CommandLine.Contains($launcher) -or $_.CommandLine.Contains($agent))
    })
    if($existing.Count){exit}
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$launcher+'"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $settings 'agent-output.log') -RedirectStandardError (Join-Path $settings 'agent-error.log') | Out-Null
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [void][Windows.Forms.MessageBox]::Show('تعذر بدء العامل الخلفي. افتح ملف عرض التقدم ثم اضغط استئناف الترجمة.','الخزانة')
    exit 1
} finally {
    if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()
}
