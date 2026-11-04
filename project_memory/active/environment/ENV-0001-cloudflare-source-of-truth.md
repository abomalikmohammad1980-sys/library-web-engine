---
id: ENV-0001-cloudflare-source-of-truth
title: Cloudflare is the authoritative deployed code
level: P1
status: active
tags: [cloudflare, translation, synchronization, deployment]
use_when: Matching GitHub/local code to production or planning deployment
---

User direction on 2026-10-16: synchronize FROM Cloudflare, translation first, then the whole project. This supersedes treating the Hy-MT2 branch as the target for production parity. The previous implementation and its memory remain on task/hymt2-local-agent / PR #9.

Evidence: deployment/translate-worker/cloudflare-baseline.json records active version, byte hashes, non-secret bindings, cron and read-access limitations. deployment/cloudflare-baseline-inventory.json records the other deployed Workers. Whole-site parity is not established because Pages reads returned 403. Compiled Worker/Pages output alone is not proof that editable application source and build inputs match.

No Cloudflare deployment, resources, stored translations or secrets may be changed by this synchronization. Preserve R2 auto/v1 and tm/v2, KV, automatic-catalog:v1, provider-quotas:v1, Analytics and the production scheduler. Continue from live stored progress; never reset or import the catalog to match source files.
