# Tafsir batch25 publication

- Production: https://khzanah.com
- Deployment: de450476-a33d-413b-a3b0-0d3aabeea7b7
- Immutable URL: https://de450476.khezana.pages.dev
- Version: batch-20260916-25
- Baseline: batch24 / 11db8ddb-32c5-4635-9b3b-a0a414d1d1ea
- Deployment fingerprint: 2d0e72643e817f0d6b96069371a6a20def44d0d7123c07b911b1f35183b8a1ac

Published the six reviewed additions (Abu Saud, al-Durr al-Masun, Nazm al-Durar, al-Mawardi, Ibn al-Arabi Ahkam, al-Tarifi) and targeted corrections. Frozen batch24 source plus seven reviewed overrides; twelve new data files; unchanged server functions and unrelated data. No database migrations. SEO/History API work is not included.

Local and live integrity checks passed for 684 surah partitions / 25,066 records and all twelve overlay files. Live Range checks passed for all six packs. Entry/lazy assets, service worker, search bootstrap and anonymous account/admin API responses passed. These are not claims of a full regression suite or subsecond search acceptance.

25,056 library destinations validated. Ten exceptions explicitly accepted by the user retain commentary without active reader links: Mawardi 3:152, 26:55, 26:61, 34:16, 37:70, 37:162, 82:2; Durr 3:163, 9:11, 9:82.

Live Chrome smoke checks confirmed all six additions in the 35-entry chronological selector, Mawardi 3:152 commentary with zero links, and Nazm al-Durar 3:152 commentary with a reader link. Selective tafsirs are not represented as complete verse-by-verse commentaries.

Evidence: `.artifacts/batch25/{stage,local-verification,production-verification,production-browser,deployment,rollback,source-snapshot}.json`. Operational pointer: `alpha-publish/ops/current-production.json`. Retained batch24 artifacts remain available for rollback.

GitHub push remains a separate access problem; no successful push is claimed by this receipt.
