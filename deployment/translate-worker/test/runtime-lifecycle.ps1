$ErrorActionPreference = 'Stop'
$runtimeFile = Join-Path $PSScriptRoot '..\local-agent\Runtime.ps1'
if (-not (Test-Path -LiteralPath $runtimeFile)) { throw 'Runtime.ps1 is required for lifecycle safety tests.' }
. $runtimeFile
$script:TranslationRuntimeSettingsDirectory = Join-Path ([IO.Path]::GetTempPath()) ('Khzanah-runtime-test-' + [guid]::NewGuid().ToString('N'))
$script:TranslationRuntimeAgentMutexName = 'Local\KhzanahRuntimeTest-' + [guid]::NewGuid().ToString('N')
[void][IO.Directory]::CreateDirectory($script:TranslationRuntimeSettingsDirectory)
$testChildren = New-Object 'System.Collections.Generic.List[System.Diagnostics.Process]'
$passed = 0
function Assert-Runtime($condition, [string]$message) {
    if (-not $condition) { throw $message }
    $script:passed++
}
function New-TestSleeper {
    $child = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList '-NoLogo -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 30"' -WindowStyle Hidden -PassThru
    $testChildren.Add($child)
    return $child
}
try {
    Assert-Runtime ((Get-TranslationSettingsDirectory) -eq $script:TranslationRuntimeSettingsDirectory) 'Tests must use isolated settings.'
    Assert-Runtime (-not (Test-TranslationAgentRunning)) 'An unowned mutex must report stopped.'
    $lockReady = Join-Path $script:TranslationRuntimeSettingsDirectory 'mutex-ready.txt'
    $lockScript = '$m=New-Object Threading.Mutex($false,'''+$script:TranslationRuntimeAgentMutexName+''');[void]$m.WaitOne();[IO.File]::WriteAllText('''+$lockReady+''',''ready'');Start-Sleep -Seconds 30'
    $lockArgs = '-NoLogo -NoProfile -NonInteractive -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($lockScript))
    $lockChild = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $lockArgs -WindowStyle Hidden -PassThru
    $testChildren.Add($lockChild)
    $deadline = [datetime]::UtcNow.AddSeconds(10)
    while (-not (Test-Path -LiteralPath $lockReady) -and [datetime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 50 }
    Assert-Runtime (Test-Path -LiteralPath $lockReady) 'Mutex child did not start.'
    Assert-Runtime (Test-TranslationAgentRunning) 'A different process owning the agent mutex must report running.'
    $lockChild.Kill(); [void]$lockChild.WaitForExit(3000)
    Assert-Runtime (-not (Test-TranslationAgentRunning)) 'An abandoned mutex must report stopped and be released.'

    $child = New-TestSleeper
    $registered = Register-TranslationProcess -Role launcher -ProcessId $child.Id
    Assert-Runtime ($registered.processId -eq $child.Id) 'Registration must record the exact child PID.'
    $registeredAgain = Register-TranslationProcess -Role launcher -ProcessId $child.Id
    Assert-Runtime ($registeredAgain.startTimeUtcTicks -eq $registered.startTimeUtcTicks) 'Replacing an existing role marker must preserve the exact live process identity.'
    Assert-Runtime (@(Get-ChildItem -LiteralPath $script:TranslationRuntimeSettingsDirectory -Filter '*.tmp').Count -eq 0) 'Atomic marker replacement must not leave temporary files.'
    $found = Get-TranslationProcess -Role launcher
    try { Assert-Runtime ($found.Id -eq $child.Id) 'A matching child must be found.' } finally { if ($found) { $found.Dispose() } }
    $markerPath = Join-Path $script:TranslationRuntimeSettingsDirectory 'launcher-runtime.json'
    $original = [IO.File]::ReadAllText($markerPath)
    $marker = $original | ConvertFrom-Json
    $marker.startTimeUtcTicks = ([long]$marker.startTimeUtcTicks + 1).ToString()
    [IO.File]::WriteAllText($markerPath, ($marker | ConvertTo-Json -Compress))
    Assert-Runtime ($null -eq (Get-TranslationProcess -Role launcher)) 'Reused or mismatched PID start time must not match.'
    Assert-Runtime (-not (Stop-TranslationProcess -Role launcher)) 'Mismatched start time must never stop a process.'
    $child.Refresh()
    Assert-Runtime (-not $child.HasExited) 'Mismatched process was terminated.'
    $marker.startTimeUtcTicks = $registered.startTimeUtcTicks
    $marker.processName = 'node'
    [IO.File]::WriteAllText($markerPath, ($marker | ConvertTo-Json -Compress))
    Assert-Runtime ($null -eq (Get-TranslationProcess -Role launcher)) 'A wrong process name must not match.'
    $marker.processName = $registered.processName
    $marker.scriptRoot = 'C:\unrelated-project'
    [IO.File]::WriteAllText($markerPath, ($marker | ConvertTo-Json -Compress))
    Assert-Runtime (-not (Stop-TranslationProcess -Role launcher)) 'An unrelated project marker must not stop a process.'
    [IO.File]::WriteAllText($markerPath, $original)
    Unregister-TranslationProcess -Role launcher -ProcessId ($child.Id + 1)
    Assert-Runtime (Test-Path -LiteralPath $markerPath) 'Another owner must not clear a marker.'
    Assert-Runtime (Stop-TranslationProcess -Role launcher) 'An exactly matching registered child must stop.'
    $child.Refresh()
    Assert-Runtime $child.HasExited 'The registered child did not stop.'
    Assert-Runtime (-not (Test-Path -LiteralPath $markerPath)) 'Stopped child marker must be removed.'
    Assert-Runtime (-not (Stop-TranslationProcess -Role launcher)) 'Stopping again must be harmless.'

    $other = New-TestSleeper
    $rejected = $false
    try { [void](Register-TranslationProcess -Role model -ProcessId $other.Id) } catch { $rejected = $true }
    Assert-Runtime $rejected 'A PowerShell process must not register as llama-server.'
    $other.Refresh()
    Assert-Runtime (-not $other.HasExited) 'Registration validation must not terminate a process.'
    try { throw 'fake-private-token-do-not-log' } catch { $errorRecord = $_ }
    $logPath = Write-TranslationDiagnostic -Stage 'test.failure' -ErrorRecord $errorRecord -Details @{ token='fake-private-token-do-not-log'; processId=$other.Id; attempt=2 }
    $firstLine = [IO.File]::ReadAllLines($logPath)[0] | ConvertFrom-Json
    Assert-Runtime ($firstLine.stage -eq 'test.failure') 'Diagnostic stage must be recorded.'
    Assert-Runtime ($firstLine.details.processId -eq $other.Id) 'Safe diagnostic details must be recorded.'
    Assert-Runtime (-not ([IO.File]::ReadAllText($logPath).Contains('fake-private-token-do-not-log'))) 'Diagnostics must not contain raw errors or credentials.'
    [void](Write-TranslationDiagnostic -Stage 'test.ready')
    Assert-Runtime ([IO.File]::ReadAllLines($logPath).Count -eq 2) 'Successful checks must append instead of replacing prior failures.'
    Write-Output ('PASS: ' + $passed + ' runtime lifecycle checks; only isolated test children were used.')
} finally {
    foreach ($child in $testChildren) {
        try { if (-not $child.HasExited) { $child.Kill(); [void]$child.WaitForExit(3000) } } catch {}
        $child.Dispose()
    }
    # Every file here is created by this test; avoid recursive deletion.
    if (Test-Path -LiteralPath $script:TranslationRuntimeSettingsDirectory) {
        Get-ChildItem -LiteralPath $script:TranslationRuntimeSettingsDirectory -File | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
        Remove-Item -LiteralPath $script:TranslationRuntimeSettingsDirectory
    }
    Remove-Variable TranslationRuntimeSettingsDirectory,TranslationRuntimeAgentMutexName -Scope Script -ErrorAction SilentlyContinue
}
