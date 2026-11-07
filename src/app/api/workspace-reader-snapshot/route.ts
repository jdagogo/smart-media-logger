import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
export const runtime = 'nodejs'
const keys = new Set(['smartMediaLogger_draft', 'smartMediaLogger_queue', 'smartMediaLogger_logged',
  'smartMediaLogger_theaters', 'smartMediaLogger_preferences', 'smartMediaLogger_savedMusic',
  'smartMediaLogger_dismissedRecs', 'smartMediaLogger_interactions'])
export async function POST(request: Request) {
  const origin = request.headers.get('origin') || ''
  if (!['http://localhost:3006', 'http://127.0.0.1:3006'].includes(origin) ||
      request.headers.get('host') !== new URL(origin).host ||
      request.headers.get('x-workspace-reader') !== 'local-sml-v1' ||
      request.headers.get('content-type') !== 'application/json') return Response.json({ error: 'Local SML only' }, { status: 403 })
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) return Response.json({ error: 'Read mirror limit exceeded' }, { status: 413 })
  let data: Record<string, unknown>
  try {
    const payload = JSON.parse(raw)
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw Error()
    data = Object.create(null)
    for (const [key, value] of Object.entries(payload.data)) {
      if (!keys.has(key) && !/^(hero_pinned_|soundtrack_overrides_)[a-z0-9_ -]{1,180}$/.test(key)) throw Error()
      data[key] = value
    }
  } catch { return Response.json({ error: 'Invalid SML data' }, { status: 400 }) }
  const root = process.env.WORKSPACE_READER_SNAPSHOT_DIR || path.join(os.homedir(), 'Documents/ChatGPT/UnitedVibes Duo/workspace-reader-20261106/private/sml')
  await fs.mkdir(root, { recursive: true, mode: 0o700 })
  const filename = createHash('sha256').update(origin).digest('hex') + '.json'
  const temporary = path.join(root, '.' + randomUUID() + '.tmp')
  await fs.writeFile(temporary, JSON.stringify({ schemaVersion: 1, origin, observedAt: new Date().toISOString(), data }), { mode: 0o600, flag: 'wx' })
  await fs.rename(temporary, path.join(root, filename))
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
