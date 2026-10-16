---
id: BUG-0001
title: Windows desktop translation startup and full shutdown lifecycle
status: active
level: P1
date: 2026-10-16
tags: [translation, windows, powershell, desktop, tray, lifecycle, credentials]
use_when: Diagnosing Desktop launch failures, missing tray, duplicate workers, full shutdown or process ownership
---

## Symptoms and evidence limits

The user repeatedly closed the local translator fully and reopened the Desktop command, then received `settings-worker-url.txt`, `read-url` or `decrypt-settings` dialogs and no tray icon. Assistant-launched checks often succeeded, which did not prove the user's Desktop cycle worked. Previous delay, path-encoding and WMI explanations were not established causes of the historical credential failure and are superseded as conclusive diagnoses.

A same-user Windows Explorer settings probe successfully read/decrypted existing settings. PowerShell scripts already had UTF-8 BOM and the Desktop command used an ASCII encoded command. DPAPI credentials are user-bound, but a different Windows user versus the interactive Desktop was not established as the historical fault. The original intermittent decryption failure remains unconfirmed; preserve per-launch diagnostics rather than overwriting failures with a later successful check. Do not delete or recreate credentials as an unproven workaround.

## Confirmed defects and changes

1. Dashboard created `NotifyIcon` only after credential initialization. Any credential failure necessarily exited with a popup and no control icon. Tray creation now precedes retryable connection setup, so the application remains visible and can be closed even during connection failure.
2. While desired running, Dashboard spawned a launcher every 30 seconds without first respecting the worker mutex or its existing child handle. Those rejected children could still interfere with log redirection. The controller now checks mutex and child lifetime before starting and disposes exited child handles before replacement.
3. Process discovery and shutdown depended on CIM and swallowed stop errors. Runtime identity markers contain role, PID, UTC start ticks, executable name and canonical script directory. A live handle is pinned during validation; stopping uses that verified process object. Reused/mismatched PIDs or another project cannot be stopped through a stale marker. Full shutdown verifies all owned roles stopped and leaves the tray open if shutdown is incomplete.
4. In Windows PowerShell, an array containing an explicitly returned null has count one. Counting the unfiltered Runtime result incorrectly reported an absent worker as running. Actual state-updater tests reproduced this; wrappers now emit only a live process, and polling disposes process handles.
5. Repeated status polling leaked process handles. State polling, runtime snapshots, shutdown and launcher replacement now dispose acquired handles. Local identity files never act as translation checkpoints.
6. Safe JSONL diagnostics append startup stage, time, process/session/user identity, settings location and bounded error metadata. They contain no raw exception messages, credentials, headers or request payloads. FullyQualifiedErrorId can contain a thrown secret, so diagnostics use the fixed error-category enum instead. A successful check no longer erases earlier errors; an unwritable settings directory falls back to the user's temporary directory.
7. During the new implementation, Windows PowerShell 5.1 marshalled ordinary null to an empty string in the three-argument File.Replace overload. Updating an existing runtime marker failed with an invalid-path exception (HResult -2147024809). `[NullString]::Value` passes a real null backup path. A repeat-registration test first reproduced failure, then passed with no temporary-file debris after correction.
8. The shutdown fallback must stop a stalled launcher before the final agent/model sweep, because an active launcher could otherwise spawn a child after its role was already inspected. The verified launcher or cached launcher handle is now stopped first. Controlled startup/shutdown tests exercise both registered and marker-unavailable fallback paths without signalling the actual translator.

## Invariants

Launch is manual. Existing settings, two slots on port 8081 and the tested model remain. Cloudflare is the authoritative progress/lease/memory source. Existing translations are not cleared. This desktop lifecycle repair performs no production deployment and changes no Cloudflare resources or secrets. Generic healthy-loopback responses and stale PIDs are not sufficient evidence of an owned model.

## Verification evidence

Current implementation sources:

- `deployment/translate-worker/local-agent/Runtime.ps1`
- `deployment/translate-worker/local-agent/Dashboard.ps1`
- `deployment/translate-worker/local-agent/Start-Translation.ps1`
- Desktop `Khzanah-Translate.cmd` and the corresponding project launcher entrypoints

Automated evidence from Windows PowerShell 5.1:

- `test/runtime-lifecycle.ps1`: 25 checks passed. Tests use isolated settings, named test mutexes and harmless hidden PowerShell sleepers; verify PID/start/name/root identity, repeat registration, safe stopping, append-only redacted diagnostics and no temporary-file debris.
- `test/dashboard-state.ps1`: 9 cases passed, including the actual null-process bug, single-process state, loading state and handle disposal.
- `test/dashboard-startup.ps1`: 20 checks passed, extracting actual lifecycle functions with controlled substitutes; no real credentials, network or translator process. Tests cover duplicate prevention, restart, failed credential recovery, retry pacing and stopping a stalled launcher before the final child sweep. Only the OS stop-event name is isolated to prevent the test from signalling a real translator.
- Existing tray checks and all 72 Node tests passed in this task.

Live evidence is under the task workspace `C:/Users/yahya/Documents/Codex/2026-10-15/referenced-chatgpt-conversation-this-is-an-2/work/`:

- `desktop-settings-probe.ps1` / `desktop-settings-probe.json`: same-user Explorer settings access/decryption probe.
- `verify-desktop-restart.ps1`: real Explorer restart acceptance harness.
- `desktop-restart-acceptance.json`: final `success` true, finished 2026-10-16T18:38:58Z. This is the completed real Desktop/Explorer exercise, using the same close handler as the tray through the named exit signal.
- `final-loading-exit-acceptance.json`: final `success` true, finished 2026-10-16T18:48:18Z, on the latest shutdown-order code. Exit requested after model creation but before agent startup stopped all owned processes; 12 seconds of observation found no resurrection. The following Desktop cold start restored exactly one healthy instance of each role and new Cloudflare completion (historical final snapshot: completed 493, global ready 96,046, Turkish).
- `tray-settings-fixture/dashboard-runtime.json`: isolated missing-credential fixture. The parent observed an icon retained with `decrypt-settings`, then signalled exit successfully. This file is rewritten on exit; the current final snapshot has the icon hidden and desired running false, so the final file alone is not proof of the earlier visible icon.

Completed live acceptance: three Explorer-launched cold starts; each reached one dashboard, launcher, model and agent with a visible tray and healthy model. Two full exits released the model port and left no known owned processes for 35 seconds of observation each. Repeated Desktop clicks were observed for 36 seconds with no new process identities or log replacement. New Cloudflare completion was observed from queue completed 441 to 445 and global ready 95,994 to 95,998; the later starts retained progress. The final third instance remained running. These observations establish the tested restart workflow; they do not retrospectively prove the cause of every historical user error.

## Follow-up and limits

The completed live runs exercised normal full shutdown and exit during model loading on the latest code; fallback-order hardening also has controlled startup/shutdown coverage. The repair is carried by existing PR #11; keep the Desktop checkout and `task/hymt2-activation` aligned. If the original decryption error recurs, correlate its appended per-launch identity/settings/error metadata with the successful probe; its historical root cause is still unconfirmed. Do not repeat unsupported sleep/path/WMI diagnoses or ask the user to repeat blind retries. Keep manual launch, Cloudflare-backed progress and safe ownership checks in future edits.
