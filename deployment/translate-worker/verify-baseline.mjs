import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const baseline = JSON.parse(await readFile(new URL('./cloudflare-baseline.json', import.meta.url), 'utf8'));
for (const file of baseline.files) {
  const bytes = await readFile(new URL(file.path, import.meta.url));
  const actual = createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual, file.sha256, `${file.path} differs from the verified Cloudflare baseline; review and update the provenance intentionally.`);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
console.log(`Verified ${baseline.worker} v${baseline.versionNumber}: source and configuration match the recorded baseline.`);
