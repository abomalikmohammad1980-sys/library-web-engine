# Archived handoff — before desktop lifecycle repair

Status: superseded current context; P3 archive; preserved 2026-10-16.

The full previous handoff follows unchanged. Earlier live PIDs/counters are historical. Manual-only and final two-slot decisions remain important. Earlier confident causal claims involving startup delays, path encoding or WMI do not establish the original reported credential failure; use current BUG-0001 and its evidence instead.

---

# Project handoff

## Current Context — 2026-10-16 automatic backlog active

User explicitly authorized production, queue, secrets and staged activation. After five successful canaries and disclosure of the Al-Adab al-Mufrad semantic issue, user confirmed the agreed 22 languages. Automatic activation was approved and deployed as 3feca1c4-9a16-476c-91ad-808d3140d3db. HY_MT_ENABLED=true, HY_MT_AUTOMATIC_ENABLED=true, HY_MT_REQUEST_ENABLED=false. All 45 previous bindings and five-minute cron verified preserved. Keep original R2/KV/coordinator/Analytics and 14 other languages unchanged. Do not reset/import catalog or overwrite saved memory.

Continuous local agent started via launcher PID12376 (check fresh process state before relying on PID); llama-server PID13000. Logs in task work/agent-continuous.stdout.log and stderr.log. Cloudflare automatic ledger demonstrably advanced from 95,558 to 95,559 ready, then agent continued; 556,344 total source-language pairs across 36 languages. Local queue also contains five manual canaries; do not confuse this with global catalog count. Progress lives in Cloudflare, not local files. DPAPI connection settings already installed outside Git. Do not ask for login or general activation approval again.

Activation branch task/hymt2-activation derives from task/hymt2-local-agent (PR9). Baseline branch/PR10 preserves old v34. Main unmerged; whole-project Pages parity is not established. Requested Desktop checkout library-web-engine-git-v18 is to track activation. Only config and documentation changed for activation; original 64 tests and dry-run passed. Prompt experiments reverted. Semantic validators cannot certify title meaning; user informed and chose to proceed.

Evidence: deployment/translate-worker/PRODUCTION_STATUS_AR.md; task outputs/Hy-MT2-Activation-Resources.json, Hy-MT2-Production-Canary.json, Cloudflare-Translation-Progress-Latest.json. Prior canary context archived at archive/environment/2026-10-16-canary-before-backlog.md; earlier context at archive/environment/2026-10-16-before-production-activation.md. Architecture: active/decisions/ADR-0001-hymt2-durable-pull.md. Never roll back blindly to a Worker version lacking the new DO export.

## Dashboard update — 2026-10-16

User requested a live application, automatic resume after Windows login, and parallel 22-local/14-external translation. Added native Windows Forms Dashboard.ps1/cmd: authenticated read-only Cloudflare status every15seconds, 36-language grid, grouped remaining counts, local controls, stale/offline state and external quota notice. DPAPI token stays in memory. Startup checkbox creates/removes only Khzanah Translation.lnk in current user's Startup. Dashboard -StartAgent supervises local startup every30seconds while open; closing dashboard leaves agent running. No Worker change/deployment needed: existing scheduler test confirms unsupported14 continue while online local22 are deferred. All64 regression tests pass. Live dashboard check rendered36languages and validUTF8. External providers currently report daily guards (Gemini/Groq/OpenRouter) and unsupported language; do not claim external progress every minute or raise quota limits automatically. Expected installation moves agent from old canonical background session to Desktop launcher; verify fresh processes rather than relying on earlierPIDs.

## Superseding UI and startup preference — 2026-10-16
User explicitly wants MANUAL ONLY. Startup shortcut removed; Khzanah-Translate.cmd on Desktop opens/resumes. Do not restore login startup despite older notes. Usability update adds explicit running/stopped/loading/offline/idle/retry states, mutually enabled start/stop buttons, gray disabled buttons, explanations of local-only stop and cloud lease counters, single-dashboard mutex to prevent conflicting supervisors. Tests: test/dashboard-state.ps1 covers6states; live36language check and own-form rendered preview verified. No Worker/runtime translation changes.

## Sequential languages — 2026-10-16
User now requests completing each language before moving on. Local feed pins localActiveLanguage:v1 in existing coordinator; selects first remaining supported language in project order, resets scan cursor only on language change, and SQL claims filter target so old other-language pending jobs remain preserved. External scheduler resets once to project order, skips online-local targets, and stays on current external language through retry/backoff/end-of-scan until counter reaches0. Public status mode one-language-at-a-time-v1 includes localActiveLanguage. All67 tests pass incl restart, filtered claim, provider backoff ordering. No memory reset, resource or secret changes.

## Lightweight manual menu — 2026-10-16
User explicitly chose ONE file with start/progress menu. Desktop Khzanah-Translate.cmd now opens Translation-Menu.ps1. Background start spawns existing launcher without dashboard; progress action opens Dashboard without StartAgent. Menu closes after selection. No Windows startup. Existing mediator measured~118MB excluding model/shared GPU memory; never promise tiny model footprint. Start-Background checks loader+agent and serializes launch to avoid duplicate log truncation. Agent first cloud pull moved inside retry loop for offline startup recovery, tested with mocked offline child process. No Cloudflare changes or concurrency increase.

## Background launcher permission fix — 2026-10-16
User reported generic start error from Desktop menu. Reproduced Access denied at Get-CimInstance in restricted context. Start-Background now checks the existing launcher mutex instead of enumerating processes; releases locks before showing errors and records only safe diagnostic stage/type/HResult/time. Verified Windows PowerShell syntax, mocked fresh launch with CIM denied, and actual already-running path without duplicate agent. Existing process pair preserved. No Cloudflare deployment or progress changes.


Follow-up: user reported settings-stage error on Desktop. Existing settings and DPAPI decryption verified via Explorer ShellExecute (same user yahya); actual background helper also returned without error. Root cause of that screenshot remains unconfirmed. Moved existing-agent mutex check before settings, uses Windows known-folder path, identifies exact settings filename on failure and falls back to temp diagnostic if settings directory cannot be written. Fresh-start path tested with process start mocked; live existing-agent path passed.


## Tray monitor — 2026-10-16
User requested notification-area icon with status, language and per-language completion. Dashboard now owns tray plus optional form, closes form to tray, single-instance show event, shared start/stop actions. Menu background option starts helper and Dashboard -Tray; no Windows auto-start. Status reads cloud every15sec with stale marking and distinguishes local process query failure. Progress tests cover language transition/zero/missing data. Desktop runtime must be checked using Desktop script paths to match its worker processes; canonical preview cannot identify Desktop processes by path.


## Measured parallelism supersedes parallel=1 — 2026-10-16
User requested maximum measured safe concurrency and explicitly approved port8081 if8080 conflicts. Tested 12 identical Turkish inputs per stage: 1=4.84/min, 2=5.58/min, 4=7.72/min; repeat4=7.19/min. Six aborted at1186MB available;7/8 not attempted. Configure local-parallel.txt=4 and local-model-port.txt=8081. Port8080 was held by3proxy after original server stopped; never kill that unrelated process. New agent has four independent lease loops, same-language cloud selection unchanged, memory admission gate4/2/1/0 at1700/1400/1200MB, existing jobs finish. Model keeps one copy, context2048 per slot,8192total. CPU/temperature/UI responsiveness not guaranteed; guard does not unload weights.72 Node tests pass incl concurrent lease/result isolation; no Worker deployment. Report LOCAL_PERFORMANCE_AR.md; task output Translation-Concurrency-Assessment-AR.md. Verify deployed local runtime and Cloudflare counter advance before reporting activation complete.


### Superseding FINAL runtime decision
Short benchmark4 succeeded, but real agent startup4 left only587MB free and correctly gated all new pulls. Reconfigured actual local-parallel.txt to2, port8081. Verified props slots2/context2048, concurrent cloud processing2, completed275->277, failed0, global ready95828->95830. At1316MB guard dropped new-work capacity to1. Final installed maximum is TWO, not4;4 remains supported code but is not configured. Do not claim4 safely active or no impact.72 tests passed. User should use same Desktop cmd/tray. Runtime operation on8081 restored,3proxy untouched.
