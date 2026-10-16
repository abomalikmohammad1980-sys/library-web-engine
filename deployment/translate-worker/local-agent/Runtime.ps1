# Windows PowerShell 5.1 shared lifecycle helpers. These files contain process
# identities and redacted diagnostics only; Cloudflare owns translation progress.
$script:TranslationRuntimeRoot = [IO.Path]::GetFullPath($PSScriptRoot)

function Get-TranslationSettingsDirectory {
    $override = Get-Variable -Name TranslationRuntimeSettingsDirectory -Scope Script -ErrorAction SilentlyContinue
    if ($override -and $override.Value) { return [IO.Path]::GetFullPath([string]$override.Value) }
    $directory = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    if ([string]::IsNullOrWhiteSpace($directory)) { throw 'Windows local application data is unavailable.' }
    return Join-Path $directory 'KhzanahLocalTranslation'
}

function Write-TranslationDiagnostic {
    param([Parameter(Mandatory=$true)][string]$Stage,
          [System.Management.Automation.ErrorRecord]$ErrorRecord,
          [hashtable]$Details)
    # Never record exception messages, request data, URLs, headers or tokens.
    $currentProcess = [Diagnostics.Process]::GetCurrentProcess()
    $currentIdentity = $null
    try {
        $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $entry = [ordered]@{
            stage = ($Stage -replace '[^A-Za-z0-9_.-]', '_')
            time = [datetime]::UtcNow.ToString('o')
            pid = $PID
            userSid = $currentIdentity.User.Value
            session = $currentProcess.SessionId
            settingsDirectory = Get-TranslationSettingsDirectory
        }
    } finally {
        if ($currentIdentity) { $currentIdentity.Dispose() }
        $currentProcess.Dispose()
    }
    if ($ErrorRecord) {
        $entry.errorType = $ErrorRecord.Exception.GetType().FullName
        # PowerShell may put a thrown message (including a secret) into
        # FullyQualifiedErrorId. Use its fixed error-category enum instead.
        $entry.errorId = $ErrorRecord.CategoryInfo.Category.ToString()
        $errors = @(); $exception = $ErrorRecord.Exception
        for ($depth=0; $exception -and $depth -lt 6; $depth++) {
            $errors += [int]$exception.HResult
            $exception = $exception.InnerException
        }
        $entry.hresults = $errors
    }
    $safeDetails = [ordered]@{}
    foreach ($name in @('processId','exitCode','attempt','fileExists','urlFileExists','tokenFileExists','stopped')) {
        if ($Details -and $Details.ContainsKey($name) -and ($Details[$name] -is [ValueType])) { $safeDetails[$name] = $Details[$name] }
    }
    foreach ($name in @('role','reasonCode','fileOwnerSid')) {
        if ($Details -and $Details.ContainsKey($name) -and [string]$Details[$name] -match '^[A-Za-z0-9_.-]{1,160}$') { $safeDetails[$name] = [string]$Details[$name] }
    }
    if ($safeDetails.Count) { $entry.details = $safeDetails }
    $line = ($entry | ConvertTo-Json -Depth 5 -Compress) + [Environment]::NewLine
    $encoding = New-Object Text.UTF8Encoding($false)
    $locations = @((Join-Path $entry.settingsDirectory 'runtime-diagnostics.jsonl'), (Join-Path ([IO.Path]::GetTempPath()) 'Khzanah-runtime-diagnostics.jsonl'))
    foreach ($location in $locations) {
        for ($attempt=0; $attempt -lt 3; $attempt++) {
            try {
                [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($location))
                [IO.File]::AppendAllText($location, $line, $encoding)
                return $location
            } catch { if ($attempt -lt 2) { Start-Sleep -Milliseconds 25 } }
        }
    }
    return $null
}

function Test-TranslationAgentRunning {
    $name = 'Local\KhzanahHyMTTranslationAgent'
    $override = Get-Variable -Name TranslationRuntimeAgentMutexName -Scope Script -ErrorAction SilentlyContinue
    if ($override -and $override.Value) { $name = [string]$override.Value }
    $mutex = New-Object Threading.Mutex($false, $name)
    $owned = $false
    try {
        try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
        return (-not $owned)
    } finally {
        if ($owned) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Get-TranslationProcessName {
    param([ValidateSet('launcher','model','agent')][string]$Role)
    switch ($Role) { 'launcher' { 'powershell' }; 'model' { 'llama-server' }; 'agent' { 'node' } }
}

function Get-TranslationProcessMarkerPath {
    param([ValidateSet('launcher','model','agent')][string]$Role)
    return Join-Path (Get-TranslationSettingsDirectory) ($Role + '-runtime.json')
}

function Register-TranslationProcess {
    param([Parameter(Mandatory=$true)][ValidateSet('launcher','model','agent')][string]$Role,
          [Parameter(Mandatory=$true)][int]$ProcessId)
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    try {
        $expectedName = Get-TranslationProcessName -Role $Role
        if ($process.ProcessName -ne $expectedName -or $process.HasExited) { throw 'Process role does not match the executable.' }
        $marker = [ordered]@{
            schema = 1
            role = $Role
            processId = $ProcessId
            startTimeUtcTicks = $process.StartTime.ToUniversalTime().Ticks.ToString()
            processName = $expectedName
            scriptRoot = $script:TranslationRuntimeRoot
            time = [datetime]::UtcNow.ToString('o')
        }
        $path = Get-TranslationProcessMarkerPath -Role $Role
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path))
        $temporary = $path + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
        try {
            [IO.File]::WriteAllText($temporary, ($marker | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
            # Windows PowerShell 5.1 converts ordinary $null to an empty
            # string for this overload; NullString passes a true null path.
            if ([IO.File]::Exists($path)) { [IO.File]::Replace($temporary, $path, [NullString]::Value) }
            else { [IO.File]::Move($temporary, $path) }
        } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
        return [pscustomobject]$marker
    } finally { $process.Dispose() }
}

function Get-TranslationProcess {
    param([Parameter(Mandatory=$true)][ValidateSet('launcher','model','agent')][string]$Role)
    $process = $null
    try {
        $marker = [IO.File]::ReadAllText((Get-TranslationProcessMarkerPath -Role $Role)) | ConvertFrom-Json
        $expectedName = Get-TranslationProcessName -Role $Role
        if ($marker.schema -ne 1 -or $marker.role -ne $Role -or $marker.processName -ne $expectedName -or
            -not [string]::Equals($marker.scriptRoot, $script:TranslationRuntimeRoot, [StringComparison]::OrdinalIgnoreCase) -or
            [int]$marker.processId -le 0) { return $null }
        $process = Get-Process -Id ([int]$marker.processId) -ErrorAction Stop
        # Keep a handle to this process object while validating and stopping it;
        # a later PID reuse must never redirect Kill to another process.
        [void]$process.Handle
        if ($process.HasExited -or $process.ProcessName -ne $expectedName -or
            $process.StartTime.ToUniversalTime().Ticks.ToString() -ne [string]$marker.startTimeUtcTicks) {
            $process.Dispose()
            return $null
        }
        return $process
    } catch {
        if ($process) { $process.Dispose() }
        return $null
    }
}

function Unregister-TranslationProcess {
    param([Parameter(Mandatory=$true)][ValidateSet('launcher','model','agent')][string]$Role,
          [int]$ProcessId = 0,
          [string]$StartTimeUtcTicks)
    $path = Get-TranslationProcessMarkerPath -Role $Role
    try {
        $marker = [IO.File]::ReadAllText($path) | ConvertFrom-Json
        if (-not [string]::Equals($marker.scriptRoot, $script:TranslationRuntimeRoot, [StringComparison]::OrdinalIgnoreCase)) { return }
        if ($ProcessId -gt 0 -and [int]$marker.processId -ne $ProcessId) { return }
        if ($StartTimeUtcTicks -and [string]$marker.startTimeUtcTicks -ne $StartTimeUtcTicks) { return }
        [IO.File]::Delete($path)
    } catch { }
}

function Stop-TranslationProcess {
    param([Parameter(Mandatory=$true)][ValidateSet('launcher','model','agent')][string]$Role)
    $process = Get-TranslationProcess -Role $Role
    if (-not $process) { return $false }
    try {
        $processId = $process.Id
        $startTicks = $process.StartTime.ToUniversalTime().Ticks.ToString()
        # Kill through the verified Process object, not a second PID lookup.
        $process.Kill()
        if (-not $process.WaitForExit(3000)) { return $false }
        Unregister-TranslationProcess -Role $Role -ProcessId $processId -StartTimeUtcTicks $startTicks
        return $true
    } catch {
        [void](Write-TranslationDiagnostic -Stage 'process.stop-failed' -ErrorRecord $_ -Details @{role=$Role})
        return $false
    } finally { $process.Dispose() }
}
