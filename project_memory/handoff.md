# Project handoff

## Current Context — 2026-10-16 actual Desktop settings visibility repair

The user's next real Desktop restart again stayed at connection setup after the prior lifecycle acceptance passed. Those earlier tests remain valid for their tested process context, but their claim to establish equivalence with the user's Desktop context is SUPERSEDED. Same SID, session, path and an Explorer ShellExecute call were insufficient evidence.

Confirmed using a PowerShell named-pipe runspace inside the user's already-running Dashboard PID 5672: its LocalAppData/KhzanahLocalTranslation directory contained only the new dashboard-runtime.json and runtime-diagnostics.jsonl; worker-url.txt and agent-token.xml were absent. The tool context saw settings plus older logs at the exact same textual path. The live error was read-url/FileNotFound. This demonstrates divergent filesystem views. Subsequent GetFinalPathNameByHandle checks proved the tool-side logical path resolves under AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Local/KhzanahLocalTranslation, while the actual Desktop helper resolves the ordinary AppData/Local/KhzanahLocalTranslation path. Codex package AppData redirection is therefore established. Native GetPackageFullName had reported UNPACKAGED for both processes; that check alone did not reveal the inherited/redirection behavior.

The repair installed settings in the actual Desktop view by copying only the existing encrypted credential XML and existing URL, parallel setting TWO and port 8081 through the live process runspace. Decryption succeeded there. No Cloudflare secret, model, translation memory or progress was changed. At 2026-10-16T19:11:01Z the actual Dashboard reported cloudOnline and verified true, with a model and agent running; the historical snapshot was queue completed 553, global ready 96,106, Turkish. Do not treat these counters or PIDs as current without reading live state.

Actual-context full-exit/restart acceptance PASSED with success true at 2026-10-16T19:15:35.5157041Z. The harness ran from the original user process context: initial user-instance shutdown, three cold starts, two complete exits followed by 35 seconds without orphan/restarted processes, and 36 seconds of duplicate-open observation. Every cold start restored one dashboard, launcher, model and agent with working settings and Cloudflare connection. Queue completion advanced 555 to 558 and global ready 96,108 to 96,111; the final third instance was left healthy and running on Turkish. These are historical test observations, not permanent counters. Evidence: work/actual-desktop-restart-acceptance.json and work/desktop-settings-physical-paths.json, with their probe/install/acceptance scripts. This turn changed actual settings installation and project memory only; no application source, production code or cloud secret changed. The current visibility root cause is proven; that does not establish the cause of every older decrypt-settings report.

Stable constraints:

- MANUAL ONLY; one tray controller and owned model/agent; complete exit must stop all owned processes.
- TWO local slots, port 8081, 2048 context per slot. Existing memory admission remains; do not increase concurrency during this repair.
- Cloudflare owns progress, leases and stored translations. Local files are settings, process identities and diagnostics only. Never reset progress or repeat committed translations.
- Local work completes each of its 22 supported languages in sequence; the other 14 and user-requested website translations retain existing providers.
- Keep current R2, KV, Durable Object, Analytics, fallback and provider-health behavior. No production deployment, resource or remote secret change is part of this repair.
- Preserve existing activation approval/history. Whole-project Pages/GitHub/local parity is still unproven.

Source checkout: Desktop/أبوعبدالرحمن/code/_final/library-web-engine-git-v18, branch task/hymt2-activation, existing PR #11. Retain the previous tested lifecycle repairs; the new finding concerns settings visibility across process contexts. For future diagnosis, read settings and resolve an open file handle from the actual Desktop context before trusting tool-side observations.

Relevant memory entries:

- [Desktop lifecycle and settings visibility bug](active/bugs/BUG-0001-windows-desktop-translation-lifecycle.md)
- [Cloudflare translation architecture](active/decisions/ADR-0001-hymt2-durable-pull.md)

## Recent Handoffs

### 2026-10-16 — Lifecycle tests before the actual Desktop filesystem-view comparison (superseded acceptance scope)

The current task is reliable manual launch from the user's Desktop, one visible tray controller, one local model/agent, full shutdown from the tray and restart from existing Cloudflare progress. User repeatedly saw `decrypt-settings` errors and no icon after closing and reopening. Do not repeat earlier claims that this was conclusively fixed by a delay, Arabic-path encoding or WMI changes: the original historical decryption failure remains unconfirmed. A same-user Explorer-launched settings probe successfully decrypted the existing configuration.

Current local code creates the tray independently of credential loading, retries connection setup without destroying the tray, starts the worker only once, and tracks owned processes using PID plus UTC start ticks, executable name and project path. Existing launcher mutex and explicit stop events coordinate startup/shutdown. Error history is appended without secrets. Windows PowerShell 5.1 atomic-file updates require `[NullString]::Value`; ordinary `$null` caused a separately reproduced replacement failure and is now fixed.

Verified tests: 25 runtime lifecycle checks; 9 dashboard state cases; 20 startup/shutdown checks; tray tests; 72 Node tests. Real Desktop acceptance PASSED through Windows Explorer: three cold starts, two complete exits each followed by 35 seconds of no-orphan/no-restart observation, and 36 seconds of duplicate-click observation with unchanged process identities/logs. Each cold start had one dashboard/launcher/model/agent and a visible tray. Cloud queue completion advanced 441 to 445 and global ready count 95,994 to 95,998; later starts retained those counts. The final cycle was left running. These are observations from the completed test, not permanent current counters. Evidence is in BUG-0001 below.

Stable constraints retained:

- MANUAL ONLY. Do not add Windows login startup or scheduled automatic launch.
- Installed local maximum remains TWO slots, port 8081, context 2048 per slot. Four remains a supported setting, not the selected configuration. An older short benchmark did not establish safe sustained four-way operation. Memory admission may reduce new work; no guarantee of zero impact on other applications.
- Cloudflare owns progress, leases and completed translations. Local files contain connection configuration, process identity and diagnostic/display information only; never reset the cloud ledger or retranslate committed memory.
- Local translation completes one of its 22 supported languages before moving on. The other 14 languages retain existing external providers; user-requested online translation must remain available independently.
- Keep R2, KV, existing Durable Objects, Analytics and fallback/provider-health behavior intact. This desktop repair changes no production Worker, resources or secrets.
- Production activation was previously authorized and completed; do not request general activation/login again. Preserve that history in the archive. Whole-project Pages/GitHub/local parity remains unproven; main is not established as the live Cloudflare baseline.

Source checkout is the user's `Desktop/أبوعبدالرحمن/code/_final/library-web-engine-git-v18`, on `task/hymt2-activation`. Verify actual current files and live state; archived PIDs and counters are historical observations.

The latest shutdown-order code also passed a live exit-during-model-loading test, completed 2026-10-16T18:48:18Z: exit was requested after the model existed but before the agent started; all owned processes stopped and stayed stopped for 12 seconds. A subsequent Desktop start restored exactly one healthy instance of each role and new cloud completion (historical snapshot: completed 493, global ready 96,046, Turkish). Evidence: task `work/final-loading-exit-acceptance.json`.

Next: keep the Desktop checkout and `task/hymt2-activation` on GitHub aligned; the current repair is carried by existing PR #11. Preserve acceptance evidence. If the historical decryption failure recurs, use the appended per-launch diagnostics; its original cause remains unconfirmed despite successful actual Desktop acceptance. Do not promote passing syntax or a direct assistant launch alone to proof of Desktop usability.

Relevant memory entries:

- [Desktop lifecycle bug and evidence](active/bugs/BUG-0001-windows-desktop-translation-lifecycle.md)
- [Cloudflare translation architecture](active/decisions/ADR-0001-hymt2-durable-pull.md)




### 2026-10-16 — Before desktop lifecycle repair

Full prior handoff, including activation approval, language sequencing, previous launcher changes and the superseding two-slot performance decision, is preserved at [the dated archive](archive/environment/2026-10-16-before-desktop-lifecycle-repair.md). Its earlier causal explanations and reported live state are historical, not current proof.
