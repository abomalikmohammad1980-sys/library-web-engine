param(
  [Parameter(Mandatory = $true)][string]$InputDirectory,
  [Parameter(Mandatory = $true)][string]$StagingDirectory
)

$ErrorActionPreference = 'Stop'
$mapDirectory = Join-Path $StagingDirectory 'word-page-maps'
$pdfDirectory = Join-Path $StagingDirectory 'generated-pdf'
New-Item -ItemType Directory -Force $mapDirectory, $pdfDirectory | Out-Null

function Normalize-WorkName([string]$name) {
  $stem = [IO.Path]::GetFileNameWithoutExtension($name).Normalize([Text.NormalizationForm]::FormKC)
  return ([regex]::Replace($stem, '\s+', ' ')).Trim().ToLowerInvariant()
}

$pdfNames = @{}
Get-ChildItem -LiteralPath $InputDirectory -File -Filter '*.pdf' | ForEach-Object {
  $pdfNames[(Normalize-WorkName $_.Name)] = $_.FullName
}

$results = [Collections.Generic.List[object]]::new()
$converter = Join-Path $PSScriptRoot 'convert-docx-to-pdf.ps1'
foreach ($docx in Get-ChildItem -LiteralPath $InputDirectory -File -Filter '*.docx' | Sort-Object Name) {
  $key = Normalize-WorkName $docx.Name
  $sha = (Get-FileHash -LiteralPath $docx.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $artifactId = $sha.Substring(0, 12)
  $mapPath = Join-Path $mapDirectory "$artifactId.json"
  $matchingPdf = $pdfNames[$key]
  $generatedPdf = if ($matchingPdf) { $null } else { Join-Path $pdfDirectory "$artifactId.pdf" }
  $pidPath = Join-Path $StagingDirectory "$artifactId.wordpid"
  try {
    $outputPath = if ($generatedPdf) { $generatedPdf } else { Join-Path $pdfDirectory "$artifactId.unused.pdf" }
    $args = @{ InputPath = $docx.FullName; OutputPath = $outputPath;
      PageMapPath = $mapPath; WordPidPath = $pidPath }
    if ($matchingPdf) { $args.SkipPdf = $true }
    & $converter @args
    # Windows PowerShell 5 يفترض ANSI عند غياب BOM، بينما خدمة الخرائط تكتب
    # UTF-8 بلا BOM. التصريح واجب كي لا تتحول حدود الصفحات العربية إلى mojibake.
    $map = Get-Content -LiteralPath $mapPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $results.Add([ordered]@{
      name = $docx.Name; sha256 = $sha; matchingPdf = $matchingPdf
      generatedPdf = $generatedPdf; wordPageMap = $mapPath
      totalPages = [int]$map.totalPages; paragraphCount = [int]$map.paragraphCount
      firstPage = $map.pages | Select-Object -First 1
      lastPage = $map.pages | Select-Object -Last 1
      status = 'complete'
    })
  } catch {
    $results.Add([ordered]@{ name = $docx.Name; sha256 = $sha; matchingPdf = $matchingPdf
      generatedPdf = $generatedPdf; wordPageMap = $mapPath; status = 'failed'; error = $_.Exception.Message })
  }
}

$manifest = [ordered]@{
  schemaVersion = 1; inputDirectory = $InputDirectory; readOnlySource = $true
  generatedAt = [DateTime]::UtcNow.ToString('o'); documents = $results
}
$manifestPath = Join-Path $StagingDirectory 'word-artifacts-manifest.json'
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
$manifest | ConvertTo-Json -Depth 5
