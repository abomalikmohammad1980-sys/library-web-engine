# Cloudflare Pages operator runbook — candidate `2d31228b`

> تشغيل يدوي فقط بعد توفر هوية Cloudflare مخوّلة. نفّذ الأوامر من `alpha-publish`. لا تُدخل token في ملف أو في سطر الأوامر.

## 1. تثبيت المرشح والتحقق المحلي

```powershell
Set-Location 'B:\المكتبة\الخزانة\source_code\تعديلات على المكتبة\alpha-publish'
$Candidate = '2d31228b6b35d1fc25892ae3b2cef93fdbd5209e60657251f4b368a1fe73bf8d'
$Previous = '18f559aef28ce51e5b7c44fbe809c5094c7178e0195ae36d4ba58e8ad079c5e0'
$Project = 'alkhizana-alpha'
$PreviewBranch = 'alpha-preview'
$Current = Get-Content -Raw '.\release-artifacts\current.json' | ConvertFrom-Json
$PreviousPointer = Get-Content -Raw '.\release-artifacts\previous.json' | ConvertFrom-Json
if ($Current.payloadFingerprint -ne $Candidate) { throw 'candidate_fingerprint_mismatch' }
if ($PreviousPointer.fingerprint -ne $Previous) { throw 'previous_fingerprint_mismatch' }
npm run release:verify
npm run pages:preflight
```

## 2. إيجاد المشروع أو إنشاؤه

```powershell
node .\node_modules\wrangler\bin\wrangler.js pages project list --json
```

```powershell
node .\node_modules\wrangler\bin\wrangler.js pages project create $Project --production-branch main
```

> نفّذ أمر الإنشاء فقط إذا لم يظهر `alkhizana-alpha` في القائمة.

## 3. نشر Preview من المرشح نفسه

```powershell
$PreviewLog = node .\node_modules\wrangler\bin\wrangler.js pages deploy .\pages-dist --project-name $Project --branch $PreviewBranch 2>&1
$PreviewLog | Tee-Object '.\release-artifacts\preview-deploy-2d31228b.log'
$PreviewUrl = ([regex]::Match(($PreviewLog -join "`n"), 'https://[^\s]+\.pages\.dev')).Value
if (-not $PreviewUrl) { throw 'preview_url_not_found' }
```

## 4. التحقق من Preview

```powershell
curl.exe --fail --silent --show-error --location "$PreviewUrl/" --output "$env:TEMP\alkhizana-preview-index.html"
curl.exe --fail --silent --show-error --head "$PreviewUrl/assets/index-DA9v9Yak.js"
curl.exe --fail --silent --show-error --head "$PreviewUrl/quran/full/manifest.json"
curl.exe --fail --silent --show-error --head "$PreviewUrl/library/published/manifest.json"
curl.exe --fail --silent --show-error --location "$PreviewUrl/library" --output "$env:TEMP\alkhizana-preview-library.html"
curl.exe --fail --silent --show-error --location "$PreviewUrl/reader/nonexistent-smoke" --output "$env:TEMP\alkhizana-preview-spa.html"
$RemoteQ13 = curl.exe --fail --silent --show-error "$PreviewUrl/q13-manifest.json" | ConvertFrom-Json
if ($RemoteQ13.fingerprint -ne $Candidate) { throw 'preview_candidate_mismatch' }
if ((curl.exe --fail --silent --show-error "$PreviewUrl/manifest.webmanifest") -notmatch 'الخزانة') { throw 'preview_manifest_invalid' }
```

```powershell
curl.exe --fail --silent --show-error --head "$PreviewUrl/" | Select-String 'x-content-type-options|referrer-policy|permissions-policy|x-frame-options'
curl.exe --fail --silent --show-error --head "$PreviewUrl/assets/index-DA9v9Yak.js" | Select-String 'cache-control'
curl.exe --fail --silent --show-error --head "$PreviewUrl/quran/full/manifest.json" | Select-String 'cache-control'
```

## 5. الترقية إلى Production

```powershell
npm run release:verify
$ProductionLog = node .\node_modules\wrangler\bin\wrangler.js pages deploy .\pages-dist --project-name $Project --branch main 2>&1
$ProductionLog | Tee-Object '.\release-artifacts\production-deploy-2d31228b.log'
$ProductionUrl = ([regex]::Match(($ProductionLog -join "`n"), 'https://[^\s]+\.pages\.dev')).Value
if (-not $ProductionUrl) { throw 'production_url_not_found' }
```

```powershell
$ProductionQ13 = curl.exe --fail --silent --show-error "$ProductionUrl/q13-manifest.json" | ConvertFrom-Json
if ($ProductionQ13.fingerprint -ne $Candidate) { throw 'production_candidate_mismatch' }
curl.exe --fail --silent --show-error --location "$ProductionUrl/library" --output "$env:TEMP\alkhizana-production-library.html"
curl.exe --fail --silent --show-error "$ProductionUrl/quran/full/manifest.json" | ConvertFrom-Json | Out-Null
curl.exe --fail --silent --show-error "$ProductionUrl/library/published/manifest.json" | ConvertFrom-Json | Out-Null
curl.exe --fail --silent --show-error --head "$ProductionUrl/" | Select-String 'x-content-type-options|referrer-policy|permissions-policy|x-frame-options'
node .\node_modules\wrangler\bin\wrangler.js pages deployment list --project-name $Project
```

## 6. الرجوع الفوري عند فشل التحقق

```powershell
$RollbackDir = Join-Path '.\release-artifacts' (Join-Path $Previous 'pages-dist')
if (-not (Test-Path -LiteralPath $RollbackDir -PathType Container)) { throw 'previous_artifact_missing' }
$RollbackManifest = Get-Content -Raw (Join-Path '.\release-artifacts' (Join-Path $Previous 'q13-manifest.json')) | ConvertFrom-Json
if ($RollbackManifest.fingerprint -ne $Previous) { throw 'previous_artifact_mismatch' }
$RollbackPayload = Get-Content -Raw (Join-Path $RollbackDir 'q13-manifest.json') | ConvertFrom-Json
$RollbackLog = node .\node_modules\wrangler\bin\wrangler.js pages deploy $RollbackDir --project-name $Project --branch main 2>&1
$RollbackLog | Tee-Object '.\release-artifacts\rollback-to-18f559ae.log'
$RollbackUrl = ([regex]::Match(($RollbackLog -join "`n"), 'https://[^\s]+\.pages\.dev')).Value
if (-not $RollbackUrl) { throw 'rollback_url_not_found' }
```

```powershell
$RemoteRollback = curl.exe --fail --silent --show-error "$RollbackUrl/q13-manifest.json" | ConvertFrom-Json
if ($RemoteRollback.fingerprint -ne $RollbackPayload.fingerprint) { throw 'rollback_fingerprint_mismatch' }
curl.exe --fail --silent --show-error --location "$RollbackUrl/library" --output "$env:TEMP\alkhizana-rollback-library.html"
curl.exe --fail --silent --show-error "$RollbackUrl/quran/full/manifest.json" | ConvertFrom-Json | Out-Null
curl.exe --fail --silent --show-error "$RollbackUrl/library/published/manifest.json" | ConvertFrom-Json | Out-Null
node .\node_modules\wrangler\bin\wrangler.js pages deployment list --project-name $Project
```

## مراجع الأوامر

- Cloudflare Pages Direct Upload: <https://developers.cloudflare.com/pages/get-started/direct-upload/>
- Wrangler Pages commands: <https://developers.cloudflare.com/workers/wrangler/commands/#pages>
- عقد المرشح المحلي: `docs/qa/final-frozen-source-release-2026-08-09.md`
- فحص ما قبل النشر: `docs/qa/cloudflare-pages-deployment-preflight-2026-08-09.md`
