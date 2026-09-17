import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateDataReleaseOverlay(value) {
  if (!value || value.contract !== 'alkhizana-pages-client/1' || !/^[a-f0-9]{24}$/.test(value.releaseId ?? ''))
    throw new Error('data_release_overlay_header_invalid')
  if (!Array.isArray(value.projects) || value.projects.length < 2) throw new Error('data_release_overlay_projects_missing')
  const names = new Set(), groups = new Set()
  const projects = value.projects.map(project => {
    if (!project || typeof project.name !== 'string' || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(project.name))
      throw new Error('data_release_overlay_project_name_invalid')
    if (names.has(project.name)) throw new Error('data_release_overlay_project_duplicate')
    names.add(project.name)
    if (project.group !== 'corpus' && project.group !== 'search') throw new Error('data_release_overlay_group_invalid')
    groups.add(project.group)
    let url
    try { url = new URL(project.baseUrl) } catch { throw new Error('data_release_overlay_base_url_invalid') }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw new Error('data_release_overlay_base_url_invalid')
    return { name: project.name, group: project.group, baseUrl: url.origin }
  })
  if (!groups.has('corpus') || !groups.has('search')) throw new Error('data_release_overlay_group_missing')
  return { contract: 'alkhizana-pages-client/1', releaseId: value.releaseId, projects }
}

export function overlayFromEnvironment(environment = process.env) {
  const raw = environment.KHIZANA_DATA_RELEASE_OVERLAY
  if (!raw) throw new Error('data_release_overlay_required')
  try { return validateDataReleaseOverlay(JSON.parse(raw)) }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error('data_release_overlay_json_invalid')
    throw error
  }
}

export async function writeDataReleaseOverlay(root, value) {
  const config = validateDataReleaseOverlay(value)
  const target = resolve(root, 'pages-dist/data/shamela-pages-release.json')
  const temporary = `${target}.tmp`
  await mkdir(dirname(target), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  await rename(temporary, target)
  return { target, config }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const { target, config } = await writeDataReleaseOverlay(root, overlayFromEnvironment())
  console.log(`Data release overlay ready: ${target}, ${config.projects.length} projects`)
}
