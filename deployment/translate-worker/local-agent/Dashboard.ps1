param([switch]$StartAgent,[switch]$CheckOnly,[string]$PreviewPath,[switch]$Tray,[switch]$Exit)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
if($Exit){
    try {$event=[Threading.EventWaitHandle]::OpenExisting('Local\KhzanahTranslationExit');[void]$event.Set();$event.Dispose()} catch [Threading.WaitHandleCannotBeOpenedException] {}
    return
}
Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Net.Http
[System.Windows.Forms.Application]::EnableVisualStyles()
$uiMutex=New-Object Threading.Mutex($false,'Local\KhzanahTranslationDashboard')
$uiLocked=$false
$showEvent=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::AutoReset,'Local\KhzanahTranslationShow')
$startEvent=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::AutoReset,'Local\KhzanahTranslationStart')
$exitEvent=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::AutoReset,'Local\KhzanahTranslationExit')
if(-not $CheckOnly){
    try {$uiLocked=$uiMutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$uiLocked=$true}
    if(-not $uiLocked){if($StartAgent){[void]$startEvent.Set()};[void]$showEvent.Set();$showEvent.Dispose();$startEvent.Dispose();$exitEvent.Dispose();$uiMutex.Dispose();return}
}
$utf8=New-Object System.Text.UTF8Encoding($false,$true)
$settings=Get-TranslationSettingsDirectory
[void](Write-TranslationDiagnostic -Stage 'dashboard-start' -Details @{root=$PSScriptRoot})
$agentFile=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'agent.mjs'))
$launcherFile=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Start-Translation.ps1'))
$modelPath='C:\Users\yahya\Desktop\أبوعبدالرحمن\ترجمة offline\Hy-MT2-7B-Q4_K_M.gguf'
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
$script:announcedRunning=$false
$script:client=$null
$script:url=$null
$script:nextConnect=[datetime]::MinValue
$script:connectionProblem=$null
$script:launcherProcess=$null
$script:nextRuntime=[datetime]::MinValue
$self=[Diagnostics.Process]::GetCurrentProcess()
try {$script:dashboardStartTicks=[string]$self.StartTime.ToUniversalTime().Ticks} finally {$self.Dispose()}
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
    $p=Get-TranslationProcess -Role agent
    if($p){$p}
}
function Get-LauncherProcesses {
    $p=Get-TranslationProcess -Role launcher
    if($p){$p}
}
function Start-LocalAgent {
    if($script:exitMonitor -or -not $script:client){return}
    if(Test-TranslationAgentRunning){return}
    if($script:launcherProcess -and -not $script:launcherProcess.HasExited){return}
    if(((Get-Date)-$script:lastStart).TotalSeconds -lt 30){return}
    $script:lastStart=Get-Date
    if($script:launcherProcess){$script:launcherProcess.Dispose();$script:launcherProcess=$null}
    $powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $script:launcherProcess=Start-Process $powershell -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$launcherFile+'"'),'-Background') -WindowStyle Hidden -PassThru -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $settings 'agent-error.log')
    [void](Write-TranslationDiagnostic -Stage 'launcher-started' -Details @{processId=$script:launcherProcess.Id})
}
function Stop-LocalProcesses {
    $script:desired=$false
    try {$stop=[Threading.EventWaitHandle]::OpenExisting('Local\KhzanahTranslationStop');[void]$stop.Set();$stop.Dispose()} catch [Threading.WaitHandleCannotBeOpenedException] {}
    $launcher=Get-TranslationProcess -Role launcher
    if(-not $launcher -and $script:launcherProcess -and -not $script:launcherProcess.HasExited){$launcher=$script:launcherProcess}
    if($launcher){try{[void]$launcher.WaitForExit(8000)}finally{if(-not [object]::ReferenceEquals($launcher,$script:launcherProcess)){$launcher.Dispose()}}}
    # Quiesce a stalled launcher before the final child sweep: it must not
    # create a new model/agent after that role has already been inspected.
    [void](Stop-TranslationProcess -Role launcher)
    if($script:launcherProcess -and -not $script:launcherProcess.HasExited){$script:launcherProcess.Kill();[void]$script:launcherProcess.WaitForExit(3000)}
    foreach($role in @('agent','model')){[void](Stop-TranslationProcess -Role $role)}
    if(Test-TranslationAgentRunning){throw 'Worker shutdown incomplete'}
    foreach($role in @('agent','model','launcher')){
        $remaining=Get-TranslationProcess -Role $role
        if($remaining){$remaining.Dispose();throw 'A translation process is still running'}
    }
    [void](Write-TranslationDiagnostic -Stage 'worker-stopped')
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
    $b.Tag=$action; $b.Add_Click($action); $form.Controls.Add($b); return $b
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
    Stop-LocalProcesses
    } catch {$connection.Text='تعذر إيقاف إحدى العمليات؛ تحقق من الحالة قبل المحاولة مجددًا.'}
    $script:nextState=[datetime]::MinValue
}
$refreshButton=Add-Button 'تحديث الأرقام' 350 { $script:nextPoll=[datetime]::MinValue }
$startButton.BackColor=[Drawing.Color]::DarkGreen; $startButton.ForeColor=[Drawing.Color]::White; $startButton.UseVisualStyleBackColor=$false
$stopButton.BackColor=[Drawing.Color]::Firebrick; $stopButton.ForeColor=[Drawing.Color]::White; $stopButton.UseVisualStyleBackColor=$false
$stateHelp=Add-Label 'جارٍ التحقق…' 20 645 990 30
$null=Add-Label 'الإيقاف يخص هذا الجهاز فقط؛ المزودات الأخرى تتابع حسب حصصها. الأرقام تقرأ مباشرة من Cloudflare.' 20 682 990 30 10
$null=Add-Label 'إغلاق اللوحة يترك العامل يعمل. لإيقافه استخدم زر الإيقاف أو «إغلاق العامل بالكامل» من قائمة الأيقونة.' 20 717 990 28 10
function Update-RunControls {
    if((Get-Date) -lt $script:nextState){return}
    $script:nextState=(Get-Date).AddSeconds(3)
    $agents=@();$launchers=@()
    try {$agents=@(Get-AgentProcesses);$launchers=@(Get-LauncherProcesses);$state=Get-RunState $script:desired ($agents.Count -gt 0) ($launchers.Count -gt 0) $script:cloudOnline $script:activeJobs}
    catch {$state=[pscustomobject]@{Text='تعذر التحقق من العامل المحلي';Color='DarkOrange';Hint='لا يمكن تأكيد التشغيل؛ تقدم Cloudflare مستقل عن حالة هذا الجهاز.';StartEnabled=$false;StopEnabled=$false}}
    finally {foreach($p in @($agents)+@($launchers)){if($p -is [IDisposable]){$p.Dispose()}}}
    if($script:connectionProblem){$state.Text='بانتظار إعداد الاتصال — إعادة المحاولة تلقائية';$state.Color='DarkOrange';$state.Hint='الأيقونة متاحة للإغلاق. لم يبدأ المترجم بعد. تفاصيل الفحص محفوظة محلياً دون المفتاح.'}
    $script:trayState=$state
    Update-TrayView
    $runStatus.Text=$state.Text; $runStatus.ForeColor=[Drawing.Color]::FromName($state.Color)
    $stateHelp.Text=$state.Hint; $startButton.Enabled=$state.StartEnabled; $stopButton.Enabled=$state.StopEnabled
    if($state.StartEnabled){$startButton.BackColor=[Drawing.Color]::DarkGreen}else{$startButton.BackColor=[Drawing.Color]::Gainsboro}
    if($state.StopEnabled){$stopButton.BackColor=[Drawing.Color]::Firebrick}else{$stopButton.BackColor=[Drawing.Color]::Gainsboro}
    if($state.Text -match '^العامل يعمل' -and -not $script:announcedRunning){
        $notify.ShowBalloonTip(4000,'الخزانة','العامل يعمل بالفعل في الخلفية. التقدم محفوظ في Cloudflare.',[Windows.Forms.ToolTipIcon]::Info)
        $script:announcedRunning=$true
    } elseif($state.Text -notmatch '^العامل يعمل'){$script:announcedRunning=$false}
}
function Connect-TranslationCloud {
    if($script:client -or (Get-Date) -lt $script:nextConnect){return}
    $script:nextConnect=(Get-Date).AddSeconds(5)
    $secure=$null;$newClient=$null;$token=$null
    $connectionStage='read-url'
    try {
        $candidate=[IO.File]::ReadAllText((Join-Path $settings 'worker-url.txt'),$utf8).Trim().TrimEnd('/')
        $uri=$null
        if(-not [uri]::TryCreate($candidate,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -ne 'https'){throw 'Invalid worker URL'}
        $connectionStage='decrypt-settings'
        $secure=Import-Clixml -LiteralPath (Join-Path $settings 'agent-token.xml')
        if($secure -isnot [Security.SecureString] -or $secure.Length -lt 32){throw 'Invalid connection settings'}
        $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {$token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
        $connectionStage='http-client'
        $handler=New-Object Net.Http.HttpClientHandler
        $handler.AllowAutoRedirect=$false;$handler.Proxy=[Net.WebRequest]::DefaultWebProxy
        $newClient=New-Object Net.Http.HttpClient($handler)
        $newClient.Timeout=[timespan]::FromSeconds(20)
        $newClient.DefaultRequestHeaders.Authorization=New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer',$token)
        $script:client=$newClient;$newClient=$null;$script:url=$candidate
        $script:connectionProblem=$null
        [void](Write-TranslationDiagnostic -Stage 'connection-ready')
    } catch {
        $script:connectionProblem=$connectionStage
        [void](Write-TranslationDiagnostic -Stage $connectionStage -ErrorRecord $_)
        $connection.Text='تعذر قراءة إعداد الاتصال — يعيد المحاولة تلقائياً. افتح التفاصيل لمعرفة الحالة.'
        $script:cloudOnline=$false
    } finally {
        $token=$null
        if($secure -is [IDisposable]){$secure.Dispose()}
        if($newClient){$newClient.Dispose()}
    }
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
    $groups.Text='المتبقي: المحلي {0:N0} | الآخرون {1:N0} | اللغة المحلية الحالية: {2}' -f $localLeft,$remoteLeft,$names[[string]$data.library.localActiveLanguage]
    $queue.Text='سجل Cloudflare: مكتمل {0} | منتظر {1} | محجوز {2} | فاشل {3} | آخر دقيقة {4}' -f $data.completed,$data.pending,$data.processing,$data.failed,$data.completedLastMinute
    $sourceNames=@{ui='نص واجهة';title='عنوان كتاب';author='اسم مؤلف';text='نص';catalog='فهرس'}
    $current=@($data.current | ForEach-Object { $names[$_.target]+' — '+$sourceNames[$_.sourceType] }) -join ' / '
    if(-not $current){$current='لا توجد مهمة محجوزة'}
    $activity.Text='المهمة المسجلة في Cloudflare: '+$current
    $translationLog=Join-Path $settings 'translation-output.log'
    if(@($data.current).Count -gt 0 -and (Test-Path -LiteralPath $translationLog)){
        $line=Get-Content -LiteralPath $translationLog -Encoding UTF8 -Tail 18 | Where-Object {$_ -match '^current language=.+current item='} | Select-Object -Last 1
        if($line -and $line -notmatch 'current item=-'){$item=(($line -split 'current item=',2)[1] -replace ' \| source=.*$',''); $activity.Text+=' — '+$item.Substring(0,[math]::Min(75,$item.Length))}
    }
    $remote='دورة المزودات الأخرى: '+$names[$data.library.activeLanguage]+' — حسب الحصص المتاحة'
    if($data.library.lastError -match 'guard_reached|quota|rate.limit'){$remote+=' — بلغ بعض المزودين حد الاستخدام؛ إعادة المحاولة تلقائية'}
    elseif($data.library.lastError){$remote+=' — تعذرت المحاولة الأخيرة؛ إعادة المحاولة تلقائية'}
    $activity.Text+="`r`n"+$remote
    $script:trayData=$data
    $script:lastGood=Get-Date; $script:verified=$true
    $script:cloudOnline=$true; $script:activeJobs=@($data.current).Count
    $connection.Text='متصل بـCloudflare — آخر تحديث '+$script:lastGood.ToString('HH:mm:ss')+' — تحديث كل 15 ثانية'
}
# One monitor owns both the tray icon and the optional detail window.
$script:trayState=$null
$script:trayData=$null
$script:exitMonitor=$false
$notify=New-Object Windows.Forms.NotifyIcon
$notify.Icon=[Drawing.SystemIcons]::Information
$notify.Text='الخزانة — جارٍ التحقق'
$trayMenu=New-Object Windows.Forms.ContextMenuStrip
$trayMenu.RightToLeft='Yes'
$trayStatus=$trayMenu.Items.Add('جارٍ التحقق من المترجم…');$trayStatus.Enabled=$false
$trayLanguage=$trayMenu.Items.Add('اللغة —');$trayLanguage.Enabled=$false
$trayProgress=$trayMenu.Items.Add('المنجز — | المتبقي —');$trayProgress.Enabled=$false
$trayUpdated=$trayMenu.Items.Add('بانتظار قراءة Cloudflare');$trayUpdated.Enabled=$false
[void]$trayMenu.Items.Add((New-Object Windows.Forms.ToolStripSeparator))
$trayDetails=$trayMenu.Items.Add('عرض التفاصيل')
$trayStart=$trayMenu.Items.Add('استئناف الترجمة');$trayStart.Enabled=$false
$trayStop=$trayMenu.Items.Add('إيقاف الترجمة المحلية');$trayStop.Enabled=$false
[void]$trayMenu.Items.Add((New-Object Windows.Forms.ToolStripSeparator))
$trayExit=$trayMenu.Items.Add('إغلاق العامل بالكامل — إنهاء مهامه من الجهاز')
$notify.ContextMenuStrip=$trayMenu
function Show-TranslationWindow {
    $form.Show();$form.WindowState='Normal';$form.Activate()
}
function Get-TrayProgress($data,$languageNames) {
    $code=[string]$data.library.localActiveLanguage
    if(-not $code -or -not $data.library.byLanguage.$code){return [pscustomobject]@{Language='لا توجد لغة نشطة';Progress='بانتظار تحديد اللغة';Short='—'}}
    $row=$data.library.byLanguage.$code
    $total=[long]$row.ready+[long]$row.remaining
    $pct=100*[long]$row.ready/[math]::Max(1,$total)
    $name=$languageNames[$code];if(-not $name){$name=$code}
    [pscustomobject]@{Language=$name;Progress=('المنجز {0:N0} من {1:N0} ({2:N1}%) | المتبقي {3:N0}' -f $row.ready,$total,$pct,$row.remaining);Short=('{0} {1:N1}%' -f $name,$pct)}
}
function Update-TrayView {
    if(-not $script:trayState){return}
    $state=$script:trayState
    $trayStatus.Text=$state.Text
    $trayStart.Enabled=$state.StartEnabled;$trayStop.Enabled=$state.StopEnabled
    if($state.Color -eq 'DarkGreen'){$notify.Icon=[Drawing.SystemIcons]::Information}
    elseif($state.Color -eq 'DimGray'){$notify.Icon=[Drawing.SystemIcons]::Error}
    else{$notify.Icon=[Drawing.SystemIcons]::Warning}
    $progress=Get-TrayProgress $script:trayData $names
    $trayLanguage.Text='اللغة: '+$progress.Language
    $trayProgress.Text=$progress.Progress
    $stale=''
    if(-not $script:cloudOnline){$stale=' | أرقام قديمة';$trayUpdated.Text='تعذر الاتصال — آخر أرقام محفوظة في هذه الجلسة'}
    elseif($script:lastGood){$trayUpdated.Text='تحديث Cloudflare: '+$script:lastGood.ToString('HH:mm:ss')}
    $tip=$state.Text+"`n"+$progress.Short+$stale
    $notify.Text=$tip.Substring(0,[math]::Min(63,$tip.Length))
}
$trayDetails.Add_Click({Show-TranslationWindow})
$notify.Add_DoubleClick({Show-TranslationWindow})
$notify.Add_MouseClick({param($sender,$eventArgs) if($eventArgs.Button -eq [Windows.Forms.MouseButtons]::Left){$trayMenu.Show([Windows.Forms.Cursor]::Position)}})
$trayStart.Add_Click({if($startButton.Enabled){& $startButton.Tag}})
$trayStop.Add_Click({if($stopButton.Enabled){& $stopButton.Tag}})
function Close-TranslationApp {
    $script:desired=$false
    $runStatus.Text='جارٍ الإغلاق الكامل…'
    try {
        Stop-LocalProcesses
        $script:exitMonitor=$true
        $form.Close()
        [Windows.Forms.Application]::ExitThread()
    } catch {
        [void](Write-TranslationDiagnostic -Stage 'shutdown-failed' -ErrorRecord $_)
        $connection.Text='لم يكتمل إيقاف العامل. الأيقونة باقية؛ حاول الإغلاق الكامل مرة أخرى.'
        Show-TranslationWindow
    }
}
$trayExit.Add_Click({Close-TranslationApp})
$form.Add_FormClosing({param($sender,$eventArgs)
    if(-not $script:exitMonitor -and $eventArgs.CloseReason -eq [Windows.Forms.CloseReason]::UserClosing){$eventArgs.Cancel=$true;$form.Hide()}
})
$timer=New-Object Windows.Forms.Timer; $timer.Interval=1000
function Write-DashboardRuntime {
    if($CheckOnly -or (Get-Date) -lt $script:nextRuntime){return}
    $script:nextRuntime=(Get-Date).AddSeconds(2)
    $agent=$null;$launcher=$null;$model=$null
    try {
        $agent=Get-TranslationProcess -Role agent
        $launcher=Get-TranslationProcess -Role launcher
        $model=Get-TranslationProcess -Role model
        $ready=0L
        if($script:trayData){foreach($p in $script:trayData.library.byLanguage.PSObject.Properties){$ready+=[long]$p.Value.ready}}
        $runtime=[ordered]@{pid=$PID;startTicks=$script:dashboardStartTicks;scriptRoot=$PSScriptRoot;time=[datetime]::UtcNow.ToString('o');iconVisible=$notify.Visible;cloudOnline=$script:cloudOnline;verified=$script:verified;desired=$script:desired;agentPid=$agent.Id;launcherPid=$launcher.Id;modelPid=$model.Id;completed=$script:trayData.completed;ready=$ready;currentLanguage=$script:trayData.library.localActiveLanguage;connectionProblem=$script:connectionProblem}
        $target=Join-Path $settings 'dashboard-runtime.json'
        $temp=$target+'.'+$PID+'.tmp'
        [IO.File]::WriteAllText($temp,($runtime|ConvertTo-Json -Compress),$utf8)
        if([IO.File]::Exists($target)){[IO.File]::Replace($temp,$target,[NullString]::Value)}else{[IO.File]::Move($temp,$target)}
    } catch {[void](Write-TranslationDiagnostic -Stage 'dashboard-status-write' -ErrorRecord $_)}
    finally {foreach($p in @($agent,$launcher,$model)){if($p){$p.Dispose()}}}
}
$tick={
    try {
        if($exitEvent.WaitOne(0)){Close-TranslationApp;return}
        if($startEvent.WaitOne(0)){$script:desired=$true;$script:lastStart=[datetime]::MinValue}
        if($showEvent.WaitOne(0)){Show-TranslationWindow}
        Connect-TranslationCloud
        if($script:desired){Start-LocalAgent}
        if($script:request -and $script:request.IsCompleted){
            try {
                $response=$script:request.GetAwaiter().GetResult()
                try { if(-not $response.IsSuccessStatusCode){throw 'Status unavailable'}; $body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult(); Refresh-View ($body|ConvertFrom-Json) } finally {$response.Dispose()}
            } catch { $script:cloudOnline=$false; $connection.Text='تعذر الاتصال — الأرقام المعروضة آخر قراءة ناجحة. ستعاد المحاولة تلقائيًا.' }
            $script:request=$null; $script:nextPoll=(Get-Date).AddSeconds(15)
        }
        if($script:client -and -not $script:request -and (Get-Date) -ge $script:nextPoll){$script:request=$script:client.GetAsync($script:url+'/api/translate/internal/local/status')}
        Update-RunControls
    } catch { [void](Write-TranslationDiagnostic -Stage 'dashboard-tick' -ErrorRecord $_);$connection.Text='تعذر تشغيل العامل أو الاتصال. تقدم Cloudflare محفوظ؛ ستعاد المحاولة.' }
    Write-DashboardRuntime
}
$timer.Add_Tick($tick)
try {
    if($CheckOnly){
        $deadline=(Get-Date).AddSeconds(45)
        while(-not $script:verified -and (Get-Date) -lt $deadline){& $tick; Start-Sleep -Milliseconds 200}
        if(-not $script:verified){throw 'Dashboard live check failed'}
        $script:nextState=[datetime]::MinValue; Update-RunControls
        if($PreviewPath){$form.Show();[Windows.Forms.Application]::DoEvents();$bitmap=New-Object Drawing.Bitmap($form.Width,$form.Height);try{$form.DrawToBitmap($bitmap,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height)));$bitmap.Save($PreviewPath,[Drawing.Imaging.ImageFormat]::Png)}finally{$bitmap.Dispose()}}
        if($PreviewPath){
            $trayMenu.Show(20,20);[Windows.Forms.Application]::DoEvents()
            $menuBitmap=New-Object Drawing.Bitmap($trayMenu.Width,$trayMenu.Height)
            try{$trayMenu.DrawToBitmap($menuBitmap,(New-Object Drawing.Rectangle(0,0,$trayMenu.Width,$trayMenu.Height)));$menuBitmap.Save(($PreviewPath+'.tray.png'),[Drawing.Imaging.ImageFormat]::Png)}finally{$menuBitmap.Dispose();$trayMenu.Close()}
        }
        [pscustomobject]@{languages=$grid.Rows.Count;totals=$totals.Text;groups=$groups.Text;utf8=$true;trayState=$trayStatus.Text;trayLanguage=$trayLanguage.Text;trayProgress=$trayProgress.Text}|ConvertTo-Json -Compress
    } else { $notify.Visible=$true;Write-DashboardRuntime;$timer.Start(); if(-not $Tray){$form.Show()}; [Windows.Forms.Application]::Run() }
} finally {
    $notify.Visible=$false;$script:nextRuntime=[datetime]::MinValue;Write-DashboardRuntime
    $notify.Dispose();$trayMenu.Dispose();$showEvent.Dispose();$startEvent.Dispose();$exitEvent.Dispose();$timer.Stop();$timer.Dispose();if($script:client){$script:client.Dispose()};if($script:launcherProcess){$script:launcherProcess.Dispose()};$form.Dispose();if($uiLocked){$uiMutex.ReleaseMutex()};$uiMutex.Dispose()
}
