// Kayla's dashboard API. Signed-in Identity users with the "admin" role only.
//   GET    /api/leads        → { leads: [...] } newest first
//   PATCH  /api/leads/:id    → { status?, notes? } → { lead }
//   DELETE /api/leads/:id    → { ok: true }  (spam, tests, duplicates)
import type { Config } from '@netlify/functions'
import { getUser } from '@netlify/identity'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.ts'
import { leads, LEAD_STATUSES } from '../../db/schema.ts'

const MAX_NOTES = 5000
const LIST_LIMIT = 2000

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return json(401, { error: 'sign in first' })
  if (!user.roles?.includes('admin')) return json(403, { error: 'this account has no dashboard access' })

  // The session is a cookie, so anything that changes data must come from this site.
  if (req.method !== 'GET') {
    const origin = req.headers.get('origin')
    if (!origin || origin !== new URL(req.url).origin) return json(403, { error: 'forbidden origin' })
  }

  const idPart = new URL(req.url).pathname.split('/')[3]
  if (!idPart) {
    if (req.method !== 'GET') return json(405, { error: 'GET only' })
    const rows = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(LIST_LIMIT)
    return json(200, { leads: rows })
  }

  const id = Number(idPart)
  if (!Number.isInteger(id) || id < 1) return json(404, { error: 'no such lead' })

  if (req.method === 'PATCH') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json(400, { error: 'malformed JSON' })
    }
    const set: { status?: string; notes?: string; updatedAt: Date } = { updatedAt: new Date() }
    if (body.status !== undefined) {
      if (!LEAD_STATUSES.includes(body.status as never)) return json(422, { error: 'unknown status' })
      set.status = body.status as string
    }
    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') return json(422, { error: 'notes must be text' })
      set.notes = body.notes.slice(0, MAX_NOTES)
    }
    const [row] = await db.update(leads).set(set).where(eq(leads.id, id)).returning()
    return row ? json(200, { lead: row }) : json(404, { error: 'no such lead' })
  }

  if (req.method === 'DELETE') {
    const [row] = await db.delete(leads).where(eq(leads.id, id)).returning({ id: leads.id })
    return row ? json(200, { ok: true }) : json(404, { error: 'no such lead' })
  }

  return json(405, { error: 'method not allowed' })
}

export const config: Config = {
  path: ['/api/leads', '/api/leads/:id'],
}
