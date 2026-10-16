param([switch]$StartAgent,[switch]$CheckOnly,[string]$PreviewPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Net.Http
[System.Windows.Forms.Application]::EnableVisualStyles()
$uiMutex=New-Object Threading.Mutex($false,'Local\KhzanahTranslationDashboard')
$uiLocked=$false
if(-not $CheckOnly){
    try {$uiLocked=$uiMutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$uiLocked=$true}
    if(-not $uiLocked){$shell=New-Object -ComObject WScript.Shell; [void]$shell.AppActivate('الخزانة | متابعة الترجمة'); $uiMutex.Dispose(); exit}
}
$utf8=New-Object System.Text.UTF8Encoding($false,$true)
$settings=Join-Path $env:LOCALAPPDATA 'KhzanahLocalTranslation'
$agentFile=Join-Path $PSScriptRoot 'agent.mjs'
$launcherFile=Join-Path $PSScriptRoot 'Start-Translation.ps1'
$logFile=Join-Path $settings 'agent-output.log'
$script:desired=$StartAgent.IsPresent
$script:lastStart=[datetime]::MinValue
$script:request=$null
$script:nextPoll=[datetime]::MinValue
$script:lastGood=$null
$script:verified=$false
$script:cloudOnline=$false
$script:activeJobs=0
$script:nextState=[datetime]::MinValue
function Get-RunState([bool]$desired,[bool]$agent,[bool]$launcher,[bool]$online,[int]$jobs) {
    if($agent){
        if(-not $online){$text='العامل مفتوح — تعذر تأكيد الاتصال';$color='DarkOrange';$hint='تُعاد محاولة الاتصال تلقائيًا. الأرقام المعروضة قديمة حتى يعود الاتصال.'}
        elseif($jobs -gt 0){$text='يعمل الآن — ترجمة جارية';$color='DarkGreen';$hint='يمكنك إيقاف العامل المحلي. كل ما وصل إلى Cloudflare يبقى محفوظًا.'}
        else{$text='العامل يعمل — ينتظر المهمة التالية';$color='DarkGreen';$hint='العامل مفتوح ويتابع السحب؛ قد ينتظر مهمة أو موعد إعادة المحاولة.'}
    } elseif($launcher){$text='جارٍ تجهيز النموذج المحلي…';$color='DarkOrange';$hint='انتظر اكتمال التحميل. لا تحتاج الضغط على تشغيل مرة أخرى.'}
    elseif($desired){$text='بانتظار بدء العامل — يعيد المحاولة';$color='DarkOrange';$hint='تُعاد محاولة التشغيل كل 30 ثانية. زر الإيقاف يلغي هذه المحاولات.'}
    else{$text='متوقف — العامل المحلي لا يعمل';$color='DimGray';$hint='اضغط «استئناف الترجمة» ليكمل الناقص من سجل Cloudflare، دون تصفير التقدم.'}
    [pscustomobject]@{Text=$text;Color=$color;Hint=$hint;StartEnabled=(-not $agent -and -not $launcher -and -not $desired);StopEnabled=($agent -or $launcher -or $desired)}
}
$localCodes='en fr tr ur ug fa hi id ms bn ru uk de es pt it nl pl kk zh ja ko'.Split(' ')
$names=@{en='الإنجليزية';fr='الفرنسية';tr='التركية';ur='الأردية';ug='الأويغورية';fa='الفارسية';hi='الهندية';id='الإندونيسية';ms='الملايوية';bn='البنغالية';ru='الروسية';uk='الأوكرانية';de='الألمانية';es='الإسبانية';pt='البرتغالية';it='الإيطالية';nl='الهولندية';pl='البولندية';kk='الكازاخية';zh='الصينية';ja='اليابانية';ko='الكورية';ckb='الكردية السورانية';ku='الكردية';sw='السواحيلية';hu='المجرية';ps='البشتوية';so='الصومالية';ha='الهوسا';sv='السويدية';no='النرويجية';ro='الرومانية';bs='البوسنية';sq='الألبانية';az='الأذربيجانية';uz='الأوزبكية'}
function Get-AgentProcesses {
    @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($agentFile) })
}
function Get-LauncherProcesses {
    @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($launcherFile) })
}
function Start-LocalAgent {
    if(((Get-Date)-$script:lastStart).TotalSeconds -lt 30){return}
    $script:lastStart=Get-Date
    # Loading the model can take longer than the supervision interval.
    if((Get-LauncherProcesses).Count -gt 0 -or (Get-AgentProcesses).Count -gt 0){return}
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$launcherFile+'"')) -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $settings 'agent-error.log') | Out-Null
}
$form=New-Object Windows.Forms.Form
$form.Text='الخزانة | متابعة الترجمة'
$form.Size=New-Object Drawing.Size(1060,790)
$form.MinimumSize=$form.Size
$form.StartPosition='CenterScreen'
$form.RightToLeft='Yes'
$form.RightToLeftLayout=$true
$form.Font=New-Object Drawing.Font('Segoe UI',11)
$form.BackColor=[Drawing.Color]::FromArgb(245,247,250)
function Add-Label($text,$x,$y,$w,$h,$size=11) {
    $v=New-Object Windows.Forms.Label
    $v.Text=$text; $v.Location=New-Object Drawing.Point($x,$y); $v.Size=New-Object Drawing.Size($w,$h)
    $v.Font=New-Object Drawing.Font('Segoe UI',$size); $form.Controls.Add($v); return $v
}
$null=Add-Label 'الخزانة — ترجمة متواصلة من حيث توقفت' 20 15 990 42 22
$runStatus=Add-Label 'جارٍ التحقق من حالة العامل…' 20 65 990 36 17
$connection=Add-Label 'جارٍ الاتصال بسجل Cloudflare…' 20 105 990 30
$totals=Add-Label 'الجاهز —     المتبقي —     نسبة الإنجاز —' 20 140 990 40 18
$bar=New-Object Windows.Forms.ProgressBar
$bar.Location=New-Object Drawing.Point(20,185); $bar.Size=New-Object Drawing.Size(990,18); $bar.Maximum=10000; $form.Controls.Add($bar)
$groups=Add-Label 'المحلي: 22 لغة  |  المزودات الأخرى: 14 لغة بالتوازي حسب حصصها' 20 210 990 30
$activity=Add-Label 'المهمة الحالية —' 20 245 990 50
$queue=Add-Label 'حالة العامل —' 20 300 990 30
$grid=New-Object Windows.Forms.DataGridView
$grid.Location=New-Object Drawing.Point(20,340); $grid.Size=New-Object Drawing.Size(990,235)
$grid.ReadOnly=$true; $grid.AllowUserToAddRows=$false; $grid.AllowUserToDeleteRows=$false
$grid.ColumnHeadersHeight=32; $grid.RowTemplate.Height=26; $grid.RowHeadersVisible=$false; $grid.AutoSizeColumnsMode='Fill'; $grid.BackgroundColor=[Drawing.Color]::White
foreach($column in @('اللغة','المسار المفضل','الجاهز','المتبقي','الإنجاز','المحاولة التالية')){[void]$grid.Columns.Add($column,$column)}
$form.Controls.Add($grid)
function Add-Button($text,$x,$action) {
    $b=New-Object Windows.Forms.Button; $b.Text=$text; $b.Location=New-Object Drawing.Point($x,590); $b.Size=New-Object Drawing.Size(210,45)
    $b.Add_Click($action); $form.Controls.Add($b); return $b
}
$startButton=Add-Button 'استئناف الترجمة' 800 {
    $script:desired=$true; $startButton.Enabled=$false; $stopButton.Enabled=$true
    $runStatus.Text='جارٍ بدء العامل…'; $form.Refresh()
    try {$script:lastStart=[datetime]::MinValue; Start-LocalAgent} catch {$connection.Text='تعذر بدء العامل؛ ستعاد المحاولة. تقدم Cloudflare محفوظ.'}
    $script:nextState=[datetime]::MinValue
}
$stopButton=Add-Button 'إيقاف العامل المحلي' 575 {
    $script:desired=$false
    $stopButton.Enabled=$false; $startButton.Enabled=$false; $runStatus.Text='جارٍ إيقاف العامل المحلي…'; $form.Refresh()
    try {
    foreach($p in Get-AgentProcesses){Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue}
    # Also honor stop while the launcher is waiting for model health.
    foreach($launcher in Get-LauncherProcesses){
        foreach($child in @(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$launcher.ProcessId))){
            if($child.Name -eq 'llama-server.exe'){Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue}
        }
        Stop-Process -Id $launcher.ProcessId -ErrorAction SilentlyContinue
    }
    } catch {$connection.Text='تعذر إيقاف إحدى العمليات؛ تحقق من الحالة قبل المحاولة مجددًا.'}
    $script:nextState=[datetime]::MinValue
}
$refreshButton=Add-Button 'تحديث الأرقام' 350 { $script:nextPoll=[datetime]::MinValue }
$startButton.BackColor=[Drawing.Color]::DarkGreen; $startButton.ForeColor=[Drawing.Color]::White; $startButton.UseVisualStyleBackColor=$false
$stopButton.BackColor=[Drawing.Color]::Firebrick; $stopButton.ForeColor=[Drawing.Color]::White; $stopButton.UseVisualStyleBackColor=$false
$stateHelp=Add-Label 'جارٍ التحقق…' 20 645 990 30
$null=Add-Label 'الإيقاف يخص هذا الجهاز فقط؛ المزودات الأخرى تتابع حسب حصصها. التقدم محفوظ في Cloudflare.' 20 682 990 30 10
$null=Add-Label 'إغلاق اللوحة يترك العامل يعمل. لإيقافه اضغط الزر الأحمر أولًا. الأرقام نصوص × لغات، وليست صفحات.' 20 717 990 28 10
function Update-RunControls {
    if((Get-Date) -lt $script:nextState){return}
    $script:nextState=(Get-Date).AddSeconds(3)
    $state=Get-RunState $script:desired ((Get-AgentProcesses).Count -gt 0) ((Get-LauncherProcesses).Count -gt 0) $script:cloudOnline $script:activeJobs
    $runStatus.Text=$state.Text; $runStatus.ForeColor=[Drawing.Color]::FromName($state.Color)
    $stateHelp.Text=$state.Hint; $startButton.Enabled=$state.StartEnabled; $stopButton.Enabled=$state.StopEnabled
    if($state.StartEnabled){$startButton.BackColor=[Drawing.Color]::DarkGreen}else{$startButton.BackColor=[Drawing.Color]::Gainsboro}
    if($state.StopEnabled){$stopButton.BackColor=[Drawing.Color]::Firebrick}else{$stopButton.BackColor=[Drawing.Color]::Gainsboro}
}
try {
    $connectionStage='read-url'
    $url=[IO.File]::ReadAllText((Join-Path $settings 'worker-url.txt'),$utf8).Trim().TrimEnd('/')
    if(([uri]$url).Scheme -ne 'https'){throw 'HTTPS required'}
    $connectionStage='decrypt-settings'
    $secure=Import-Clixml -LiteralPath (Join-Path $settings 'agent-token.xml')
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$secure.Dispose()}
    $connectionStage='http-client'
    $handler=New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect=$false; $handler.Proxy=[Net.WebRequest]::DefaultWebProxy
    $client=New-Object Net.Http.HttpClient($handler)
    $client.Timeout=[timespan]::FromSeconds(20)
    $client.DefaultRequestHeaders.Authorization=New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer',$token)
    $token=$null
    try { [IO.File]::WriteAllText((Join-Path $settings 'dashboard-connection-status.json'),('{"stage":"ready","time":"'+[DateTime]::UtcNow.ToString('o')+'"}'),$utf8) } catch {}
} catch {
    # Record only diagnostic metadata, never exception text, headers or credentials.
    $diagnostic=[pscustomobject]@{stage=$connectionStage;type=$_.Exception.GetType().FullName;hresult=$_.Exception.HResult;line=$_.InvocationInfo.ScriptLineNumber;time=[DateTime]::UtcNow.ToString('o')}
    try { $diagnostic|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $settings 'dashboard-connection-status.json') -Encoding UTF8 } catch {}
    if($CheckOnly){$diagnostic|ConvertTo-Json -Compress;exit 1}
    [Windows.Forms.MessageBox]::Show(('تعذر فتح الاتصال في هذه المحاولة. أغلق هذه الرسالة وافتح Khzanah-Translate.cmd مجددًا. لا تحذف إعداداتك ولا تدخل مفتاحًا جديدًا. رمز التشخيص: '+$connectionStage),'الخزانة')|Out-Null
    exit 1
}
function Refresh-View($data) {
    if($data.utf8Probe -ne 'مرحبا بالعالم' -or -not $data.library.byLanguage){throw 'Invalid status'}
    $ready=0L; $left=0L; $localLeft=0L; $remoteLeft=0L
    $grid.Rows.Clear()
    foreach($property in $data.library.byLanguage.PSObject.Properties){
        $code=$property.Name; $row=$property.Value; $ready+=$row.ready; $left+=$row.remaining
        $isLocal=$localCodes -contains $code
        if($isLocal){$localLeft+=$row.remaining;$route='محلي + بدلاء'}else{$remoteLeft+=$row.remaining;$route='المزودات الأخرى'}
        $percent=100*$row.ready/[math]::Max(1,($row.ready+$row.remaining))
        $retry='متاحة'
        if($row.remaining -eq 0){$retry='مكتملة'}elseif($row.retryAt -gt [DateTimeOffset]::Now.ToUnixTimeMilliseconds()){$retry=[DateTimeOffset]::FromUnixTimeMilliseconds([long]$row.retryAt).LocalDateTime.ToString('MM-dd HH:mm')}
        [void]$grid.Rows.Add(@(($names[$code]+' ('+$code+')'),$route,('{0:N0}' -f $row.ready),('{0:N0}' -f $row.remaining),('{0:N1}%' -f $percent),$retry))
    }
    $pct=100*$ready/[math]::Max(1,($ready+$left)); $bar.Value=[math]::Min(10000,[int]($pct*100))
    $totals.Text='الجاهز {0:N0}     المتبقي {1:N0}     الإنجاز {2:N2}%' -f $ready,$left,$pct
    $groups.Text='المتبقي: اللغات الـ22 = {0:N0}   |   اللغات الـ14 = {1:N0}' -f $localLeft,$remoteLeft
    $queue.Text='سجل Cloudflare: مكتمل {0} | منتظر {1} | محجوز {2} | فاشل {3} | آخر دقيقة {4}' -f $data.completed,$data.pending,$data.processing,$data.failed,$data.completedLastMinute
    $sourceNames=@{ui='نص واجهة';title='عنوان كتاب';author='اسم مؤلف';text='نص';catalog='فهرس'}
    $current=@($data.current | ForEach-Object { $names[$_.target]+' — '+$sourceNames[$_.sourceType] }) -join ' / '
    if(-not $current){$current='لا توجد مهمة محجوزة'}
    $activity.Text='المهمة المسجلة في Cloudflare: '+$current
    if(@($data.current).Count -gt 0 -and (Test-Path -LiteralPath $logFile)){
        $line=Get-Content -LiteralPath $logFile -Encoding UTF8 -Tail 18 | Where-Object {$_ -match '^current language=.+current item='} | Select-Object -Last 1
        if($line -and $line -notmatch 'current item=-'){$item=(($line -split 'current item=',2)[1] -replace ' \| source=.*$',''); $activity.Text+=' — '+$item.Substring(0,[math]::Min(75,$item.Length))}
    }
    $remote='دورة المزودات الأخرى: '+$names[$data.library.activeLanguage]+' — حسب الحصص المتاحة'
    if($data.library.lastError -match 'guard_reached|quota|rate.limit'){$remote+=' — بلغ بعض المزودين حد الاستخدام؛ إعادة المحاولة تلقائية'}
    elseif($data.library.lastError){$remote+=' — تعذرت المحاولة الأخيرة؛ إعادة المحاولة تلقائية'}
    $activity.Text+="`r`n"+$remote
    $script:lastGood=Get-Date; $script:verified=$true
    $script:cloudOnline=$true; $script:activeJobs=@($data.current).Count
    $connection.Text='متصل بـCloudflare — آخر تحديث '+$script:lastGood.ToString('HH:mm:ss')+' — تحديث كل 15 ثانية'
}
$timer=New-Object Windows.Forms.Timer; $timer.Interval=1000
$tick={
    try {
        if($script:desired){Start-LocalAgent}
        if($script:request -and $script:request.IsCompleted){
            try {
                $response=$script:request.GetAwaiter().GetResult()
                try { if(-not $response.IsSuccessStatusCode){throw 'Status unavailable'}; $body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult(); Refresh-View ($body|ConvertFrom-Json) } finally {$response.Dispose()}
            } catch { $script:cloudOnline=$false; $connection.Text='تعذر الاتصال — الأرقام المعروضة آخر قراءة ناجحة. ستعاد المحاولة تلقائيًا.' }
            $script:request=$null; $script:nextPoll=(Get-Date).AddSeconds(15)
        }
        if(-not $script:request -and (Get-Date) -ge $script:nextPoll){$script:request=$client.GetAsync($url+'/api/translate/internal/local/status')}
        Update-RunControls
    } catch { $connection.Text='تعذر تشغيل العامل أو الاتصال. تقدم Cloudflare محفوظ؛ ستعاد المحاولة.' }
}
$timer.Add_Tick($tick)
try {
    if($CheckOnly){
        $deadline=(Get-Date).AddSeconds(45)
        while(-not $script:verified -and (Get-Date) -lt $deadline){& $tick; Start-Sleep -Milliseconds 200}
        if(-not $script:verified){throw 'Dashboard live check failed'}
        if($PreviewPath){$form.Show();[Windows.Forms.Application]::DoEvents();$bitmap=New-Object Drawing.Bitmap($form.Width,$form.Height);try{$form.DrawToBitmap($bitmap,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height)));$bitmap.Save($PreviewPath,[Drawing.Imaging.ImageFormat]::Png)}finally{$bitmap.Dispose()}}
        [pscustomobject]@{languages=$grid.Rows.Count;totals=$totals.Text;groups=$groups.Text;utf8=$true}|ConvertTo-Json -Compress
    } else { $timer.Start(); [void]$form.ShowDialog() }
} finally {$timer.Stop();$timer.Dispose();$client.Dispose();$form.Dispose();if($uiLocked){$uiMutex.ReleaseMutex()};$uiMutex.Dispose()}
