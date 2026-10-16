param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object Windows.Forms.Form
$form.Text='الخزانة — الترجمة';$form.ClientSize=New-Object Drawing.Size(490,235)
$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.StartPosition='CenterScreen'
$form.RightToLeft='Yes';$form.RightToLeftLayout=$true;$form.Font=New-Object Drawing.Font('Segoe UI',11)
$label=New-Object Windows.Forms.Label
$label.Text="اختر ما تريد. التقدم محفوظ في Cloudflare.`r`nترجمة واحدة في كل مرة؛ لا يلزم إبقاء هذه النافذة مفتوحة."
$label.Location=New-Object Drawing.Point(20,20);$label.Size=New-Object Drawing.Size(450,65);$form.Controls.Add($label)
$start=New-Object Windows.Forms.Button
$start.Text='تشغيل الترجمة في الخلفية';$start.Location=New-Object Drawing.Point(20,100);$start.Size=New-Object Drawing.Size(450,45)
$start.BackColor=[Drawing.Color]::DarkGreen;$start.ForeColor=[Drawing.Color]::White;$form.Controls.Add($start)
$view=New-Object Windows.Forms.Button
$view.Text='عرض التقدم والتحكم / الإيقاف';$view.Location=New-Object Drawing.Point(20,160);$view.Size=New-Object Drawing.Size(450,45);$form.Controls.Add($view)
function Open-TranslationTool($name){
    $file=Join-Path $PSScriptRoot $name
    if(-not (Test-Path -LiteralPath $file)){throw 'Application file missing'}
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"'+$file+'"')) -WindowStyle Hidden | Out-Null
}
$start.Add_Click({try{Open-TranslationTool 'Start-Background.ps1';$form.Close()}catch{[void][Windows.Forms.MessageBox]::Show('تعذر التشغيل. افتح عرض التقدم للمراجعة.','الخزانة')}})
$view.Add_Click({try{Open-TranslationTool 'Dashboard.ps1';$form.Close()}catch{[void][Windows.Forms.MessageBox]::Show('تعذر فتح لوحة التقدم.','الخزانة')}})
try {
    if($CheckOnly){
        foreach($name in @('Dashboard.ps1','Start-Background.ps1','Start-Translation.ps1','agent.mjs')){if(-not(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name))){throw ('Missing '+$name)}}
        Write-Output 'Menu verified: background start and progress-only actions; no automatic start.'
    } else {[void]$form.ShowDialog()}
} finally {$form.Dispose()}
