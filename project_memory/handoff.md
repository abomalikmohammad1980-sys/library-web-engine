# Project handoff

## Current Context — 2026-10-16

The user corrected the sync direction: live Cloudflare is authoritative. Match translation first, then the whole project, with the requested Desktop checkout and GitHub. Work on task/cloudflare-live-baseline, based on main 5de644880017dd71a308d8207a0360cd81114f81. Do not deploy to make Cloudflare match Git.

Translation src/index.js is an exact raw download of active khezana-translate-router v34 (f6634c4b-fb27-442b-b7b6-60961b99d5e6), rechecked 2026-10-16 11:27 UTC. SHA256 17f41274d3c9d5859860bf1af17fcf43d2051d8ea84834c6270aff2d4476c6fb. Original source and active-version etags agree. Config retains all 33 verified plain vars and bindings, restores verified five-minute cron and disables rebundling for exact module preservation. Existing routes retained; full route inventory permission is missing. No production writes, enqueue, data migration or secrets changed.

Hy-MT2 enhancements and their detailed prior memory remain preserved on task/hymt2-local-agent at 178812ce404c78d5f694ebdd108b8a9da962f6e3, PR #9. They are not deployed or included in this baseline branch. Do not discard that branch or merge it as part of the baseline recovery.

40 local tests passed, including Arabic error output, automatic progress/cron and cross-device R2/KV reuse. Wrangler 4.151.0 dry-run passed. Baseline hashes are checked in CI. Runtime source was not modified to satisfy tests; one old literal-source assertion now tests actual Arabic output because the deployed bundle contains Unicode escapes.

Whole-project audit: all 10 account Workers were downloaded read-only, active metadata verified and inventoried in deployment/cloudflare-baseline-inventory.json. Their raw snapshots are in the task outputs/cloudflare-live-snapshot outside Git. Pages project API returns 403 with the current OAuth scopes; deployed site/source commit is still unverified. Do not claim full three-way parity or replace app/packages using guessed source. Need authorized Pages read access and the original source/build provenance to finish phase 2.

Desktop target: C:\Users\yahya\Desktop\أبوعبدالرحمن\code\_final\library-web-engine-git-v18. Preserve other older local copies. GitHub owner pairing and repository-scoped credentials already work; do not ask for GitHub pairing again. Use existing Windows system proxy per process for network access. Cloudflare OAuth refresh works through Wrangler whoami; it has no Pages access. Never log tokens or copy private auth stores into Git.

Relevant memory: active/environment/ENV-0001-cloudflare-source-of-truth.md.
