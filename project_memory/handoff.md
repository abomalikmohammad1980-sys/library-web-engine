# Project handoff

## Current Context — 2026-10-15

Implemented Hy-MT2 local translation in `deployment/translate-worker` on local branch `task/hymt2-local-agent`, based on `5de644880017dd71a308d8207a0360cd81114f81` of `abomalikmohammad1980-sys/library-web-engine`. This is an isolated sparse checkout, not the older Desktop checkout with uncommitted changes and a different origin.

Production is untouched. Both activation flags are false in wrangler.toml. User explicitly requires approval before deployment, resource creation or secret changes. Follow `deployment/translate-worker/ACTIVATION_AR.md` for staged activation. Do not delete the new queue namespace on rollback.

Read-only live audit on 2026-10-16: device OAuth login succeeded for the correct Khzanah account `db956e5187111b69e796e4a8e4c3fe36` after localhost callbacks failed. Current default Wrangler scopes are user/account/zone/workers_tail READ plus offline_access. Do not request write scopes for this audit; auto-review rejected that broader authorization earlier. No login process remains active.

Live Worker `khezana-translate-router` version 34 / `f6634c4b-fb27-442b-b7b6-60961b99d5e6` serves 100%, deployed 2026-10-03 08:15:07 UTC. All 33 plain-text vars, compatibility date, R2/KV/coordinator/Analytics bindings match the GitHub baseline. Live source GET returned multipart parts as strings, so the first downloader saved no modules. The parser was corrected, but retries failed with ENOTFOUND / DNS operation refused for api.cloudflare.com (also github.com). Thus source parity is NOT verified yet. R2 bucket metadata GET was 403 and KV listing 401 with current read-only OAuth scopes; routes also 403. Do not treat configuration parity as source parity or test counters as library progress. See deployment/translate-worker/LIVE_AUDIT_AR.md.

Also discovered live `khezana-localization-engine` bound to R2 `khezana-site-locales` as LOCALE_FILES, service TRANSLATOR -> khezana-translate-router, and SQLite DO LocalizationCoordinator. Its deployed source/role in content publication and existing progress must be inspected before activation. No corresponding localization-engine file was found in the available GitHub tree paths. All devices' existing Cloudflare translations remain authoritative. Audit scratch files live in workspace work/cloudflare-audit; source downloader work/audit-cloudflare-live.mjs supports --sources-only and never logs tokens. Resume source GET when networking recovers, then obtain user-approved read-only storage access if needed; no deployment, enqueue, or production translation occurred.

Cloudflare SQLite DO queue uses four fixed shards and 180-second leases. R2 remains authoritative. Existing v18 identities, compact storage, segment reuse, provider order and coordinator remain. Only the 22-language intersection is eligible. R2 conditional first-writer-wins protects existing entries. Local agent has no progress file.

Validation: Node tests cover legacy routing, leases/restarts/replays, strict UTF-8, storage failures, auth scopes, local-first routing and fallback. Real installed llama-server translated the book title successfully to English and Urdu with the specified Vulkan0/context/parallel flags. See the activation document and delivery report for final verification results.

Full-library progress requires enqueueing its canonical source catalog: existing translation R2 stores translated text only. Demand misses can also enqueue after request-path activation. Semantic quality in all 22 languages is not established by structural tests.

Relevant memory: `active/decisions/ADR-0001-hymt2-durable-pull.md`.

## Recent Handoffs

No previous project_memory entries existed in the inspected upstream tree.
