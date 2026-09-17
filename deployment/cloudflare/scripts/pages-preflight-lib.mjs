export function validatePagesConfig(text) {
  const name = text.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
  const output = text.match(/^pages_build_output_dir\s*=\s*"([^"]+)"/m)?.[1]
  const compatibilityDate = text.match(/^compatibility_date\s*=\s*"([^"]+)"/m)?.[1]
  if (name !== 'khezana') throw new Error(`pages_project_name_drift:${name ?? 'missing'}`)
  if (output !== './pages-dist') throw new Error(`pages_output_drift:${output ?? 'missing'}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate ?? '')) throw new Error('pages_compatibility_date_missing')
  if (!/^\[ai\]\s*$[\s\S]*?^binding\s*=\s*"AI"\s*$/m.test(text)) throw new Error('workers_ai_binding_missing')
  const d1Block = text.match(/^\[\[d1_databases\]\]\s*\r?\n((?:(?!^\[)[\s\S])*)/m)?.[1] ?? ''
  const d1Binding = d1Block.match(/^binding\s*=\s*"([^"]+)"/m)?.[1]
  const d1Name = d1Block.match(/^database_name\s*=\s*"([^"]+)"/m)?.[1]
  const d1Id = d1Block.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1]
  if (d1Binding !== 'VISITORS_DB') throw new Error('visitors_d1_binding_missing')
  if (d1Name !== 'khezana-visitors') throw new Error('visitors_d1_database_name_drift')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d1Id ?? '')) throw new Error('visitors_d1_database_id_missing')
  return { name, output, compatibilityDate, d1Binding, d1Name, d1Id }
}

export function parseWranglerAuthentication(stdout, stderr = '') {
  const combined = `${stdout}\n${stderr}`
  if (/You are not authenticated|wrangler login/i.test(combined)) return { authenticated: false, blocker: 'cloudflare_authentication_required' }
  if (/You are logged in|Account ID|account name/i.test(combined)) return { authenticated: true }
  return { authenticated: false, blocker: 'cloudflare_authentication_unconfirmed' }
}
