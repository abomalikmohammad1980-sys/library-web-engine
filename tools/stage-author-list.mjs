import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { isGeneralOrAmbiguousIdentity, matchCatalogAuthor, parseRequestedAuthor } from './author-staging-lib.mjs'

const root = path.resolve(import.meta.dirname, '..')
const inputPath = process.argv[2]
if (!inputPath) throw new Error('usage: node tools/stage-author-list.mjs <pasted-text.txt>')
const researchedAt = '2026-08-08'
const [input, catalogPayload, supplementPayload] = await Promise.all([
  readFile(inputPath, 'utf8'),
  readFile(path.join(root, 'app/public/data/shamela-authors.json'), 'utf8').then(JSON.parse),
  readFile(path.join(root, 'tools/data/author-research-high-confidence.json'), 'utf8').then(JSON.parse),
])
const requested = input.split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(parseRequestedAuthor)
const supplementByIdentity = new Map()
for (const author of supplementPayload.authors) for (const name of [author.name, ...(author.aliases ?? [])]) supplementByIdentity.set(name.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim(), author)
const normalizeKey = value => value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim()

const records = requested.map(request => {
  const match = matchCatalogAuthor(request, catalogPayload.authors)
  if (match.kind === 'existing') return {
    input: request.raw, canonical: match.author.name, aliases: [...new Set([...(match.author.aliases ?? []), ...request.aliases])],
    birthYearHijri: match.author.birthYearHijri ?? null, deathYearHijri: match.author.deathYearHijri ?? null,
    contemporary: match.author.contemporary ?? null, briefBiography: null,
    sources: match.author.sourceUrl ? [{ url: match.author.sourceUrl, accessedAt: catalogPayload.fetchedAt.slice(0, 10) }] : [],
    confidence: 'high', disposition: 'existing', matchMethod: match.method, existingId: match.author.id,
  }
  if (match.kind === 'review') return {
    input: request.raw, canonical: request.canonical, aliases: request.aliases, birthYearHijri: null, deathYearHijri: null,
    contemporary: null, briefBiography: null, sources: [], confidence: 'low', disposition: 'review', reason: match.reason,
    possibleExistingIds: match.matches.map(item => item.id),
  }
  const curated = [request.canonical, ...request.aliases].map(value => supplementByIdentity.get(normalizeKey(value))).find(Boolean)
  if (curated) return {
    input: request.raw, canonical: curated.name, aliases: curated.aliases, birthYearHijri: curated.birthYearHijri ?? null,
    deathYearHijri: curated.deathYearHijri ?? null, contemporary: curated.contemporary ?? null,
    briefBiography: curated.biography ?? null, sources: curated.sources, confidence: 'high', disposition: 'add', supplementId: curated.id,
  }
  const review = isGeneralOrAmbiguousIdentity(request)
  return {
    input: request.raw, canonical: request.canonical, aliases: request.aliases, birthYearHijri: null, deathYearHijri: null,
    contemporary: null, briefBiography: null, sources: [], confidence: 'low', disposition: review ? 'review' : 'unresolved',
    reason: review ? 'general-or-kunya-only-identity' : 'no-authoritative-source-confirmed',
  }
})
const canonicalCounts = new Map()
for (const record of records) canonicalCounts.set(normalizeKey(record.canonical), (canonicalCounts.get(normalizeKey(record.canonical)) ?? 0) + 1)
for (const record of records) if (record.disposition !== 'existing' && canonicalCounts.get(normalizeKey(record.canonical)) > 1) record.canonical = record.input
const counts = { total: records.length, existing: records.filter(item => item.disposition === 'existing').length, added: records.filter(item => item.disposition === 'add').length, review: records.filter(item => item.disposition === 'review').length, unresolved: records.filter(item => item.disposition === 'unresolved').length }
const stableId = value => {
  let hash = 2166136261
  for (const character of normalizeKey(value)) { hash ^= character.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) }
  return `supplement-${(hash >>> 0).toString(36)}`
}
const supplementAuthors = records.filter(item => item.disposition !== 'existing').map(item => ({
  id: item.supplementId ?? stableId(item.canonical), name: item.canonical, aliases: item.aliases,
  ...(item.birthYearHijri !== null ? { birthYearHijri: item.birthYearHijri } : {}),
  ...(item.deathYearHijri !== null ? { deathYearHijri: item.deathYearHijri } : {}),
  ...(item.contemporary !== null ? { contemporary: item.contemporary } : {}),
  ...(item.briefBiography ? { biography: item.briefBiography } : {}),
  researchSources: item.sources, metadataConfidence: item.confidence === 'high' ? 'high' : item.disposition,
  researchStatus: item.confidence === 'high' ? 'verified' : item.disposition,
}))
const outputDir = path.join(root, 'docs/data')
await mkdir(outputDir, { recursive: true })
const stagingJson = JSON.stringify({ schemaVersion: 1, researchedAt, inputFile: path.basename(inputPath), counts, records }, null, 2) + '\n'
const stagingChecksum = createHash('sha256').update(stagingJson).digest('hex').toUpperCase()
await writeFile(path.join(outputDir, 'author-candidates-2026-08-08.json'), stagingJson, 'utf8')
await writeFile(path.join(root, 'app/public/data/author-supplement.json'), JSON.stringify({ schemaVersion: 1, researchedAt, authors: supplementAuthors }, null, 2) + '\n', 'utf8')
const additions = records.filter(item => item.disposition === 'add')
const report = `# تقرير استيراد قائمة المؤلفين — ${researchedAt}\n\n## الحصيلة\n\n- الإجمالي: ${counts.total}\n- موجود: ${counts.existing}\n- مضاف كسجل اسمي: ${counts.added + counts.review + counts.unresolved}\n- منه عالي الثقة: ${counts.added}\n- موسوم لمراجعة الهوية: ${counts.review}\n- موسوم غير محسوم: ${counts.unresolved}\n\n## سياسة الدمج\n\nلم تُملأ التواريخ أو التراجم المجهولة بالتخمين. تضاف كل هوية غير موجودة كسجل اسمي أدنى؛ الأسماء العامة والكنى المشتركة موسومة \`review\` والبقية غير الموثقة \`unresolved\`. السجلات الثلاثة الموثقة وحدها \`verified/high\` وبها روابط HTTPS وتاريخ اطلاع. يطابق النظام الاسم المعياري والبدائل والكنى، ثم يسمح باحتواء الكلمات المرتبة إذا كانت النتيجة فريدة فقط. «سعيد حوى» مصنف موجودًا ولم يُضف ثانية.\n\nإعادة تشغيل الأداة على المدخل نفسه حتمية؛ البصمة المثبتة لملف staging هي \`${stagingChecksum}\`.\n\n## السجلات الجديدة عالية الثقة\n\n${additions.map(item => `- **${item.canonical}**${item.aliases.length ? ` — البدائل: ${item.aliases.join('، ')}` : ''}. المصادر: ${item.sources.map(source => `${source.url} (اطلاع ${source.accessedAt})`).join('؛ ')}`).join('\n')}\n\n## المراجعة\n\nملف \`author-candidates-2026-08-08.json\` هو المصدر الكامل. دخلت السجلات ${counts.review + counts.unresolved} الاسمية غير الموثقة بلا تواريخ أو تراجم أو مصادر مختلقة، مع \`researchStatus\` صريح لتدقيقها لاحقًا.\n`
await writeFile(path.join(outputDir, 'author-import-report-2026-08-08.md'), report, 'utf8')
console.log(JSON.stringify(counts))
