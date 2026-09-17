import {writeFile,rename} from 'node:fs/promises'
// Reviewed credential parsing and safe diagnostics, isolated from all upload CLIs.
export function safeFailure(e, at) {
  const filesystem = ['EPERM', 'EACCES', 'EBUSY', 'ENOSPC', 'ENOENT', 'EIO', 'ENOTDIR'];
  if (filesystem.includes(e?.code)) return { phase: at, code: `fs_${e.code.toLowerCase()}`, category: 'filesystem' };
  const known = ['usage','limits','config_format','config_duplicate','config_unsupported','config_size','journal_size','journal_invalid','descriptor_pin','term_count','local_path_escape','invalid_job','duplicate_job','local_sha','immutable_remote_mismatch','missing_after_put','fresh_verify_requires_full_budget_and_journal','fresh_verify_mismatch','s3_endpoint','s3_config','s3_key','s3_size','s3_condition','s3_body','s3_timeout','s3_run_timeout','s3_network','s3_closed','stopped'];
  const message = typeof e?.message === 'string' ? e.message : '';
  const code = known.includes(message) || /^s3_http_(400|401|403|404|408|409|412|425|429|500|502|503|504)$/.test(message) ? message : 'unknown';
  const category = code.startsWith('config_') ? 'credential_config' : code.startsWith('s3_') ? 'transport' : code === 'stopped' ? 'cancelled' : 'validation_or_unknown';
  return { phase: at, code, category };
}
// S3 secrets are Sensitive, not IsPassword in rclone v1.75; never guess-decode.
export function parseR2Config(text) {
  if (typeof text !== 'string' || text.length > 1048576 || text.includes('RCLONE_ENCRYPT_')) throw Error('config_format');
  let selected = false, seen = false; const fields = Object.create(null);
  for (const line of text.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) { selected = section[1] === 'r2'; if (selected && seen) throw Error('config_duplicate'); seen ||= selected; continue; }
    if (!selected || /^\s*[#;]/.test(line) || !line.trim()) continue;
    const item = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/); if (!item) throw Error('config_format');
    if (Object.hasOwn(fields, item[1])) throw Error('config_duplicate'); fields[item[1]] = item[2];
  }
  if (!seen || fields.type !== 's3' || fields.provider !== 'Cloudflare' || !fields.access_key_id || !fields.secret_access_key || !/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/.test(fields.endpoint ?? '') || fields.env_auth === 'true' || fields.session_token) throw Error('config_unsupported');
  return { endpoint: fields.endpoint, credentials: { accessKeyId: fields.access_key_id, secretAccessKey: fields.secret_access_key } };
}

export async function journalWriter(path,snapshot){const temporary=`${path}.tmp`;await writeFile(temporary,JSON.stringify(snapshot));await rename(temporary,path)}
