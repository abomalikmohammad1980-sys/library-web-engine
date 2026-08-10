param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open($InputPath, $false, $true)
  # wdFormatXMLDocument = 12: نسخة عمل DOCX يقرأها العارض، مع إبقاء الأصل منفصلًا.
  $document.SaveAs2($OutputPath, 12)
} finally {
  if ($null -ne $document) {
    $document.Close($false)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
  }
  if ($null -ne $word) {
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

if (-not (Test-Path -LiteralPath $OutputPath)) { throw 'لم يُنشئ Microsoft Word نسخة DOCX.' }
