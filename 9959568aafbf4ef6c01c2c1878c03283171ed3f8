#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const TOOL_VERSION = '1.0.0'
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'ascii')
const DEFAULT_MAX_FILES = 32
const DEFAULT_MAX_TABLES = 256

const sha256 = value => createHash('sha256').update(value).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    : value
const canonicalJson = value => JSON.stringify(canonical(value))
const quoteIdentifier = value => `"${String(value).replaceAll('"', '""')}"`

function inside(root, candidate) {
  const path = resolve(candidate)
  const rel = relative(root, path)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) && resolve(root, rel) !== path) throw new Error('profile_path_outside_project')
  return { path, logicalPath: rel.split(sep).join('/') }
}

async function assertRegularFile(path) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('profile_source_not_regular_file')
  const header = Buffer.alloc(SQLITE_HEADER.length)
  const bytes = await readFile(path)
  bytes.copy(header, 0, 0, SQLITE_HEADER.length)
  if (!header.equals(SQLITE_HEADER)) throw new Error('profile_source_not_sqlite')
  return { stat, sha256: sha256(bytes) }
}

async function collectFiles(projectRoot, inputs, maxFiles) {
  const found = []
  const visit = async candidate => {
    const { path } = inside(projectRoot, candidate)
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error('profile_source_symlink_rejected')
    if (stat.isFile()) {
      if (['.db', '.sqlite', '.sqlite3'].includes(extname(path).toLowerCase())) found.push(path)
      return
    }
    if (!stat.isDirectory()) throw new Error('profile_source_invalid')
    for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (found.length >= maxFiles) break
      if (item.isSymbolicLink()) continue
      await visit(join(path, item.name))
    }
  }
  for (const input of inputs) {
    await visit(resolve(projectRoot, input))
    if (found.length >= maxFiles) break
  }
  return [...new Set(found)].sort().slice(0, maxFiles)
}

function tableTypeProfile(db, table, column) {
  const t = quoteIdentifier(table), c = quoteIdentifier(column)
  const rows = db.prepare(`SELECT typeof(${c}) AS storageType, count(*) AS count, min(CASE WHEN typeof(${c}) IN ('text','blob') THEN length(${c}) END) AS minLength, max(CASE WHEN typeof(${c}) IN ('text','blob') THEN length(${c}) END) AS maxLength FROM ${t} GROUP BY typeof(${c}) ORDER BY storageType`).all()
  return rows.map(row => ({
    storageType: String(row.storageType), count: Number(row.count),
    minLength: row.minLength == null ? null : Number(row.minLength),
    maxLength: row.maxLength == null ? null : Number(row.maxLength),
  }))
}

function profileDatabase(path, logicalPath, source) {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    db.exec('PRAGMA query_only = ON')
    const integrityRows = db.prepare('PRAGMA integrity_check').all()
    const integrity = integrityRows.map(row => String(Object.values(row)[0]))
    if (integrity.length !== 1 || integrity[0] !== 'ok') throw new Error('profile_sqlite_integrity_failed')
    const objects = db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(row => ({
      type: String(row.type), name: String(row.name), sqlSha256: sha256(String(row.sql ?? '')),
    }))
    const tableNames = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => String(row.name))
    if (tableNames.length > DEFAULT_MAX_TABLES) throw new Error('profile_table_limit_exceeded')
    const tables = tableNames.map(name => {
      const ident = quoteIdentifier(name)
      const columns = db.prepare(`PRAGMA table_xinfo(${ident})`).all().map(row => ({
        ordinal: Number(row.cid), name: String(row.name), declaredType: String(row.type ?? ''),
        notNull: Boolean(row.notnull), defaultSql: row.dflt_value == null ? null : String(row.dflt_value),
        primaryKeyOrdinal: Number(row.pk), hidden: Number(row.hidden ?? 0),
      }))
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${ident})`).all().map(row => ({
        id: Number(row.id), sequence: Number(row.seq), referencedTable: String(row.table),
        fromColumn: row.from == null ? null : String(row.from), toColumn: row.to == null ? null : String(row.to),
        onUpdate: String(row.on_update), onDelete: String(row.on_delete), match: String(row.match),
      })).sort((a, b) => a.id - b.id || a.sequence - b.sequence)
      const rowCount = Number(db.prepare(`SELECT count(*) AS count FROM ${ident}`).get().count)
      const typeProfiles = columns.map(column => ({ column: column.name, observations: tableTypeProfile(db, name, column.name) }))
      return { name, rowCount, columns, foreignKeys, typeProfiles }
    })
    const schemaShape = { objects, tables: tables.map(({ name, columns, foreignKeys }) => ({ name, columns, foreignKeys })) }
    return {
      logicalPath, fileName: basename(path), byteLength: source.stat.size, sourceSha256: source.sha256,
      sqlite: {
        userVersion: Number(db.prepare('PRAGMA user_version').get().user_version),
        applicationId: Number(db.prepare('PRAGMA application_id').get().application_id), integrity,
      },
      objects, tables, schemaFingerprint: sha256(canonicalJson(schemaShape)),
      privacy: { sampledValues: false, typeProfilesOnly: true, sqlTextStored: false },
    }
  } finally { db.close() }
}

export async function profileShamelaSqlite({ projectRoot, inputs, maxFiles = DEFAULT_MAX_FILES }) {
  const root = resolve(projectRoot)
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 1000) throw new Error('profile_file_limit_invalid')
  if (!Array.isArray(inputs) || !inputs.length) throw new Error('profile_inputs_required')
  const files = await collectFiles(root, inputs, maxFiles)
  if (!files.length) throw new Error('profile_no_sqlite_files')
  const databases = []
  for (const path of files) {
    const { logicalPath } = inside(root, path)
    const source = await assertRegularFile(path)
    databases.push(profileDatabase(path, logicalPath, source))
  }
  const schemaGroups = new Map()
  for (const database of databases) {
    const group = schemaGroups.get(database.schemaFingerprint) ?? []
    group.push(database.logicalPath); schemaGroups.set(database.schemaFingerprint, group)
  }
  const report = {
    schemaVersion: 1, profiler: { name: 'shamela-sqlite-profiler', version: TOOL_VERSION },
    projectRelativeInputs: inputs.map(input => relative(root, resolve(root, input)).split(sep).join('/')),
    databaseCount: databases.length, schemaCount: schemaGroups.size,
    schemaGroups: [...schemaGroups].sort(([a], [b]) => a.localeCompare(b)).map(([schemaFingerprint, paths]) => ({ schemaFingerprint, databaseCount: paths.length, logicalPaths: paths.sort() })),
    databases,
  }
  return { ...report, reportFingerprint: sha256(canonicalJson(report)) }
}

async function main(argv) {
  const args = [...argv], inputs = []; let output, projectRoot, maxFiles = DEFAULT_MAX_FILES
  while (args.length) {
    const arg = args.shift()
    if (arg === '--project-root') projectRoot = args.shift()
    else if (arg === '--output') output = args.shift()
    else if (arg === '--max-files') maxFiles = Number(args.shift())
    else if (arg?.startsWith('--')) throw new Error(`unknown_option:${arg}`)
    else if (arg) inputs.push(arg)
  }
  if (!projectRoot || !output || !inputs.length) throw new Error('usage: node tools/shamela-sqlite-profiler.mjs --project-root <root> --output <json> [--max-files N] <file-or-directory>...')
  const root = resolve(projectRoot), target = inside(root, resolve(root, output)).path
  const report = await profileShamelaSqlite({ projectRoot: root, inputs, maxFiles })
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8' })
  process.stdout.write(`${JSON.stringify({ output: relative(root, target).split(sep).join('/'), databaseCount: report.databaseCount, schemaCount: report.schemaCount, reportFingerprint: report.reportFingerprint })}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })

