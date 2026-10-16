param([switch]$StartAgent,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Net.Http
[System.Windows.Forms.Application]::EnableVisualStyles()
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
$localCodes='en fr tr ur ug fa hi id ms bn ru uk de es pt it nl pl kk zh ja ko'.Split(' ')
$names=@{en='الإنجليزية';fr='الفرنسية';tr='التركية';ur='الأردية';ug='الأويغورية';fa='الفارسية';hi='الهندية';id='الإندونيسية';ms='الملايوية';bn='البنغالية';ru='الروسية';uk='الأوكرانية';de='الألمانية';es='الإسبانية';pt='البرتغالية';it='الإيطالية';nl='الهولندية';pl='البولندية';kk='الكازاخية';zh='الصينية';ja='اليابانية';ko='الكورية';ckb='الكردية السورانية';ku='الكردية';sw='السواحيلية';hu='المجرية';ps='البشتوية';so='الصومالية';ha='الهوسا';sv='السويدية';no='النرويجية';ro='الرومانية';bs='البوسنية';sq='الألبانية';az='الأذربيجانية';uz='الأوزبكية'}
function Get-AgentProcesses {
    @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($agentFile) })
}
function Start-LocalAgent {
    if(((Get-Date)-$script:lastStart).TotalSeconds -lt 30){return}
    $script:lastStart=Get-Date
    if((Get-AgentProcesses).Count -gt 0){return}
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
$connection=Add-Label 'جارٍ الاتصال بسجل Cloudflare…' 20 65 990 30
$totals=Add-Label 'الجاهز —     المتبقي —     نسبة الإنجاز —' 20 105 990 40 18
$bar=New-Object Windows.Forms.ProgressBar
$bar.Location=New-Object Drawing.Point(20,150); $bar.Size=New-Object Drawing.Size(990,18); $bar.Maximum=10000; $form.Controls.Add($bar)
$groups=Add-Label 'المحلي: 22 لغة  |  المزودات الأخرى: 14 لغة بالتوازي حسب حصصها' 20 180 990 30
$activity=Add-Label 'المهمة الحالية —' 20 215 990 50
$queue=Add-Label 'حالة العامل —' 20 270 990 30
$grid=New-Object Windows.Forms.DataGridView
$grid.Location=New-Object Drawing.Point(20,315); $grid.Size=New-Object Drawing.Size(990,300)
$grid.ReadOnly=$true; $grid.AllowUserToAddRows=$false; $grid.AllowUserToDeleteRows=$false
$grid.RowHeadersVisible=$false; $grid.AutoSizeColumnsMode='Fill'; $grid.BackgroundColor=[Drawing.Color]::White
foreach($column in @('اللغة','المسار المفضل','الجاهز','المتبقي','الإنجاز','المحاولة التالية')){[void]$grid.Columns.Add($column,$column)}
$form.Controls.Add($grid)
function Add-Button($text,$x,$action) {
    $b=New-Object Windows.Forms.Button; $b.Text=$text; $b.Location=New-Object Drawing.Point($x,630); $b.Size=New-Object Drawing.Size(210,40)
    $b.Add_Click($action); $form.Controls.Add($b)
}
Add-Button 'تشغيل / استئناف' 800 { $script:desired=$true; $script:lastStart=[datetime]::MinValue; Start-LocalAgent }
Add-Button 'إيقاف العامل المحلي' 575 { $script:desired=$false; foreach($p in Get-AgentProcesses){Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue}; $queue.Text='العامل المحلي متوقف؛ تقدم Cloudflare محفوظ. المزودات الأخرى مستقلة.' }
Add-Button 'تحديث الآن' 350 { $script:nextPoll=[datetime]::MinValue }
$startup=New-Object Windows.Forms.CheckBox
$startup.Text='تشغيل واستئناف تلقائي عند دخولي إلى Windows'; $startup.Location=New-Object Drawing.Point(420,685); $startup.Size=New-Object Drawing.Size(590,30)
$shortcut=Join-Path ([Environment]::GetFolderPath('Startup')) 'Khzanah Translation.lnk'
$startup.Checked=Test-Path -LiteralPath $shortcut
$startup.Add_CheckedChanged({
    try {
        if($startup.Checked){
            $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut($shortcut)
            $link.TargetPath=(Get-Command powershell.exe).Source
            $link.Arguments='-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'Dashboard.ps1')+'" -StartAgent'
            $link.WorkingDirectory=$PSScriptRoot; $link.Save()
        } elseif(Test-Path -LiteralPath $shortcut){Remove-Item -LiteralPath $shortcut}
    } catch { $connection.Text='تعذر تغيير التشغيل التلقائي؛ أعد فتح اللوحة وحاول مجددًا.' }
})
$form.Controls.Add($startup)
$null=Add-Label 'الأرقام أزواج نص/لغة، وليست صفحات كتب. إغلاق اللوحة لا يوقف العامل.' 20 720 990 25 10
try {
    $url=[IO.File]::ReadAllText((Join-Path $settings 'worker-url.txt'),$utf8).Trim().TrimEnd('/')
    if(([uri]$url).Scheme -ne 'https'){throw 'HTTPS required'}
    $secure=Import-Clixml -LiteralPath (Join-Path $settings 'agent-token.xml')
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$secure.Dispose()}
    $handler=New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect=$false; $handler.Proxy=[Net.WebRequest]::DefaultWebProxy
    $client=New-Object Net.Http.HttpClient($handler)
    $client.Timeout=[timespan]::FromSeconds(20)
    $client.DefaultRequestHeaders.Authorization=New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer',$token)
    $token=$null
} catch { [Windows.Forms.MessageBox]::Show('إعداد الاتصال غير جاهز. افتح Start-Translation.cmd أولًا.','الخزانة')|Out-Null; exit 1 }
function Refresh-View($data) {
    if($data.utf8Probe -ne 'مرحبا بالعالم' -or -not $data.library.byLanguage){throw 'Invalid status'}
    $ready=0L; $left=0L; $localLeft=0L; $remoteLeft=0L
    $grid.Rows.Clear()
    foreach($property in $data.library.byLanguage.PSObject.Properties){
        $code=$property.Name; $row=$property.Value; $ready+=$row.ready; $left+=$row.remaining
        $isLocal=$localCodes -contains $code
        if($isLocal){$localLeft+=$row.remaining;$route='المحلي + بدلاء عند الفشل'}else{$remoteLeft+=$row.remaining;$route='المزودات الأخرى'}
        $percent=100*$row.ready/[math]::Max(1,($row.ready+$row.remaining))
        $retry='متاحة'
        if($row.remaining -eq 0){$retry='مكتملة'}elseif($row.retryAt -gt [DateTimeOffset]::Now.ToUnixTimeMilliseconds()){$retry=[DateTimeOffset]::FromUnixTimeMilliseconds([long]$row.retryAt).LocalDateTime.ToString('MM-dd HH:mm')}
        [void]$grid.Rows.Add(@(($names[$code]+' ('+$code+')'),$route,('{0:N0}' -f $row.ready),('{0:N0}' -f $row.remaining),('{0:N1}%' -f $percent),$retry))
    }
    $pct=100*$ready/[math]::Max(1,($ready+$left)); $bar.Value=[math]::Min(10000,[int]($pct*100))
    $totals.Text='الجاهز {0:N0}     المتبقي {1:N0}     الإنجاز {2:N2}%' -f $ready,$left,$pct
    $groups.Text='المتبقي: اللغات الـ22 = {0:N0}   |   اللغات الـ14 = {1:N0}' -f $localLeft,$remoteLeft
    $queue.Text='الطابور المحلي: مكتمل {0} | منتظر {1} | جارٍ {2} | فاشل {3} | السرعة {4}/دقيقة' -f $data.completed,$data.pending,$data.processing,$data.failed,$data.completedLastMinute
    $current=@($data.current | ForEach-Object { $names[$_.target]+' — '+$_.id.Substring(0,[math]::Min(16,$_.id.Length)) }) -join ' / '
    if(-not $current){$current='انتظار المهمة التالية'}
    $activity.Text='المحلي: '+$current
    if(Test-Path -LiteralPath $logFile){
        $line=Get-Content -LiteralPath $logFile -Encoding UTF8 -Tail 18 | Where-Object {$_ -match '^current language=.+current item='} | Select-Object -Last 1
        if($line -and $line -notmatch 'current item=-'){$item=(($line -split 'current item=',2)[1] -replace ' \| source=.*$',''); $activity.Text+=' — '+$item.Substring(0,[math]::Min(75,$item.Length))}
    }
    $remote='دورة المزودات الأخرى: '+$names[$data.library.activeLanguage]+' — حسب الحصص المتاحة'
    if($data.library.lastError -match 'guard_reached|quota|rate.limit'){$remote+=' — بلغ بعض المزودين حد الاستخدام؛ إعادة المحاولة تلقائية'}
    elseif($data.library.lastError){$remote+=' — تعذرت المحاولة الأخيرة؛ إعادة المحاولة تلقائية'}
    $activity.Text+="`r`n"+$remote
    $script:lastGood=Get-Date; $script:verified=$true
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
            } catch { $connection.Text='تعذر الاتصال — الأرقام المعروضة آخر قراءة ناجحة. ستعاد المحاولة تلقائيًا.' }
            $script:request=$null; $script:nextPoll=(Get-Date).AddSeconds(15)
        }
        if(-not $script:request -and (Get-Date) -ge $script:nextPoll){$script:request=$client.GetAsync($url+'/api/translate/internal/local/status')}
    } catch { $connection.Text='تعذر تشغيل العامل أو الاتصال. تقدم Cloudflare محفوظ؛ ستعاد المحاولة.' }
}
$timer.Add_Tick($tick)
try {
    if($CheckOnly){
        $deadline=(Get-Date).AddSeconds(45)
        while(-not $script:verified -and (Get-Date) -lt $deadline){& $tick; Start-Sleep -Milliseconds 200}
        if(-not $script:verified){throw 'Dashboard live check failed'}
        [pscustomobject]@{languages=$grid.Rows.Count;totals=$totals.Text;groups=$groups.Text;utf8=$true}|ConvertTo-Json -Compress
    } else { $timer.Start(); [void]$form.ShowDialog() }
} finally {$timer.Stop();$timer.Dispose();$client.Dispose();$form.Dispose()}
