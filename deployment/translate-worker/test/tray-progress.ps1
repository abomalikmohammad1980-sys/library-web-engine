$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot '../local-agent/Dashboard.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-TrayProgress'},$true)
Invoke-Expression $fn.Extent.Text
$names=@{tr='Turkish';fr='French'}
$data=[pscustomobject]@{library=[pscustomobject]@{localActiveLanguage='tr';byLanguage=[pscustomobject]@{tr=[pscustomobject]@{ready=75;remaining=25};fr=[pscustomobject]@{ready=20;remaining=80}}}}
$p=Get-TrayProgress $data $names
if($p.Language -ne 'Turkish' -or $p.Short -notmatch '75'){throw 'Incorrect current-language progress'}
$data.library.localActiveLanguage='fr'
$p=Get-TrayProgress $data $names
if($p.Language -ne 'French' -or $p.Short -notmatch '20'){throw 'Language transition retained previous progress'}
$data.library.byLanguage.fr.ready=0;$data.library.byLanguage.fr.remaining=0
$p=Get-TrayProgress $data $names
if($p.Short -match 'NaN|Infinity'){throw 'Invalid empty counts'}
$p=Get-TrayProgress $null $names
if(-not $p.Progress){throw 'Missing initial state'}
Write-Output 'PASS tray: language-specific progress, language transition, zero counts, initial state'