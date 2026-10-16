$ErrorActionPreference='Stop'
$path=(Join-Path $PSScriptRoot '../local-agent/Dashboard.ps1')
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-RunState'},$true)
Invoke-Expression $function.Extent.Text
$cases=@(
    @{name='stopped';desired=$false;agent=$false;launcher=$false;online=$true;jobs=1;start=$true;stop=$false},
    @{name='translating';desired=$true;agent=$true;launcher=$true;online=$true;jobs=1;start=$false;stop=$true},
    @{name='loading';desired=$true;agent=$false;launcher=$true;online=$false;jobs=0;start=$false;stop=$true},
    @{name='offline';desired=$true;agent=$true;launcher=$true;online=$false;jobs=1;start=$false;stop=$true},
    @{name='retrying';desired=$true;agent=$false;launcher=$false;online=$false;jobs=0;start=$false;stop=$true},
    @{name='idle';desired=$true;agent=$true;launcher=$true;online=$true;jobs=0;start=$false;stop=$true}
)
foreach($case in $cases){
    $state=Get-RunState $case.desired $case.agent $case.launcher $case.online $case.jobs
    if($state.StartEnabled -ne $case.start -or $state.StopEnabled -ne $case.stop){throw ('Incorrect controls: '+$case.name)}
    if(-not $state.Text -or -not $state.Hint){throw 'Missing explanation'}
    Write-Output ('PASS '+$case.name)
}

# Exercise the actual updater with the Runtime API's explicit null result,
# and with one process. An array containing null must not count as running.
$fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Update-RunControls'},$true)
Invoke-Expression $fn.Extent.Text
foreach($name in @('Get-AgentProcesses','Get-LauncherProcesses')){
    $fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
    if($fn){Invoke-Expression $fn.Extent.Text}
}
$script:fakeAgent=$null;$script:fakeLauncher=$null
function Get-TranslationProcess([string]$Role) {
    if($Role -eq 'agent'){return $script:fakeAgent}
    if($Role -eq 'launcher'){return $script:fakeLauncher}
    return $null
}
function Update-TrayView {}
Add-Type -AssemblyName System.Drawing,System.Windows.Forms
Add-Type -TypeDefinition @'
public sealed class DashboardStateTestProcess : System.IDisposable {
    public int Id { get; set; }
    public string ProcessName { get; set; }
    public bool Disposed { get; private set; }
    public void Dispose() { Disposed = true; }
}
'@
$script:desired=$false;$script:cloudOnline=$true;$script:activeJobs=1;$script:nextState=[datetime]::MinValue;$script:connectionProblem=$null
$runStatus=[pscustomobject]@{Text='';ForeColor=''};$stateHelp=[pscustomobject]@{Text=''}
$startButton=[pscustomobject]@{Enabled=$true;BackColor=''};$stopButton=[pscustomobject]@{Enabled=$false;BackColor=''}
$notify=New-Object Windows.Forms.NotifyIcon
try {
    Update-RunControls
    if(-not $startButton.Enabled -or $stopButton.Enabled){throw 'Null runtime processes were incorrectly reported as running'}
    Write-Output 'PASS absent runtime processes enable Start and disable Stop'
    $script:fakeAgent=New-Object DashboardStateTestProcess
    $script:fakeAgent.Id=123;$script:fakeAgent.ProcessName='node'
    $script:nextState=[datetime]::MinValue
    Update-RunControls
    if($startButton.Enabled -or -not $stopButton.Enabled){throw 'Single running process was treated as stopped'}
    if(-not $script:fakeAgent.Disposed){throw 'Runtime process handles must be disposed after reading state'}
    Write-Output 'PASS single running process enables Stop, disables Start and releases its handle'
    $script:fakeAgent=$null
    $script:fakeLauncher=New-Object DashboardStateTestProcess
    $script:fakeLauncher.Id=124;$script:fakeLauncher.ProcessName='powershell'
    $script:nextState=[datetime]::MinValue
    Update-RunControls
    if($startButton.Enabled -or -not $stopButton.Enabled){throw 'Model loading must remain stoppable'}
    if(-not $script:fakeLauncher.Disposed){throw 'Launcher process handle must be disposed after reading state'}
    Write-Output 'PASS model loading remains stoppable and releases its handle'
} finally {$notify.Dispose()}
