# Khzanah cloud translation supervisor (staged, not deployed)

This runs as a scheduled GitHub Actions job in the public `library-web-engine` repository. GitHub runs the short supervisor check while the user's laptop is off. The existing Cloudflare Worker remains the durable translation queue and Telegram stall notifier; Kaggle performs the actual inference. No model or Kaggle credentials are committed to GitHub. The two notebook templates deliberately contain `SOURCES = {}`; at run time the supervisor pulls the private live notebook from Kaggle and copies its current agent sources into the reviewed GPU or CPU shell.

## Activation

1. Copy `supervisor.py`, `notify.py`, `test_supervisor.py`, and `templates/` to `deployment/translation-supervisor/` on a review branch. Copy `khzanah-supervisor.yml` to `.github/workflows/`. Review and merge the branch. The workflow remains dormant on its schedule until the repository variable below is enabled.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add three repository secrets: `KAGGLE_API_TOKEN` from [Kaggle API settings](https://www.kaggle.com/settings/api), plus the existing `TELEGRAM_STATUS_BOT_TOKEN` and `TELEGRAM_STATUS_CHAT_ID` values from their secure stores. Never paste values into a commit, issue, chat, or log.
3. From GitHub **Actions → Khzanah free translation supervisor → Run workflow**, run with **dry_run=true**. Verify the result reports the current Kaggle version, free GPU hours, and a decision without making a change. Then set repository variable `SUPERVISOR_ENABLED=true`; the cloud schedule checks every five minutes, subject to GitHub's scheduling delays.

## Behavior and boundaries

- Active/queued Kaggle sessions are never duplicated. A terminal session with unfinished Hy-MT2 work starts one free GPU run if at least 15 minutes of free GPU quota remain, otherwise one CPU run. The private notebook is pulled again before push; live runtime changes that do not match the reviewed templates block the action. The CPU shell adds a 12-minute accepted-progress guard so a stuck CPU run exits instead of wasting its whole session.
- During a CPU run, restored GPU quota requests CPU cancellation. The next scheduled check starts GPU only after Kaggle reports a terminal state. Kaggle previously returned HTTP 403 for cancellation; if it does so again, the job alerts for a manual **Stop Session** and does not launch a concurrent GPU run.
- Unknown Kaggle errors or no-progress errors are classified and surfaced, without an endless retry loop. The existing Cloudflare Worker sends its own stall alert. The GitHub workflow sends one generic Telegram action alert per Kaggle version using Actions cache; a failed cache write may lead to a duplicate alert.
- This supervisor handles the 22 Hy-MT2 languages. It observes all 36 via Cloudflare `/api/translate/automatic` and stops starting Kaggle once all 22 are complete. It does not change the other 14 languages' providers, deploy Cloudflare Worker/Pages, change validation, or enable paid services.
- This is a scheduled cloud job, not a guaranteed uninterrupted server. GitHub may delay or drop a scheduled run, and public-repository schedules can be disabled after long inactivity. Kaggle sessions have their own time and quota limits. The existing local Codex heartbeat should remain as backup until the cloud job has been proven, then be disabled to avoid competing Kaggle actions.

## Validation completed locally

Python syntax, YAML parsing, six decision/template tests, exact rendering parity with the reviewed GPU notebook, and CPU template syntax including its new progress guard. A real GitHub Actions run, non-interactive Kaggle token authentication, Kaggle cancellation, and live CPU throughput remain unverified.
