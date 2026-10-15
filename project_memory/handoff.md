# Project handoff

## Current Context — 2026-10-15

Implemented Hy-MT2 local translation in `deployment/translate-worker` on local branch `task/hymt2-local-agent`, based on `5de644880017dd71a308d8207a0360cd81114f81` of `abomalikmohammad1980-sys/library-web-engine`. This is an isolated sparse checkout, not the older Desktop checkout with uncommitted changes and a different origin.

Production is untouched. Both activation flags are false in wrangler.toml. User explicitly requires approval before deployment, resource creation or secret changes. Follow `deployment/translate-worker/ACTIVATION_AR.md` for staged activation. Do not delete the new queue namespace on rollback.

Read-only production audit requested on 2026-10-15: the existing Wrangler OAuth session refreshes successfully but exposes a different account. Worker listing contains no `khezana-translate-router`, and the zone lookup for `khzanah.com` returns zero results. The user needs to sign in to the Khzanah account before the audit can continue. No production Worker source, bindings, or Translation Memory contents have been verified yet. Do not infer deployed-source parity from the GitHub checkout or treat local test counters as library-wide progress. All devices' existing Cloudflare translations must remain the source of truth. The in-app Cloudflare dashboard currently remains at its loading screen.

Cloudflare SQLite DO queue uses four fixed shards and 180-second leases. R2 remains authoritative. Existing v18 identities, compact storage, segment reuse, provider order and coordinator remain. Only the 22-language intersection is eligible. R2 conditional first-writer-wins protects existing entries. Local agent has no progress file.

Validation: Node tests cover legacy routing, leases/restarts/replays, strict UTF-8, storage failures, auth scopes, local-first routing and fallback. Real installed llama-server translated the book title successfully to English and Urdu with the specified Vulkan0/context/parallel flags. See the activation document and delivery report for final verification results.

Full-library progress requires enqueueing its canonical source catalog: existing translation R2 stores translated text only. Demand misses can also enqueue after request-path activation. Semantic quality in all 22 languages is not established by structural tests.

Relevant memory: `active/decisions/ADR-0001-hymt2-durable-pull.md`.

## Recent Handoffs

No previous project_memory entries existed in the inspected upstream tree.
