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

# A single CIM result is unwrapped by PowerShell and has no Count property.
# Exercise the actual control updater with one running process, not just booleans.
$fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Update-RunControls'},$true)
Invoke-Expression $fn.Extent.Text
function Get-AgentProcesses { New-CimInstance -ClassName Win32_Process -ClientOnly -Property @{ProcessId=[uint32]123} }
function Get-LauncherProcesses { @() }
function Update-TrayView {}
Add-Type -AssemblyName System.Drawing
$script:desired=$false;$script:cloudOnline=$true;$script:activeJobs=1;$script:nextState=[datetime]::MinValue
$runStatus=[pscustomobject]@{Text='';ForeColor=''};$stateHelp=[pscustomobject]@{Text=''}
$startButton=[pscustomobject]@{Enabled=$true;BackColor=''};$stopButton=[pscustomobject]@{Enabled=$false;BackColor=''}
Update-RunControls
if($startButton.Enabled -or -not $stopButton.Enabled){throw 'Single running CIM process was treated as stopped'}
Write-Output 'PASS single CIM process enables Stop, disables Start'