# Project handoff

## Current Context — 2026-10-16

Hy-MT2 integration is local only on task/hymt2-local-agent in the isolated outputs/library-web-engine checkout. Original GitHub main base is 5de644880017dd71a308d8207a0360cd81114f81. All three flags HY_MT_ENABLED, HY_MT_AUTOMATIC_ENABLED and HY_MT_REQUEST_ENABLED are false. Production deployment, resources and runtime secrets require explicit user approval. Do not interpret temporary audit-token approval as deployment approval.

CRITICAL CORRECTION: live Cloudflare code differs from main. Downloaded active khezana-translate-router v34, f6634c4b-fb27-442b-b7b6-60961b99d5e6, deployed 2026-10-03. Raw source SHA256 17f41274d3c9d5859860bf1af17fcf43d2051d8ea84834c6270aff2d4476c6fb. Rebased local index.js on that source, then reapplied local hooks. 141 of 149 top-level functions match the deployed source after formatting; provider adapters/order/shared quota functions unchanged. See deployment/translate-worker/LIVE_AUDIT_AR.md.

Live automatic-catalog:v1 in TranslationCoordinator owns existing source/pending/batchProgress/completedTranslations. Its R2 auto/v1 JSON and KV auto:v1 lookup coexist with tm/v2 full/segment memory. Local pulls now feed from the existing pending ledger, save the existing auto format, and reconcile old counters idempotently. Keep provider-quotas:v1 shared quota reservations and verified five-minute cron. Automatic fallback is DeepL/Gemini/Groq/Mistral/OpenRouter/Cloudflare AI; Azure remains disabled there. Preserve all 14 unsupported targets. Do NOT reimport/reset the existing catalog. NDJSON remains optional for canaries/additional sources.

Snapshot on 2026-10-16: 15,454 unique sources, 556,344 text-language pairs, 95,558 ready (17.18%), 460,786 remaining. English/French complete in that catalog. completedTranslations=66,277 plus reviewedReused=29,281. These are not full translated books. Library status now appears separately from local queue counts.

Correct account is abomalikmohammad1980@gmail.com / db956e5187111b69e796e4a8e4c3fe36. Default Wrangler OAuth is read-only (user/account/zone/workers_tail plus offline_access). User approved a temporary R2/KV READ token and saved it successfully as Windows DPAPI in workspace work/private/khzanah-storage-read-token.xml; metadata alongside, expiry 2026-10-17 20:59:59 UTC. Token values never in repository/logs/output. Read-only bucket/KV verification and R2 samples succeeded. Do not request login or this read-token approval again.

Network root cause resolved: Node/Git did not inherit Windows system proxy. Read System.Net.Http.HttpClient.DefaultProxy or native Windows WebRequest.DefaultWebProxy and use the EXISTING setting only within the process. Do not change Windows networking. Wrangler refresh then worked. Launcher supports existing Windows proxy through Node env-proxy support (Node 24+), excluding loopback.

Other service khezana-localization-engine source was inspected; its khezana-site-locales bucket was empty. Its protected DO database was not read. Do not modify it. Routes API was 403; the actual khzanah.com/api/translate/automatic route was read successfully. No production writes, enqueue, inference or deployment occurred.

Validation: 64 Node tests passed; syntax/PowerShell 5.1 BOM checks and Wrangler dry-run passed. Real local workerd tested existing ledger -> queue -> R2/KV -> counters, duplicate completion, process restart and cached cross-DO callback. Earlier real llama English/Urdu generation passed. Semantic quality across all 22 languages is not established by structural checks.

Artifacts: outputs/Hy-MT2-Local-Agent.zip, outputs/hymt2-local-agent.patch, full checkout, outputs/cloudflare-baseline/khezana-translate-router-2026-10-03.js. Audit scripts/data stay in work/cloudflare-audit; credential wrappers stay outside release. Temporary local tests only. Update artifacts after changes. Follow ACTIVATION_AR.md for staged activation; recheck active live version before deployment and preserve current DO namespaces.

Relevant memory: active/decisions/ADR-0001-hymt2-durable-pull.md.

## Code synchronization — 2026-10-16

User authorized copying the completed code to C:\Users\yahya\Desktop\أبوعبدالرحمن\code\_final\library-web-engine-git-v18 and uploading to the same GitHub repository. The target did not exist at inspection; preserve the separate older sibling checkout. This authorization does not include Cloudflare deployment or changes to live resources/secrets. Keep the task branch until repository review/merge. Verify the Desktop checkout and remote branch have the same commit before reporting synchronization.

Translation CI now runs all three test files (64 tests), and its dry-run uses the locally verified Wrangler 4.151.0. A [CF-Pages-Skip] commit prefix prevents Pages deployment for the upload while leaving GitHub checks enabled. Existing ingestion workflows are manual/scheduled; this upload does not dispatch them. The saved GitHub account yahyakmail59 has pull permission only; uploading requires an authorized account. Never copy credentials into the repository or release archive.

## Recent Handoffs

The pre-storage-audit assessment (superseded by direct live evidence) is archived at archive/environment/2026-10-16-pre-storage-audit.md.
