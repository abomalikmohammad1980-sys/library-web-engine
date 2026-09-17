# Independent PDF edition: safe isolated cloud checks

Actual production handler `api/library/book-editions.js` was bundled unchanged into the approved separate test project `khizana-bok-acceptance-20260917`, using only D1 `9133fe99-c4e1-4a1e-84f3-127735883279`. Real short-lived access-session/device cookies were used; `ACCOUNT_TEST_MODE` was absent. Synthetic metadata represented a Word parent and independent PDF edition; no real book or file content was modified.

Eight cloud checks passed:

- Owner attaches their PDF to their private Word parent.
- Repeating the same attachment is idempotent.
- Parent/edition title and edition metadata are returned correctly.
- Another account cannot attach the first owner's PDF.
- Private parent is unavailable to anonymous/other account.
- A private PDF sibling is not listed for anonymous/other account even under a public parent.
- Owner can list that private sibling.
- A non-PDF child cannot be attached as a PDF edition.

Read-only SQL after the test confirmed the original object keys were unchanged. Both synthetic sessions were revoked, and the isolated session count is zero.

Evidence: `.artifacts/bok-cloud-acceptance-20260917/edition-receipt.json`.
Deployment: `https://7f25c616.khizana-bok-acceptance-20260917.pages.dev`.

**Not tested / not claimed:** withdrawal (prior denied action was not retried by browser or HTTP), real Word/PDF upload/object-storage roundtrip, rendered browser UI, production mutation. This closes the safe cloud relation/ownership acceptance subset, not the complete independent-edition lifecycle.
