$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$modelPath = 'C:\Users\yahya\Desktop\أبوعبدالرحمن\ترجمة offline\Hy-MT2-7B-Q4_K_M.gguf'
$settingsDir = Join-Path $env:LOCALAPPDATA 'KhzanahLocalTranslation'
$mutex = New-Object System.Threading.Mutex($false, 'Local\KhzanahHyMTTranslationAgent')
$locked = $false
$server = $null
$oldUrl = $env:LOCAL_TRANSLATION_URL
$oldToken = $env:LOCAL_TRANSLATION_AGENT_TOKEN
$oldHttpsProxy = $env:HTTPS_PROXY
$oldNoProxy = $env:NO_PROXY
$oldUseProxy = $env:NODE_USE_ENV_PROXY
try {
    try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw 'The translation agent is already running.' }
    if (-not (Test-Path -LiteralPath $modelPath -PathType Leaf)) { throw "Model not found: $modelPath" }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $major = [int]((& $node --version).TrimStart('v').Split('.')[0])
    if ($major -lt 22) { throw 'Install Node.js 22 or newer first.' }
    New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
    $urlFile = Join-Path $settingsDir 'worker-url.txt'
    $tokenFile = Join-Path $settingsDir 'agent-token.xml'
    if (-not (Test-Path -LiteralPath $urlFile)) {
        $workerUrl = Read-Host 'Worker URL after activation (for example https://khzanah.com)'
        $workerUri = [Uri]$workerUrl.Trim()
        if (-not $workerUri.IsAbsoluteUri -or $workerUri.Scheme -ne 'https') { throw 'Enter the HTTPS address of the activated Worker.' }
        [IO.File]::WriteAllText($urlFile, $workerUrl.Trim(), $utf8)
    }
    if (-not (Test-Path -LiteralPath $tokenFile)) {
        $secret = Read-Host 'LOCAL_TRANSLATION_AGENT_TOKEN (hidden)' -AsSecureString
        if ($secret.Length -lt 32) { throw 'The agent token must contain at least 32 characters.' }
        $secret | Export-Clixml -LiteralPath $tokenFile
    }
    $env:LOCAL_TRANSLATION_URL = [IO.File]::ReadAllText($urlFile, $utf8).Trim()
    # Use the user's existing Windows connection; keep the model on loopback.
    $workerUri = [Uri]$env:LOCAL_TRANSLATION_URL
    $windowsProxy = [Net.WebRequest]::DefaultWebProxy
    if (-not $env:HTTPS_PROXY -and $windowsProxy -and -not $windowsProxy.IsBypassed($workerUri)) {
        $env:HTTPS_PROXY = $windowsProxy.GetProxy($workerUri).AbsoluteUri
    }
    if ($env:HTTPS_PROXY) {
        if (-not ((& $node --help) -match '--use-env-proxy')) { throw 'This Windows connection needs Node.js 24 or newer for proxy support.' }
        $env:NODE_USE_ENV_PROXY = '1'
        $env:NO_PROXY = (@($oldNoProxy, '127.0.0.1', 'localhost', '::1') | Where-Object { $_ }) -join ','
    }
    $secure = Import-Clixml -LiteralPath $tokenFile
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $env:LOCAL_TRANSLATION_AGENT_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $healthy = $false
    try { $healthy = (Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 3).status -eq 'ok' } catch {}
    if (-not $healthy) {
        $llama = (Get-Command llama-server.exe -ErrorAction Stop).Source
        $arguments = @('-m', ('"' + $modelPath + '"'), '--device', 'Vulkan0', '-c', '2048', '--parallel', '1', '--jinja', '--host', '127.0.0.1', '--port', '8080')
        Write-Host 'Starting Hy-MT2. Waiting for model health...'
        $server = Start-Process -FilePath $llama -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $settingsDir 'llama-output.log') -RedirectStandardError (Join-Path $settingsDir 'llama-error.log')
        $deadline = (Get-Date).AddMinutes(5)
        while ((Get-Date) -lt $deadline) {
            if ($server.HasExited) { throw "llama-server stopped. See logs in $settingsDir" }
            try { $healthy = (Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 3).status -eq 'ok' } catch {}
            if ($healthy) { break }
            Start-Sleep -Seconds 2
        }
        if (-not $healthy) { throw 'Model did not become healthy within 5 minutes.' }
    }
    & $node (Join-Path $PSScriptRoot 'agent.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Agent stopped with an error. Read the message above.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    # Stop only the server created by this launcher, never an existing user's process.
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue }
    $env:LOCAL_TRANSLATION_URL = $oldUrl
    $env:LOCAL_TRANSLATION_AGENT_TOKEN = $oldToken
    $env:HTTPS_PROXY = $oldHttpsProxy
    $env:NO_PROXY = $oldNoProxy
    $env:NODE_USE_ENV_PROXY = $oldUseProxy
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
