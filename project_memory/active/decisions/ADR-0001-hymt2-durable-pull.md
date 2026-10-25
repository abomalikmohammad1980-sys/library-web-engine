---
id: ADR-0001
title: Hy-MT2 durable local pull translation
status: active
level: P1
date: 2026-10-15
tags: [translation, cloudflare, r2, local-agent, windows]
use_when: Editing local translation routing, persistence, startup or activation
---

The user requires local Hy-MT2-7B Q4_K_M as primary for exactly the 22 supported project targets, retaining the existing fallback order and all other 14 targets. They prohibit production/resource/secret changes without approval.

Use a new SQLite-backed LocalTranslationQueue, with four stable hash shards and expiring lease tokens, as the reliable pull mechanism. All progress is durable in Cloudflare. The laptop has encrypted connection configuration but no progress checkpoint. Results can be replayed; R2 conditional creation and idempotent completion prevent duplicate committed effects. Inference itself may repeat after an unacknowledged crash.

Reuse v18 whole/segment keys and compact text records. Strict R2 reads fail closed in the local path. Check R2/KV/legacy cache before enqueue, claim, prepare and result. Preserve already committed segments after interruptions. Existing TranslationCoordinator remains the whole-request single-flight coordinator. Background fallback reserves the existing coordination guard before using it.

Separate agent and producer bearer secrets; do not give the laptop a Cloudflare management token. Internal routes reject browser Origin, require HTTPS outside loopback, enforce bounded UTF-8 JSON, and derive source/target/keys from the queued job.

Superseded on 2026-10-16: the initial GitHub-only assessment said two flags and no canonical catalog binding. Live source inspection disproved that assessment. Do not use it to plan activation.

The active Cloudflare v34 source contains AutomaticTranslations and the existing `automatic-catalog:v1` durable pending/source/batchProgress ledger, `auto/v1` R2 JSON memory and `auto:v1` KV lookup. The corrected integration was rebased locally on that deployed source, preserving the original scheduler, public lookup/status and atomic `provider-quotas:v1` reservations. Do not replace it with GitHub main's older monolithic implementation or reset/recreate the coordinator.

A third default-off flag, HY_MT_AUTOMATIC_ENABLED, gates pulling from that existing ledger. With an online local agent, eligible automatic work is deferred to local pulls; the other 14 targets and offline fallback retain their existing provider order. Automatic fallback stays DeepL/Gemini/Groq/Mistral/OpenRouter/Cloudflare AI; Azure remains disabled there. Completion reconciles the old ledger idempotently after durable R2 writes, including recovery after a crash between saving and acknowledging. Library progress is read from the old ledger separately from local queue counts. NDJSON is optional for the canary or additional sources, not required to reimport the existing catalog.

## Evidence

`deployment/translate-worker/src/local-{policy,queue,service}.mjs`, `src/index.js`, `test/*.test.mjs`, `local-agent/client.mjs`, `ACTIVATION_AR.md`, and `LIVE_AUDIT_AR.md`. GitHub baseline: 5de644880017dd71a308d8207a0360cd81114f81. Verified production basis: f6634c4b-fb27-442b-b7b6-60961b99d5e6 (v34). 64 tests and a real local workerd RPC/storage/restart exercise passed. No deployment performed.
