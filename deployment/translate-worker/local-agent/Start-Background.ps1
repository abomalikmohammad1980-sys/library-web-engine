$ErrorActionPreference='Stop'
$settings=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'KhzanahLocalTranslation'
$launcher=Join-Path $PSScriptRoot 'Start-Translation.ps1'
$mutex=New-Object Threading.Mutex($false,'Local\KhzanahBackgroundLaunch')
$locked=$false
$agentMutex=$null
$problem=$null
$stage='launch-lock'
try {
    try {$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(-not $locked){exit}
    # The launcher owns this mutex during BOTH loading and translation.
    # WMI/CIM process enumeration can be denied for an ordinary launch.
    $stage='agent-lock'
    $agentMutex=New-Object Threading.Mutex($false,'Local\KhzanahHyMTTranslationAgent')
    $available=$false
    try {$available=$agentMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$available=$true}
    if(-not $available){exit}
    $agentMutex.ReleaseMutex()
    $stage='settings'
    foreach($file in @('worker-url.txt','agent-token.xml')){
        $stage='settings-'+$file
        if(-not (Test-Path -LiteralPath (Join-Path $settings $file))){throw 'Missing connection settings. Open Start-Translation.cmd once.'}
    }
    $stage='start-process'
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$launcher+'"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $settings 'agent-output.log') -RedirectStandardError (Join-Path $settings 'agent-error.log') | Out-Null
} catch {
    $problem=[pscustomobject]@{stage=$stage;type=$_.Exception.GetType().FullName;hresult=$_.Exception.HResult;time=[datetime]::UtcNow.ToString('o')}
    try {$problem|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $settings 'background-start-error.json') -Encoding UTF8}catch {
        try {$problem|ConvertTo-Json|Set-Content -LiteralPath (Join-Path ([IO.Path]::GetTempPath()) 'Khzanah-background-start-error.json') -Encoding UTF8}catch {}
    }
} finally {
    if($agentMutex){$agentMutex.Dispose()}
    if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()
}
if($problem){
    # Never keep the launch lock held while a message box is open.
    Add-Type -AssemblyName System.Windows.Forms
    [void][Windows.Forms.MessageBox]::Show(('تعذر بدء العامل. رمز التشخيص: '+$problem.stage+'. التقدم محفوظ في Cloudflare.'),'الخزانة')
    exit 1
}
