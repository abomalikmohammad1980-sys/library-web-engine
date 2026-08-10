param(
  [Parameter(Mandatory = $true)][string]$ManifestPath
)

$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $manifest.readOnlySource) { throw 'manifest must declare readOnlySource=true' }
$failures = [Collections.Generic.List[string]]::new()
foreach ($doc in $manifest.documents) {
  $source = Join-Path $manifest.inputDirectory $doc.name
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    $failures.Add("missing source: $($doc.name)"); continue
  }
  $sha = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sha -ne $doc.sha256) { $failures.Add("source hash changed: $($doc.name)") }
  if ($doc.status -ne 'complete') { $failures.Add("incomplete: $($doc.name)"); continue }
  if (-not (Test-Path -LiteralPath $doc.wordPageMap -PathType Leaf)) {
    $failures.Add("missing map: $($doc.name)"); continue
  }
  $map = Get-Content -LiteralPath $doc.wordPageMap -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([int]$map.totalPages -ne [int]$doc.totalPages) { $failures.Add("page total mismatch: $($doc.name)") }
  if ([int]$map.paragraphCount -ne [int]$doc.paragraphCount) { $failures.Add("paragraph total mismatch: $($doc.name)") }
  if ($map.pages.Count -ne [int]$map.totalPages) { $failures.Add("map row count mismatch: $($doc.name)") }
  for ($i = 0; $i -lt $map.pages.Count; $i++) {
    if ([int]$map.pages[$i].physicalPage -ne $i + 1) {
      $failures.Add("non-contiguous physical page at $($i + 1): $($doc.name)"); break
    }
  }
  $first = $map.pages | Select-Object -First 1
  $last = $map.pages | Select-Object -Last 1
  if ($doc.firstPage.firstText -ne $first.firstText -or $doc.firstPage.lastText -ne $first.lastText -or
      $doc.lastPage.firstText -ne $last.firstText -or $doc.lastPage.lastText -ne $last.lastText) {
    $failures.Add("UTF-8 boundary text mismatch: $($doc.name)")
  }
}
if ($failures.Count) { throw ($failures -join [Environment]::NewLine) }
[ordered]@{ status='pass'; documents=$manifest.documents.Count;
  pages=($manifest.documents | Measure-Object -Property totalPages -Sum).Sum } | ConvertTo-Json
