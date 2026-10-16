# Project Memory Index

Updated: 2026-10-16

This file is a bounded routing layer. Do not put long memory content here.

## Active Entries

<!-- Keep active entries <= 50. Current active entries: 2. -->

- id: ADR-0001-hymt2-durable-pull
  path: project_memory/active/decisions/ADR-0001-hymt2-durable-pull.md
  title: Hy-MT2 durable local pull translation
  level: P1
  status: active
  tags: [translation, cloudflare, r2, local-agent, windows]
  use_when: Editing local translation routing, persistence, startup or activation

- id: BUG-0001-windows-desktop-translation-lifecycle
  path: project_memory/active/bugs/BUG-0001-windows-desktop-translation-lifecycle.md
  title: Windows desktop translation startup and full shutdown lifecycle
  level: P1
  status: active
  tags: [translation, windows, powershell, desktop, tray, lifecycle, credentials]
  use_when: Diagnosing Desktop launch failures, missing tray, duplicate workers, full shutdown or process ownership

## Pinned Entries

<!-- Keep pinned entries <= 10. -->

## Recent Entries

- 2026-10-16: Desktop lifecycle acceptance passed three real Explorer starts and two full exits; original historical decryption cause remains unconfirmed. See BUG-0001.
- 2026-10-16: Prior full handoff preserved in archive/environment/2026-10-16-before-desktop-lifecycle-repair.md.
