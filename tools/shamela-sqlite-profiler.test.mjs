import { mkdtemp, mkdir, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { profileShamelaSqlite } from './shamela-sqlite-profiler.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'shamela-profiler-')), data = join(root, 'data')
  await mkdir(data)
  const path = join(data, 'sample.db'), db = new DatabaseSync(path)
  db.exec(`
    PRAGMA user_version=7;
    PRAGMA application_id=42;
    CREATE TABLE parent (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
    CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id), body TEXT, payload BLOB);
    CREATE INDEX child_parent ON child(parent_id);
    INSERT INTO parent VALUES (1, 'عنوان سري لا ينبغي أن يظهر');
    INSERT INTO child VALUES (2, 1, 'نص عربي طويل لا ينبغي تسريبه', x'010203');
    INSERT INTO child VALUES (3, 1, NULL, NULL);
  `)
  db.close()
  return { root, path }
}

describe('shamela sqlite profiler', () => {
  it('profiles structure, keys, counts and value types without copying values', async () => {
    const { root } = await fixture()
    const first = await profileShamelaSqlite({ projectRoot: root, inputs: ['data'] })
    const second = await profileShamelaSqlite({ projectRoot: root, inputs: ['data'] })
    assert.equal(first.reportFingerprint, second.reportFingerprint)
    assert.equal(first.databaseCount, 1); assert.equal(first.schemaCount, 1)
    const database = first.databases[0], child = database.tables.find(table => table.name === 'child')
    assert.deepEqual(database.sqlite, { userVersion: 7, applicationId: 42, integrity: ['ok'] })
    assert.equal(child.rowCount, 2)
    assert.equal(child.columns.find(column => column.name === 'id').primaryKeyOrdinal, 1)
    assert.deepEqual(child.foreignKeys[0], { id: 0, sequence: 0, referencedTable: 'parent', fromColumn: 'parent_id', toColumn: 'id', onUpdate: 'NO ACTION', onDelete: 'NO ACTION', match: 'NONE' })
    const bodyTypes = child.typeProfiles.find(profile => profile.column === 'body').observations
    assert.deepEqual(bodyTypes.map(item => ({ storageType: item.storageType, count: item.count })), [{ storageType: 'null', count: 1 }, { storageType: 'text', count: 1 }])
    assert.equal(bodyTypes[1].minLength, bodyTypes[1].maxLength)
    assert.ok(bodyTypes[1].maxLength > 20)
    const serialized = JSON.stringify(first)
    assert.equal(serialized.includes('عنوان سري'), false)
    assert.equal(serialized.includes('نص عربي'), false)
    assert.deepEqual(database.privacy, { sampledValues: false, typeProfilesOnly: true, sqlTextStored: false })
  })

  it('rejects paths outside the project and symlink sources', async () => {
    const { root, path } = await fixture()
    await assert.rejects(profileShamelaSqlite({ projectRoot: join(root, 'data'), inputs: [join(root, '..')] }), /profile_path_outside_project/)
    const link = join(root, 'linked.db')
    try {
      await symlink(path, link)
      await assert.rejects(profileShamelaSqlite({ projectRoot: root, inputs: ['linked.db'] }), /profile_source_symlink_rejected/)
    } catch (error) {
      if (!(error instanceof Error) || !/privilege|operation not permitted|EPERM/i.test(error.message)) throw error
    }
  })

  it('changes the schema fingerprint when structure changes but not when rows change', async () => {
    const { root, path } = await fixture()
    const before = await profileShamelaSqlite({ projectRoot: root, inputs: ['data'] })
    let db = new DatabaseSync(path); db.exec("INSERT INTO parent VALUES (2, 'قيمة أخرى')"); db.close()
    const rowsChanged = await profileShamelaSqlite({ projectRoot: root, inputs: ['data'] })
    assert.equal(rowsChanged.databases[0].schemaFingerprint, before.databases[0].schemaFingerprint)
    db = new DatabaseSync(path); db.exec('ALTER TABLE child ADD COLUMN note TEXT'); db.close()
    const schemaChanged = await profileShamelaSqlite({ projectRoot: root, inputs: ['data'] })
    assert.notEqual(schemaChanged.databases[0].schemaFingerprint, before.databases[0].schemaFingerprint)
  })
})
