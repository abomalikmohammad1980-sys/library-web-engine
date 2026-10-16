# Project handoff

## Current Context — 2026-10-16 production canary

User explicitly approved staged Hy-MT2 production deployment, queue and agent secrets, then canary before backlog. Official device pairing session 80387 succeeded. Correct account db956e5187111b69e796e4a8e4c3fe36 has Workers/script/routes write scopes; no Pages scope. Do not request general deployment approval or GitHub pairing again.

Production integration is now deployed. Canary-stage version d3f384a1-340a-455d-8eca-54505932296c has HY_MT_ENABLED=true, HY_MT_AUTOMATIC_ENABLED=false, HY_MT_REQUEST_ENABLED=false. LocalTranslationQueue namespace 1cc8b9db25c446b2804d590ea9c0ee98 created; all 45 old bindings, original DO namespace, existing secret names and five-minute cron verified preserved. Do not blindly roll back to old version without the new DO export. Credentials stored only in Cloudflare secrets and Windows DPAPI outside Git.

Five bounded Indonesian title canaries completed and were reused, with duplicate completion safe and no pending/processing/failed jobs. Existing automatic memory was checked first. These are tm/v2 canaries, not automatic-ledger completions. Technical tests: 64 passed, dry-run passed. Semantic issue: Al-Adab al-Mufrad translated as generic Sastra Tunggal. Additional title instructions did not reliably fix it; reverted the experimental client/test change. Local-only transliteration gave Al-Adab al-Mufarid. No existing memory was overwritten. User has a pending quality choice: defer wide backlog for title quality or start acknowledging automatic validators do not catch every semantic error. Do not silently choose to expand while answer is pending.

Automatic approval review rejected enabling automatic feed before the bounded canary. The safer sample-only deployment was allowed and completed. Future expansion must reference completed sample evidence and the user's quality decision; do not bypass rejection indirectly.

Latest automatic progress before canary: 95,558 ready / 556,344 pairs (17.18%), 460,786 remaining, 265,525 in the 22 supported local languages. English/French complete. Counts are text-language pairs, not books. Current llama-server PID13000 was started on loopback8080 with agreed Vulkan/2048/parallel1 flags. No continuous agent started yet.

Active work branch task/hymt2-activation derives from task/hymt2-local-agent (PR9 preserved). Baseline branch task/cloudflare-live-baseline / PR10 preserves old v34 raw source and remains useful history; main was not merged. User Desktop target C:\Users\yahya\Desktop\أبوعبدالرحمن\code\_final\library-web-engine-git-v18 should track the activation branch once copied. Source of truth is live production. Whole-project Pages parity remains blocked by missing read access and unverified source/build provenance.

Evidence: deployment/translate-worker/PRODUCTION_STATUS_AR.md; task outputs/Hy-MT2-Production-Canary.json, Hy-MT2-Activation-Resources.json, Hy-MT2-Title-Check.json. Tooling scripts under work remain outside Git. Work runner decrypts DPAPI only in memory and uses Node24 environment proxy excluding loopback. Prior handoff archived at archive/environment/2026-10-16-before-production-activation.md. Architecture memory: active/decisions/ADR-0001-hymt2-durable-pull.md.
