$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '..\local-agent\Dashboard.ps1'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
# Load only the actual lifecycle functions. Never execute the dashboard or
# launch a real child, read real credentials, or contact Cloudflare.
foreach($name in @('Start-LocalAgent','Connect-TranslationCloud','Stop-LocalProcesses')){
    $fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
    if(-not $fn){throw ('Missing testable lifecycle function: '+$name)}
    $functionSource=$fn.Extent.Text
    if($name -eq 'Stop-LocalProcesses'){
        # Isolate only the OS event name: this test must never signal the
        # actual running translator while testing its shutdown function.
        $functionSource=$functionSource.Replace('Local\KhzanahTranslationStop',('Local\KhzanahDashboardTestStop-'+[guid]::NewGuid().ToString('N')))
    }
    Invoke-Expression $functionSource
}
Add-Type -AssemblyName System.Net.Http
$script:launchCalls=0;$script:mutexHeld=$false;$script:diagnosticStages=@();$script:credentialReads=0
function Test-TranslationAgentRunning { return $script:mutexHeld }
function Write-TranslationDiagnostic([string]$Stage,$ErrorRecord,$Details) { $script:diagnosticStages+=$Stage }
function Start-Process {
    param([string]$FilePath,$ArgumentList,[string]$WindowStyle,[switch]$PassThru,[string]$RedirectStandardOutput,[string]$RedirectStandardError)
    if($WindowStyle -ne 'Hidden'){throw 'Background launcher must stay hidden.'}
    if($ArgumentList -notcontains '-Background' -or $ArgumentList -notcontains '-NonInteractive'){throw 'Background launcher must not prompt in a hidden window.'}
    $script:launchCalls++
    $child=[pscustomobject]@{Id=(1000+$script:launchCalls);HasExited=$false;Disposed=$false}
    $child|Add-Member -MemberType ScriptMethod -Name Dispose -Value {$this.Disposed=$true}
    return $child
}
function Import-Clixml {
    param([string]$LiteralPath)
    $script:credentialReads++
    if($script:credentialFailure){throw 'synthetic-decryption-failure'}
    return ConvertTo-SecureString ('test-only-'+('x'*40)) -AsPlainText -Force
}
function Get-TranslationProcess([string]$Role) {
    if($Role -eq 'launcher' -and $script:registeredLauncher -and -not $script:launcherQuiesced){return $script:shutdownLauncher}
    return $null
}
function Stop-TranslationProcess([string]$Role) {
    $script:shutdownSteps+=('stop-'+$Role)
    if($Role -eq 'launcher'){
        if($script:registeredLauncher){$script:launcherQuiesced=$true;$script:shutdownLauncher.HasExited=$true;return $true}
        return $false
    }
    if(-not $script:launcherQuiesced){throw 'A live launcher can spawn a child after its shutdown sweep.'}
    return $true
}
function New-ShutdownTestLauncher {
    $child=[pscustomobject]@{Id=2000;HasExited=$false;Disposed=$false}
    $child|Add-Member -MemberType ScriptMethod -Name WaitForExit -Value {param($milliseconds) return $this.HasExited}
    $child|Add-Member -MemberType ScriptMethod -Name Dispose -Value {$this.Disposed=$true}
    $child|Add-Member -MemberType ScriptMethod -Name Kill -Value {$this.HasExited=$true;$script:launcherQuiesced=$true;$script:shutdownSteps+='kill-cached-launcher'}
    return $child
}
$passed=0
function Assert-Startup($condition,[string]$message){if(-not $condition){throw $message};$script:passed++}
$settings=Join-Path ([IO.Path]::GetTempPath()) ('Khzanah-dashboard-test-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($settings)
$utf8=New-Object Text.UTF8Encoding($false,$true)
$launcherFile=Join-Path $settings 'unused-launcher.ps1'
$logFile=Join-Path $settings 'unused-output.log'
$connection=[pscustomobject]@{Text=''}
$notify=[pscustomobject]@{Visible=$true}
$script:exitMonitor=$false;$script:launcherProcess=$null;$script:client=$null;$script:lastStart=[datetime]::MinValue
try {
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 0) 'Do not launch without usable connection settings.'
    $script:client=[pscustomobject]@{}
    $script:exitMonitor=$true
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 0) 'Do not launch during shutdown.'
    $script:exitMonitor=$false;$script:mutexHeld=$true
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 0) 'An existing worker mutex must prevent another launcher.'
    $script:mutexHeld=$false
    $script:launcherProcess=[pscustomobject]@{Id=999;HasExited=$false}
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 0) 'A live child handle must prevent another launch before it acquires its mutex.'
    $script:launcherProcess=$null
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 1) 'A cold start must launch exactly once.'
    $firstChild=$script:launcherProcess
    $script:lastStart=[datetime]::MinValue
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 1) 'Repeated clicks must not launch another live child.'
    $firstChild.HasExited=$true
    Start-LocalAgent
    Assert-Startup ($script:launchCalls -eq 2) 'A terminated child must be restartable.'
    Assert-Startup $firstChild.Disposed 'An exited child handle must be released before replacement.'

    $script:client=$null;$script:nextConnect=[datetime]::MinValue;$script:credentialFailure=$true;$script:cloudOnline=$false
    [IO.File]::WriteAllText((Join-Path $settings 'worker-url.txt'),'https://example.invalid',$utf8)
    Connect-TranslationCloud
    Assert-Startup ($script:connectionProblem -eq 'decrypt-settings') 'A failed credential read must remain a recoverable connection state.'
    Assert-Startup ($null -eq $script:client) 'Failed credentials must not publish a partial HTTP client.'
    Assert-Startup ($notify.Visible -and -not $script:exitMonitor) 'A credential failure must leave the tray available for full exit.'
    Assert-Startup ($script:diagnosticStages -contains 'decrypt-settings') 'The failed startup stage must be preserved for diagnosis.'
    $before=$script:credentialReads
    Connect-TranslationCloud
    Assert-Startup ($script:credentialReads -eq $before) 'Connection retries must be bounded instead of spinning.'
    $script:credentialFailure=$false;$script:nextConnect=[datetime]::MinValue
    Connect-TranslationCloud
    Assert-Startup ($null -ne $script:client -and -not $script:connectionProblem) 'The same dashboard must recover when credentials become usable.'
    Assert-Startup ($script:diagnosticStages -contains 'connection-ready') 'Successful retry must record readiness without deleting the earlier failure.'
    $script:launcherProcess.Dispose();$script:launcherProcess=$null
    $script:registeredLauncher=$true;$script:launcherQuiesced=$false;$script:shutdownSteps=@();$script:desired=$true
    $script:shutdownLauncher=New-ShutdownTestLauncher
    Stop-LocalProcesses
    Assert-Startup (-not $script:desired) 'Shutdown must disable future automatic starts.'
    Assert-Startup ($script:launcherQuiesced -and $script:shutdownSteps[0] -eq 'stop-launcher') 'A stalled registered launcher must stop before the final child sweep.'
    Assert-Startup $script:shutdownLauncher.Disposed 'The retrieved shutdown launcher handle must be released.'
    $script:registeredLauncher=$false;$script:launcherQuiesced=$false;$script:shutdownSteps=@()
    $script:launcherProcess=New-ShutdownTestLauncher
    Stop-LocalProcesses
    Assert-Startup ($script:launcherProcess.HasExited -and $script:launcherQuiesced) 'Fallback shutdown must stop a cached child whose marker is unavailable.'
    Assert-Startup (($script:shutdownSteps -join ',') -eq 'stop-launcher,kill-cached-launcher,stop-agent,stop-model') 'The cached launcher must be killed before agents and models are swept.'
    Write-Output ('PASS: '+$passed+' dashboard startup checks; no real processes, credentials or network used.')
} finally {
    if($script:client -is [IDisposable]){$script:client.Dispose()}
    if($script:launcherProcess -and $script:launcherProcess.PSObject.Methods['Dispose']){$script:launcherProcess.Dispose()}
    Get-ChildItem -LiteralPath $settings -File|ForEach-Object {Remove-Item -LiteralPath $_.FullName -Force}
    Remove-Item -LiteralPath $settings
}
