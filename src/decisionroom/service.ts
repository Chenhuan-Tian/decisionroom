import type { ActionTools } from 'deepspace/worker'
import { DomainError, ensure, text, safeUrl, inputSignature, parseComparison } from './domain.ts'
import type { Evidence, Invitation, Member, Room, Row, Snapshot } from './domain.ts'
import { SEARCH_ENDPOINT, COMPLETION_ENDPOINT, MODEL, COMPARISON_PROMPT } from './integrations.ts'

type Context = { userId: string; params: Record<string, unknown>; tools: ActionTools }
type Handler = (ctx: Context) => Promise<unknown>
const ok = <T>(result: { success: true; data: T } | { success: false; error: string }): T => {
  if (!result.success) throw new DomainError(result.error)
  return result.data
}
async function get<T extends Record<string, unknown>>(tools: ActionTools, collection: string, id: string): Promise<Row<T>> {
  return ok(await tools.get<T>(collection, id)).record as Row<T>
}
async function list<T extends Record<string, unknown>>(tools: ActionTools, collection: string, teamId: string): Promise<Row<T>[]> {
  return ok(await tools.query<T>(collection, { where: { teamId }, limit: 100 })).records as Row<T>[]
}
function roomId(params: Record<string, unknown>): string {
  const id = text(params.roomId, 'Room ID', 80)
  ensure(/^[a-f0-9-]{36}$/.test(id), 'Invalid room ID.')
  return id
}
async function roomAccess(ctx: Context, host = false, open = false): Promise<Row<Room>> {
  const id = roomId(ctx.params)
  const membership = await list<Member>(ctx.tools, 'team_members', id)
  ensure(membership.some(m => m.data.userId === ctx.userId && m.data.status === 'active'), 'Room not found or access denied.')
  const room = await get<Room>(ctx.tools, 'rooms', id)
  if (host) ensure(room.data.ownerId === ctx.userId, 'Only the host can do that.')
  if (open) ensure(room.data.status === 'open', 'This decision is closed. Its evidence and votes are frozen.')
  return room
}
async function digest(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('')
}

const handlers: Record<string, Handler> = {
  async createRoom(ctx) {
    const id = roomId(ctx.params)
    const question = text(ctx.params.question, 'Question', 180)
    const constraints = text(ctx.params.constraints ?? '', 'Constraints', 1200, true)
    ensure(Array.isArray(ctx.params.options) && ctx.params.options.length >= 2 && ctx.params.options.length <= 3, 'Choose two or three options.')
    const names = ctx.params.options.map(n => text(n, 'Option', 80))
    ensure(new Set(names.map(n => n.toLowerCase())).size === names.length, 'Option names must be distinct.')
    const own = ok(await ctx.tools.query<Room>('rooms', { where: { ownerId: ctx.userId }, limit: 10 })).records
    if (!own.some(r => r.recordId === id)) ensure(own.length < 5, 'This evaluation build allows five rooms per account.')
    else return { roomId: id }
    // Register the host first; a failed room create is retryable at the same ID.
    ok(await ctx.tools.create('team_members', { teamId: id, userId: ctx.userId, status: 'active', displayName: text(ctx.params.displayName ?? 'Host', 'Name', 80) }, `${id}:${ctx.userId}`))
    const data: Room = { teamId: id, ownerId: ctx.userId, question, constraints,
      options: names.map((name, i) => ({ id: `option-${i + 1}`, name })), status: 'open', decision: '', rationale: '', decidedAt: '', snapshotId: '' }
    ok(await ctx.tools.create('rooms', data, id))
    return { roomId: id }
  },
  async invite(ctx) {
    const room = await roomAccess(ctx, true, true)
    const token = crypto.randomUUID() + crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString()
    ok(await ctx.tools.create('invitations', { teamId: room.recordId, tokenHash: await digest(token), expiresAt }, room.recordId))
    return { token, expiresAt }
  },
  async join(ctx) {
    const id = roomId(ctx.params)
    const token = text(ctx.params.token, 'Invitation', 100)
    const inv = await get<Invitation>(ctx.tools, 'invitations', id)
    ensure(inv.data.teamId === id && inv.data.tokenHash === await digest(token) && Date.parse(inv.data.expiresAt) > Date.now(), 'This invitation is invalid or expired. Ask the host for a new one.')
    const room = await get<Room>(ctx.tools, 'rooms', id)
    ensure(room.data.status === 'open', 'This decision is already closed.')
    const members = await list<Member>(ctx.tools, 'team_members', id)
    ensure(members.some(m => m.data.userId === ctx.userId) || members.length < 10, 'This room has reached its ten-member limit.')
    ok(await ctx.tools.create('team_members', { teamId: id, userId: ctx.userId, status: 'active', displayName: text(ctx.params.displayName ?? 'Member', 'Name', 80) }, `${id}:${ctx.userId}`))
    return { roomId: id }
  },
  async addEvidence(ctx) {
    const room = await roomAccess(ctx, false, true)
    const evidence = await list<Evidence>(ctx.tools, 'evidence', room.recordId)
    const requestId = text(ctx.params.requestId, 'Request ID', 80)
    ensure(/^[a-f0-9-]{36}$/.test(requestId), 'Invalid request ID.')
    const id = `${room.recordId}:${requestId}`
    if (evidence.some(e => e.recordId === id)) return { recordId: id }
    ensure(evidence.length < 10, 'A room can contain up to ten evidence cards. Remove one before adding another.')
    const optionId = text(ctx.params.optionId, 'Option', 80)
    ensure(optionId === 'all' || room.data.options.some(o => o.id === optionId), 'Unknown option.')
    const url = safeUrl(ctx.params.url)
    ensure(!evidence.some(e => e.data.url === url && e.data.optionId === optionId), 'This source is already saved for this option.')
    return ok(await ctx.tools.create('evidence', { teamId: room.recordId, optionId, url,
      title: text(ctx.params.title, 'Title', 180), note: text(ctx.params.note, 'Evidence note', 2000) }, id))
  },
  async removeEvidence(ctx) {
    const room = await roomAccess(ctx, false, true)
    const id = text(ctx.params.evidenceId, 'Evidence', 150)
    const evidence = await get<Evidence>(ctx.tools, 'evidence', id)
    ensure(evidence.data.teamId === room.recordId && (evidence.createdBy === ctx.userId || room.data.ownerId === ctx.userId), 'Only the author or host can remove this evidence.')
    return ok(await ctx.tools.remove('evidence', id))
  },
  async vote(ctx) {
    const room = await roomAccess(ctx, false, true)
    const optionId = text(ctx.params.optionId, 'Option', 80)
    ensure(room.data.options.some(o => o.id === optionId), 'Unknown option.')
    return ok(await ctx.tools.create('votes', { teamId: room.recordId, userId: ctx.userId, optionId,
      reason: text(ctx.params.reason ?? '', 'Reason', 500, true) }, `${room.recordId}:${ctx.userId}`))
  },
  async search(ctx) {
    const room = await roomAccess(ctx, true, true)
    const query = text(ctx.params.query, 'Search', 250)
    const result = await ctx.tools.integration<{ results: { title?: string; url?: string; text?: string; highlights?: string[] }[] }>(SEARCH_ENDPOINT, { query, numResults: 5, contents: { text: { maxCharacters: 1600 } } })
    if (!result.success) throw new DomainError('Search is unavailable. You can retry or add a source URL manually.')
    ensure(Array.isArray(result.data?.results), 'Search returned an unexpected response. Add a source manually or retry.')
    return { results: result.data.results.slice(0, 5).flatMap(r => {
      try { return [{ title: (r.title ?? 'Untitled source').slice(0, 180), url: safeUrl(r.url), note: (r.text ?? r.highlights?.join(' ') ?? '').slice(0, 1600) }] } catch { return [] }
    }) }
  },
  async compare(ctx) {
    const room = await roomAccess(ctx, true, true)
    const evidence = await list<Evidence>(ctx.tools, 'evidence', room.recordId)
    ensure(evidence.length > 0, 'Save at least one evidence card first.')
    const signature = inputSignature(room.data, evidence)
    const existing = await list<Snapshot>(ctx.tools, 'snapshots', room.recordId)
    const same = existing.find(s => s.data.inputSignature === signature)
    if (same) return { snapshotId: same.recordId }
    ensure(existing.length < 5, 'This room has reached its five-comparison evaluation limit. You can still decide manually.')
    const result = await ctx.tools.integration<{ choices: { message: { content: string } }[] }>(COMPLETION_ENDPOINT, {
      model: MODEL, messages: [{ role: 'system', content: COMPARISON_PROMPT }, { role: 'user', content: JSON.stringify({ question: room.data.question, constraints: room.data.constraints,
        options: room.data.options, evidence: evidence.map(e => ({ id: e.recordId, ...e.data })) }) }], response_format: { type: 'json_object' },
    })
    if (!result.success) throw new DomainError('The comparison could not be generated. Your evidence is safe; retry or decide manually.')
    const comparison = parseComparison(result.data?.choices?.[0]?.message?.content, room.data, evidence)
    const snapshot = ok(await ctx.tools.create('snapshots', { teamId: room.recordId, inputSignature: signature, ...comparison }))
    return { snapshotId: snapshot.recordId }
  },
  async finalize(ctx) {
    const room = await roomAccess(ctx, true)
    if (room.data.status === 'decided') return { roomId: room.recordId }
    const optionId = text(ctx.params.optionId, 'Decision', 80)
    ensure(room.data.options.some(o => o.id === optionId), 'Choose one of the room options.')
    const rationale = text(ctx.params.rationale, 'Decision rationale', 1600)
    const snapshotId = text(ctx.params.snapshotId ?? '', 'Comparison', 150, true)
    if (snapshotId) {
      const snapshot = await get<Snapshot>(ctx.tools, 'snapshots', snapshotId)
      const evidence = await list<Evidence>(ctx.tools, 'evidence', room.recordId)
      ensure(snapshot.data.teamId === room.recordId && snapshot.data.inputSignature === inputSignature(room.data, evidence), 'Evidence changed. Regenerate the comparison or choose a manual decision.')
    }
    ok(await ctx.tools.update('rooms', room.recordId, { status: 'decided', decision: optionId, rationale, snapshotId, decidedAt: new Date().toISOString() }))
    return { roomId: room.recordId }
  },
}

export const actionNames = [...Object.keys(handlers), 'scheduleReview']
export async function execute(name: string, ctx: Context): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  try {
    ensure(Object.hasOwn(handlers, name), 'Unknown action.')
    return { success: true, data: await handlers[name](ctx) }
  } catch (error) {
    if (error instanceof DomainError) return { success: false, error: error.message }
    console.error(`DecisionRoom action ${name} failed:`, error instanceof Error ? error.name : 'unknown')
    return { success: false, error: 'The operation failed. Your existing data is safe; please retry.' }
  }
}
