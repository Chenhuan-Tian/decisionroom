export type Row<T> = { recordId: string; data: T; createdBy: string; createdAt: string; updatedAt: string }
export type Option = { id: string; name: string }
export type Room = {
  teamId: string; ownerId: string; question: string; constraints: string;
  options: Option[]; status: 'open' | 'decided'; decision: string; rationale: string;
  decidedAt: string; snapshotId: string;
}
export type Evidence = { teamId: string; optionId: string; title: string; url: string; note: string }
export type Member = { teamId: string; userId: string; status: string; displayName: string }
export type Vote = { teamId: string; userId: string; optionId: string; reason: string }
export type Claim = { text: string; evidenceIds: string[] }
export type Comparison = { optionId: string; advantages: Claim[]; concerns: Claim[]; unknowns: string[] }
export type Snapshot = { teamId: string; inputSignature: string; comparison: Comparison[]; summary: string }
export type Invitation = { teamId: string; tokenHash: string; expiresAt: string }
export type Review = { teamId: string; userId: string; startsAt: string; status: string; eventUrl: string }

export class DomainError extends Error {}
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError(message)
}
export function text(value: unknown, label: string, max: number, optional = false): string {
  ensure(typeof value === 'string', `${label} must be text.`)
  const trimmed = value.trim()
  ensure((optional || trimmed.length > 0) && trimmed.length <= max, `${label} must contain ${optional ? '0' : '1'}–${max} characters.`)
  return trimmed
}
export function safeUrl(value: unknown): string {
  const input = text(value, 'Source URL', 2000)
  let url: URL
  try { url = new URL(input) } catch { throw new DomainError('Enter a complete https:// source URL.') }
  ensure(url.protocol === 'https:' && !url.username && !url.password, 'Source links must use HTTPS without embedded credentials.')
  url.hash = ''
  return url.href
}
export function inputSignature(room: Room, evidence: Row<Evidence>[]): string {
  return JSON.stringify({ question: room.question, constraints: room.constraints, options: room.options,
    evidence: [...evidence].sort((a, b) => a.recordId.localeCompare(b.recordId)).map(e => ({ id: e.recordId, ...e.data })) })
}
export function parseComparison(raw: unknown, room: Room, evidence: Row<Evidence>[]): { comparison: Comparison[]; summary: string } {
  ensure(typeof raw === 'string' && raw.length <= 50000, 'The model returned an invalid response. Try again.')
  let parsed: { summary?: unknown; comparison?: unknown }
  try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) } catch { throw new DomainError('The model did not return valid JSON. Your evidence is safe; try again.') }
  ensure(parsed && typeof parsed === 'object', 'The comparison response is invalid.')
  const summary = text(parsed.summary, 'Summary', 1600)
  ensure(Array.isArray(parsed.comparison) && parsed.comparison.length === room.options.length, 'The model must compare every option exactly once.')
  const seen = new Set<string>()
  const comparison = parsed.comparison.map((item: Record<string, unknown>) => {
    ensure(item && typeof item === 'object', 'Invalid comparison item.')
    const optionId = text(item.optionId, 'Option', 80)
    ensure(room.options.some(o => o.id === optionId) && !seen.has(optionId), 'The model returned an unknown or duplicate option.')
    seen.add(optionId)
    function claims(value: unknown): Claim[] {
      ensure(Array.isArray(value) && value.length <= 4, 'Invalid comparison claims.')
      return value.map(c => {
        ensure(c && typeof c === 'object', 'Invalid claim.')
        const claim = text(c.text, 'Claim', 700)
        ensure(Array.isArray(c.evidenceIds) && c.evidenceIds.length > 0 && c.evidenceIds.length <= 10, 'Every factual claim needs a source.')
        const ids = c.evidenceIds.map((id: unknown) => text(id, 'Citation', 100))
        ensure(ids.every((id: string) => evidence.some(e => e.recordId === id && (e.data.optionId === optionId || e.data.optionId === 'all'))), 'The model cited missing evidence or evidence for a different option.')
        return { text: claim, evidenceIds: [...new Set<string>(ids)] }
      })
    }
    ensure(Array.isArray(item.unknowns) && item.unknowns.length <= 5, 'Invalid unknowns.')
    return { optionId, advantages: claims(item.advantages), concerns: claims(item.concerns), unknowns: item.unknowns.map(u => text(u, 'Unknown', 500)) }
  })
  return { summary, comparison }
}

export function decisionMarkdown(room: Room, evidence: Row<Evidence>[], votes: Row<Vote>[]): string {
  const chosen = room.options.find(o => o.id === room.decision)?.name ?? 'Not decided'
  return [`# ${room.question}`, '', `Status: ${room.status}`, `Decision: ${chosen}`, `Recorded: ${room.decidedAt || '—'}`,
    '', '## Constraints', room.constraints || 'None recorded.', '', '## Rationale', room.rationale || 'Not recorded.',
    '', '## Votes (advisory)', ...room.options.map(o => `- ${o.name}: ${votes.filter(v => v.data.optionId === o.id).length}`),
    '', '## Sources', ...evidence.map(e => `- ${e.data.title}: ${e.data.url}\n  ${e.data.note}`),
    '', 'AI comparisons are drafts. Source references are validated; factual accuracy requires human review.'].join('\n')
}
