# تصدير docx إلى XPS عبر Word — يعمل حصرًا على جهاز البيئة المرجعية (REFERENCE_ENV.md)
param(
  [Parameter(Mandatory=$true)][string]$InputDocx,
  [Parameter(Mandatory=$true)][string]$OutXps
)
$ErrorActionPreference = "Stop"
$in  = (Resolve-Path $InputDocx).Path
$out = [System.IO.Path]::GetFullPath($OutXps)
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  # ReadOnly + بلا AddToRecentFiles — لا نلمس المستند
  $doc = $word.Documents.Open($in, $false, $true)
  # WdExportFormat: 18 = wdExportFormatXPS
  $doc.ExportAsFixedFormat($out, 18)
  $doc.Close(0)
  Write-Output "OK: $out"
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
