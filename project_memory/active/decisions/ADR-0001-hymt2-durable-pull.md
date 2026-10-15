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

Two default-off flags allow background canary before public request routing. Current Worker has no binding to the canonical source catalog, so bulk backlog creation uses an idempotent UTF-8 NDJSON producer. Statistics cover enqueued jobs, not the entire library until seeded.

## Evidence

`deployment/translate-worker/src/local-{policy,queue,service}.mjs`, `src/index.js`, `test/*.test.mjs`, `local-agent/client.mjs`, and `ACTIVATION_AR.md`. Upstream baseline: 5de644880017dd71a308d8207a0360cd81114f81. No deployment performed.
