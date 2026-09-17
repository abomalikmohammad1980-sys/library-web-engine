param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$PageMapPath = '',
  [string]$WordPidPath = '',
  [switch]$SkipPdf
)

$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
  $beforeWordPids = @(Get-Process -Name WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  if ($WordPidPath) {
    $ownedPid = Get-Process -Name WINWORD -ErrorAction SilentlyContinue |
      Where-Object { $beforeWordPids -notcontains $_.Id } | Select-Object -First 1 -ExpandProperty Id
    if ($ownedPid) { [IO.File]::WriteAllText($WordPidPath, [string]$ownedPid, [Text.Encoding]::ASCII) }
  }
  $document = $word.Documents.Open($InputPath, $false, $true)
  # حدّث الحقول وأعد الترقيم قبل التصدير؛ بعض الملفات المرفوعة تحمل نتائج حقول قديمة.
  try { [void]$document.Fields.Update() } catch {}
  try { [void]$document.Repaginate() } catch {}
  # wdExportFormatPDF = 17. التصدير من Word نفسه يحفظ الصفحات والتنسيقات الأصلية.
  # BitmapMissingFonts=true: إذا منع ترخيص الخط تضمينه، يرسم Word النص بصور
  # بدل استبدال الخط وتخريب اتصال العربية. بقية المعاملات مثبتة صراحةً.
  if (-not $SkipPdf) {
    $document.ExportAsFixedFormat($OutputPath, 17, $false, 0, 0, 1, 1, 0, $true, $true, 1, $true, $true, $false)
  }
  if ($PageMapPath) {
    $starts = [Collections.Generic.List[object]]::new()
    $paragraphAudits = [Collections.Generic.List[object]]::new()
    $clean = {
      param([string]$value)
      if ($null -eq $value) { return '' }
      return [regex]::Replace(($value -replace "[`r`a]", ' '), '\s+', ' ').Trim()
    }
    $previousPhysical = 0
    for ($i = 1; $i -le $document.Paragraphs.Count; $i++) {
      $paragraph = $document.Paragraphs.Item($i)
      $range = $paragraph.Range
      # 3 = wdActiveEndPageNumber، 1 = wdActiveEndAdjustedPageNumber.
      $physical = [int]$range.Information(3)
      if ($physical -ne $previousPhysical) {
        $starts.Add([ordered]@{
          paragraphIndex = $i - 1
          physicalPage = $physical
          adjustedPage = [int]$range.Information(1)
        })
        $previousPhysical = $physical
      }
      $paragraphAudits.Add([ordered]@{
        paragraphIndex = $i - 1
        physicalPage = $physical
        adjustedPage = [int]$range.Information(1)
        text = (& $clean $range.Text)
      })
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($paragraph)
    }
    $totalPages = [int]$document.ComputeStatistics(2)
    $pageAudits = [Collections.Generic.List[object]]::new()
    $startsByPhysical = @{}
    for ($s = 0; $s -lt $starts.Count; $s++) { $startsByPhysical[[int]$starts[$s].physicalPage] = $s }
    for ($physicalPage = 1; $physicalPage -le $totalPages; $physicalPage++) {
      if (-not $startsByPhysical.ContainsKey($physicalPage)) {
        # الورقة الفارغة لا تملك paragraphIndex. نسجلها صراحةً بدل اختلاق
        # بداية مكررة تكسر ملكية الفقرة أو إسقاط الورقة من الإجمالي.
        $pageRange = $document.GoTo(1, 1, $physicalPage) # wdGoToPage, wdGoToAbsolute
        $pageAudits.Add([ordered]@{
          physicalPage = $physicalPage
          adjustedPage = [int]$pageRange.Information(1)
          firstParagraphIndex = -1
          lastParagraphIndex = -1
          firstText = ''
          lastText = ''
        })
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($pageRange)
        continue
      }
      $p = [int]$startsByPhysical[$physicalPage]
      $firstIndex = [int]$starts[$p].paragraphIndex
      $lastIndex = if ($p + 1 -lt $starts.Count) { [int]$starts[$p + 1].paragraphIndex - 1 } else { [int]$document.Paragraphs.Count - 1 }
      while ($firstIndex -le $lastIndex) {
        $probeParagraph = $document.Paragraphs.Item($firstIndex + 1)
        $probe = $probeParagraph.Range
        $probeText = (& $clean $probe.Text)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($probe)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($probeParagraph)
        if ($probeText) { break }
        $firstIndex++
      }
      while ($lastIndex -ge $firstIndex) {
        $probeParagraph = $document.Paragraphs.Item($lastIndex + 1)
        $probe = $probeParagraph.Range
        $probeText = (& $clean $probe.Text)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($probe)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($probeParagraph)
        if ($probeText) { break }
        $lastIndex--
      }
      if ($firstIndex -gt $lastIndex) {
        $firstIndex = [int]$starts[$p].paragraphIndex
        $lastIndex = $firstIndex
      }
      $firstParagraph = $document.Paragraphs.Item($firstIndex + 1)
      $lastParagraph = $document.Paragraphs.Item($lastIndex + 1)
      $firstRange = $firstParagraph.Range
      $lastRange = $lastParagraph.Range
      $pageAudits.Add([ordered]@{
        physicalPage = $physicalPage
        adjustedPage = [int]$starts[$p].adjustedPage
        firstParagraphIndex = $firstIndex
        lastParagraphIndex = $lastIndex
        firstText = (& $clean $firstRange.Text)
        lastText = (& $clean $lastRange.Text)
      })
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($firstRange)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($lastRange)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($firstParagraph)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($lastParagraph)
    }
    $pageMapJson = @{
      totalPages = $totalPages
      paragraphCount = [int]$document.Paragraphs.Count
      starts = $starts
      pages = $pageAudits
      paragraphs = $paragraphAudits
    } | ConvertTo-Json -Depth 5 -Compress
    # Windows PowerShell 5.1 has no utf8NoBOM encoding name. Write explicitly
    # without a BOM so Node can parse the response consistently.
    [IO.File]::WriteAllText($PageMapPath, $pageMapJson, [Text.UTF8Encoding]::new($false))
  }
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

if (-not $SkipPdf -and -not (Test-Path -LiteralPath $OutputPath)) {
  throw 'لم يُنشئ Microsoft Word ملف PDF.'
}
