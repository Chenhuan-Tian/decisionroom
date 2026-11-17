import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useMutations, useQuery } from 'deepspace'
import { ArrowRight, ArrowUpRight, Check, FileText, LockKeyhole, Plus, Search, Users } from 'lucide-react'
import { action, download } from '../../decisionroom/client'
import { decisionMarkdown, inputSignature } from '../../decisionroom/domain'
import type { Claim, Evidence, Member, Review, Room, Row, Snapshot, Vote } from '../../decisionroom/domain'

type Run = <T>(label: string, work: () => Promise<T>) => Promise<T | undefined>
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`dr-notice ${error ? 'dr-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>
}

export default function HomePage() {
  const { isSignedIn, isLoaded, user, userId } = useAuthProfileReady({ requireUser: true })
  const { records: rooms, status, error: queryError } = useQuery<Room>('rooms', { orderBy: 'createdAt', orderDir: 'desc' })
  const { ready } = useMutations('rooms')
  const [searchParams, setParams] = useSearchParams()
  const selected = searchParams.get('room')
  const [create, setCreate] = useState(false)
  const [auth, setAuth] = useState(false)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const busy = useRef(false)
  const [inviteToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite'))
  const run: Run = async (label, work) => {
    if (busy.current) return undefined
    busy.current = true; setPending(label); setError('')
    try { return await work() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); return undefined }
    finally { busy.current = false; setPending('') }
  }
  const room = rooms.find(r => r.recordId === selected)
  if (!isLoaded) return <div className="dr-empty" aria-busy="true">Loading your session…</div>
  if (!isSignedIn) return <div className="dr-empty"><LockKeyhole size={36} /><p className="dr-eyebrow" style={{ justifyContent: 'center' }}>A LITTLE SPACE TO THINK</p><h1>Your next good decision<br />starts here.</h1><p>Sign in to create a private room, or to accept an invitation. Your sources and votes stay with your room.</p><button className="dr-button dr-button-large" onClick={() => setAuth(true)}>Sign in to continue <ArrowRight size={17} /></button>{auth && <AuthOverlay onClose={() => setAuth(false)} />}</div>
  return <div className="dr-workspace">
    <aside className="dr-sidebar"><button className="dr-button" disabled={!!pending || !ready} onClick={() => { setCreate(true); setError('') }}><Plus size={15} /> New decision</button><p>YOUR DECISION ROOMS</p>
      {rooms.map(r => <Link key={r.recordId} to={`/home?room=${r.recordId}`} onClick={() => { setCreate(false); setError('') }} className={`dr-room-link ${r.recordId === selected && !create ? 'active' : ''}`}><strong>{r.data.question}</strong><span>{r.data.status === 'decided' ? '✓ Decision recorded' : '○ Open for consideration'}</span></Link>)}
      {status === 'ready' && rooms.length === 0 && <span className="dr-caption">Your rooms will appear here.</span>}
    </aside>
    <div className="dr-content">{error && <Notice error>{error}</Notice>}{pending && <Notice>{pending}… {pending.includes('comparison') ? 'This can take up to a minute. Other room writes wait until it finishes.' : ''}</Notice>}
      {status === 'loading' ? <div className="dr-empty" aria-busy="true">Connecting to your rooms…</div>
        : status === 'error' ? <Notice error>{queryError || 'Could not connect. Refresh to reconnect.'}</Notice>
        : create ? <CreateRoom disabled={!!pending || !ready} run={run} displayName={user?.name || 'Host'} onCreated={id => { setCreate(false); setParams({ room: id }) }} onCancel={() => setCreate(false)} />
        : selected && inviteToken && !room ? <section className="dr-panel dr-join"><p className="dr-eyebrow">YOU HAVE A SEAT AT THE TABLE</p><h1>Join this decision.</h1><p>Joining gives you access to this room’s evidence, votes, and decision record. Anyone holding the invitation can join until it expires.</p><button className="dr-button" disabled={!!pending || !ready} onClick={() => run('Joining room', async () => { await action('join', { roomId: selected, token: inviteToken, displayName: user?.name || 'Member' }); window.location.replace(`/home?room=${selected}`) })}>Accept invitation <Users size={16} /></button></section>
        : room ? <RoomView key={room.recordId} room={room} userId={userId!} pending={pending} ready={ready} run={run} />
        : selected ? <div className="dr-empty"><LockKeyhole size={30} /><h2>Room unavailable</h2><p>It may still be syncing, or you may need an invitation. A room link alone does not grant access.</p><Link to="/home" className="dr-button dr-button-light">Back to my rooms</Link></div>
        : <div className="dr-empty"><FileText size={38} /><p className="dr-eyebrow" style={{ justifyContent: 'center' }}>YOUR WORKSPACE</p><h1>Make room for<br />a considered choice.</h1><p>A question, a few options, and the people who care. Everything else starts from there.</p><button className="dr-button" disabled={!ready} onClick={() => setCreate(true)}>Start your first decision <Plus size={16} /></button></div>}
    </div>
  </div>
}

function CreateRoom({ disabled, run, displayName, onCreated, onCancel }: { disabled: boolean; run: Run; displayName: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('')
  const [constraints, setConstraints] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [id] = useState(() => crypto.randomUUID())
  async function submit(e: FormEvent) {
    e.preventDefault()
    await run('Creating decision', async () => { await action('createRoom', { roomId: id, question, constraints, options, displayName }); onCreated(id) })
  }
  function example() { setQuestion('Which book should our reading club choose next?'); setConstraints('Four weeks to read. Mixed technical backgrounds. We want ideas we can apply at work.'); setOptions(['Thinking in Systems', 'The Design of Everyday Things', 'A Philosophy of Software Design']) }
  return <section style={{ maxWidth: 700 }}><p className="dr-eyebrow">01 / FRAME THE CHOICE</p><h1>What are we deciding?</h1><p className="dr-muted">Keep it focused. Two or three options make a good starting point.</p><div className="dr-panel"><form className="dr-form" onSubmit={submit}>
    <label>The question<input required maxLength={180} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Which book should our reading club choose?" /></label>
    <label>Constraints & what matters<textarea maxLength={1200} value={constraints} onChange={e => setConstraints(e.target.value)} placeholder="Budget, timing, who this affects, what success looks like…" /></label>
    {options.map((option, i) => <label key={i}>Option {String(i + 1).padStart(2, '0')}<input required maxLength={80} value={option} onChange={e => setOptions(values => values.map((v, j) => j === i ? e.target.value : v))} /></label>)}
    <div className="dr-toolbar">{options.length < 3 ? <button type="button" className="dr-text-button" onClick={() => setOptions([...options, ''])}>+ Add a third option</button> : <button type="button" className="dr-text-button" onClick={() => setOptions(options.slice(0, 2))}>Remove third option</button>}<button type="button" className="dr-text-button" onClick={example}>Use reading-club example</button></div>
    <p className="dr-caption">Options are fixed after creation, so evidence and votes always refer to the same choices. Rooms are private until you invite someone.</p>
    <div className="dr-form-actions"><button className="dr-button" disabled={disabled}>Create private room <ArrowRight size={16} /></button><button type="button" className="dr-text-button" onClick={onCancel}>Cancel</button></div>
  </form></div></section>
}

function RoomView({ room, userId, pending, ready, run }: { room: Row<Room>; userId: string; pending: string; ready: boolean; run: Run }) {
  const { records: evidence, status: evidenceStatus } = useQuery<Evidence>('evidence', { where: { teamId: room.recordId }, orderBy: 'createdAt' })
  const { records: votes, status: votesStatus } = useQuery<Vote>('votes', { where: { teamId: room.recordId } })
  const { records: members, status: membersStatus } = useQuery<Member>('team_members', { where: { teamId: room.recordId } })
  const { records: snapshots, status: snapshotsStatus } = useQuery<Snapshot>('snapshots', { where: { teamId: room.recordId }, orderBy: 'createdAt', orderDir: 'desc' })
  const { records: reviews } = useQuery<Review>('reviews', { where: { teamId: room.recordId } })
  const [tab, setTab] = useState<'evidence' | 'compare' | 'decide'>('evidence')
  const [invite, setInvite] = useState('')
  const [copied, setCopied] = useState(false)
  const host = room.data.ownerId === userId
  const closed = room.data.status === 'decided'
  const dataReady = [evidenceStatus, votesStatus, membersStatus, snapshotsStatus].every(s => s === 'ready')
  const dataFailed = [evidenceStatus, votesStatus, membersStatus, snapshotsStatus].some(s => s === 'error')
  const disabled = !!pending || !ready || !dataReady
  const snapshot = closed ? snapshots.find(s => s.recordId === room.data.snapshotId) : snapshots[0]
  const stale = !!snapshot && snapshot.data.inputSignature !== inputSignature(room.data, evidence)
  const me = votes.find(v => v.data.userId === userId)
  const sourceNumber = (id: string) => evidence.findIndex(e => e.recordId === id) + 1
  async function inviteMember() {
    await run('Creating invitation', async () => { const result = await action<{ token: string }>('invite', { roomId: room.recordId }); setInvite(`${location.origin}/home?room=${room.recordId}#invite=${result.token}`); setCopied(false) })
  }
  function goToSource(id: string) { setTab('evidence'); setTimeout(() => document.getElementById(`e-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }
  function claims(items: Claim[]) { return items.length ? items.map((c, i) => <div className="dr-claim" key={i}>{c.text}<div>{c.evidenceIds.map(id => <button className="dr-text-button" key={id} title="View evidence" onClick={() => goToSource(id)}>[Source {sourceNumber(id) || 'removed'}]</button>)}</div></div>) : <p className="dr-caption">No supported claim in the saved evidence.</p> }
  return <>
    <div className="dr-room-heading"><div><p className="dr-eyebrow"><span className="dr-live-dot" /> {closed ? 'DECISION RECORDED' : 'OPEN FOR CONSIDERATION'}</p><h1>{room.data.question}</h1><p className="dr-muted" style={{ whiteSpace: 'pre-wrap' }}>{room.data.constraints || 'No constraints recorded.'}</p><div className="dr-member-list">{members.map(m => <span className="dr-member" key={m.recordId}><span className="dr-avatar" aria-hidden="true">{m.data.displayName.slice(0, 1)}</span>{m.data.displayName}{m.data.userId === room.data.ownerId ? ' · host' : ''}</span>)}</div></div>
      <div className="dr-toolbar">{host && !closed && <button className="dr-button dr-button-light" disabled={disabled} onClick={inviteMember}><Users size={15} /> Invite</button>}<button className="dr-button dr-button-light" disabled={!dataReady} onClick={() => download('decisionroom-brief.md', decisionMarkdown(room.data, evidence, votes))}><FileText size={15} /> Export brief</button></div>
    </div>
    {invite && <Notice>Invitation expires in 24 hours. Generating a new invitation invalidates the old link.<a className="dr-invite-link" href={invite}>{invite}</a><button className="dr-text-button" onClick={() => run('Copying invitation', async () => { await navigator.clipboard.writeText(invite); setCopied(true) })}>{copied ? 'Copied' : 'Copy invitation'}</button></Notice>}
    {closed && <section className="dr-decision"><p className="dr-eyebrow"><Check size={14} /> THE CALL WE MADE</p><h2>{room.data.options.find(o => o.id === room.data.decision)?.name}</h2><p>{room.data.rationale}</p><span className="dr-caption">Recorded {new Date(room.data.decidedAt).toLocaleString()} · Evidence and votes are frozen.</span></section>}
    {dataFailed ? <Notice error>Some room data could not load. Refresh to reconnect before making changes.</Notice> : !dataReady ? <Notice>Syncing evidence, comparisons and votes…</Notice> : null}
    <div className="dr-options" style={{ gridTemplateColumns: `repeat(${room.data.options.length}, minmax(0,1fr))` }}>{room.data.options.map((o, i) => <section className={`dr-option ${me?.data.optionId === o.id ? 'chosen' : ''}`} key={o.id}><span className="dr-step">OPTION {String(i + 1).padStart(2, '0')}</span><h3>{o.name}</h3><span className="dr-option-count">{votes.filter(v => v.data.optionId === o.id).length} votes · {evidence.filter(e => e.data.optionId === o.id || e.data.optionId === 'all').length} sources</span>{!closed && <button className={`dr-button ${me?.data.optionId === o.id ? '' : 'dr-button-light'}`} disabled={disabled} onClick={() => run('Saving vote', () => action('vote', { roomId: room.recordId, optionId: o.id, reason: '' }))}>{me?.data.optionId === o.id ? <><Check size={15} /> Your vote</> : 'Vote for this option'}</button>}</section>)}</div>
    <p className="dr-caption">Votes are advisory. The host records the final choice and explains the reasoning.</p>
    <div className="dr-tabs" role="tablist" aria-label="Decision workflow">{(['evidence', 'compare', 'decide'] as const).map((t, i) => <button role="tab" id={`tab-${t}`} aria-controls={`panel-${t}`} aria-selected={tab === t} key={t} onClick={() => setTab(t)}>{String(i + 1).padStart(2, '0')} / {t === 'evidence' ? 'Evidence' : t === 'compare' ? 'Compare' : 'Decision'}</button>)}</div>
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'evidence' && <EvidencePanel room={room} evidence={evidence} host={host} userId={userId} disabled={disabled || closed} closed={closed} run={run} />}
      {tab === 'compare' && <section className="dr-panel"><div className="dr-panel-heading"><h2>Find the tradeoffs.</h2>{host && !closed && <button className="dr-button" disabled={disabled || !evidence.length} onClick={() => run('Generating comparison', () => action('compare', { roomId: room.recordId }))}>{stale ? 'Regenerate comparison' : 'Compare saved evidence'}</button>}</div><p className="dr-caption">AI uses only your saved notes. Citation IDs are checked, but you still need to verify that each source supports the claim.</p>
        {stale && <div className="dr-notice dr-warning" role="status">Evidence has changed. This comparison is out of date and cannot be attached to a final decision.</div>}
        {!snapshot ? <div className="dr-empty"><FileText size={26} /><h3>No comparison yet.</h3><p>{host ? 'Save evidence, then generate a comparison. You can also make a decision without AI.' : 'The host can generate a comparison when your evidence is ready.'}</p></div> : <><p>{snapshot.data.summary}</p><div className="dr-comparisons">{snapshot.data.comparison.map(c => <article className="dr-comparison" key={c.optionId}><h3>{room.data.options.find(o => o.id === c.optionId)?.name}</h3><h4>Advantages</h4>{claims(c.advantages)}<h4>Concerns</h4>{claims(c.concerns)}<h4>Still unknown</h4>{c.unknowns.map((u, i) => <p className="dr-unknown" key={i}>{u}</p>)}</article>)}</div><p className="dr-caption">Draft generated {new Date(snapshot.createdAt).toLocaleString()} · {snapshots.length}/5 saved comparisons</p></>}
      </section>}
      {tab === 'decide' && <DecisionPanel room={room} host={host} disabled={disabled} run={run} snapshot={snapshot} stale={stale} votes={votes} members={members} review={reviews[0]} />}
    </div>
  </>
}

function EvidencePanel({ room, evidence, host, userId, disabled, closed, run }: { room: Row<Room>; evidence: Row<Evidence>[]; host: boolean; userId: string; disabled: boolean; closed: boolean; run: Run }) {
  const [query, setQuery] = useState(room.data.question)
  const [results, setResults] = useState<{ title: string; url: string; note: string }[] | null>(null)
  const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [note, setNote] = useState(''); const [optionId, setOptionId] = useState('all')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [confirmRemove, setConfirmRemove] = useState('')
  async function save(e: FormEvent) { e.preventDefault(); await run('Saving evidence', async () => { await action('addEvidence', { roomId: room.recordId, requestId, title, url, note, optionId }); setTitle(''); setUrl(''); setNote(''); setRequestId(crypto.randomUUID()) }) }
  return <>
    <section className="dr-panel"><div className="dr-panel-heading"><h2>The evidence on the table.</h2><span className="dr-pill">{evidence.length} / 10 sources</span></div>
      {!evidence.length && <p>No evidence yet. Add a source with a short note about what it establishes.</p>}
      {evidence.map((e, i) => <article className="dr-evidence" id={`e-${e.recordId}`} key={e.recordId}><span className="dr-step">SOURCE {i + 1} · {room.data.options.find(o => o.id === e.data.optionId)?.name || 'ALL OPTIONS'}</span><h3><a href={e.data.url} target="_blank" rel="noreferrer">{e.data.title} <ArrowUpRight size={12} style={{ display: 'inline' }} /></a></h3><p>{e.data.note}</p><div className="dr-evidence-footer"><span>{new URL(e.data.url).hostname} · Added {new Date(e.createdAt).toLocaleDateString()}</span>{!closed && (host || e.createdBy === userId) && (confirmRemove === e.recordId ? <div className="dr-toolbar"><button disabled={disabled} className="dr-text-button dr-danger" onClick={() => run('Removing evidence', async () => { await action('removeEvidence', { roomId: room.recordId, evidenceId: e.recordId }); setConfirmRemove('') })}>Confirm removal</button><button className="dr-text-button" onClick={() => setConfirmRemove('')}>Keep</button></div> : <button className="dr-text-button" disabled={disabled} onClick={() => setConfirmRemove(e.recordId)}>Remove</button>)}</div></article>)}
    </section>
    {!closed && host && <section className="dr-panel"><h2>Look a little further.</h2><p className="dr-caption">Search finds candidates. Review a result and save the relevant passage as evidence. Search and AI use the host app’s DeepSpace credits.</p><form className="dr-search-form" onSubmit={e => { e.preventDefault(); run('Searching sources', async () => { const data = await action<{ results: { title: string; url: string; note: string }[] }>('search', { roomId: room.recordId, query }); setResults(data.results) }) }}><input className="dr-input" aria-label="Search query" required maxLength={250} value={query} onChange={e => setQuery(e.target.value)} /><button className="dr-button dr-button-light" disabled={disabled}><Search size={16} /> Search</button></form>
      {results?.length === 0 && <p>No matching sources. Try another query or add a URL below.</p>}{results?.map((r, i) => <article className="dr-search-result" key={`${r.url}-${i}`}><h3>{r.title}</h3><a href={r.url} target="_blank" rel="noreferrer">{new URL(r.url).hostname} ↗</a><p>{r.note || 'No extract available. Open the source and add your own note.'}</p><button className="dr-text-button" disabled={disabled || evidence.length >= 10} onClick={() => { setTitle(r.title); setUrl(r.url); setNote(r.note); setRequestId(crypto.randomUUID()); document.getElementById('evidence-form')?.scrollIntoView({ behavior: 'smooth' }) }}>Review & add this source ↓</button></article>)}
    </section>}
    {!closed && <section className="dr-panel" id="evidence-form"><h2>Add something worth considering.</h2><form className="dr-form" onSubmit={save}><div className="dr-form-row"><label>Source title<input required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Applies to<select value={optionId} onChange={e => setOptionId(e.target.value)}><option value="all">All options</option>{room.data.options.map(o => <option value={o.id} key={o.id}>{o.name}</option>)}</select></label></div><label>Source URL<input required type="url" maxLength={2000} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} /></label><label>What does this source establish?<textarea required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="A relevant passage or your summary. AI will compare this note, so include enough context." /></label><button className="dr-button" disabled={disabled || evidence.length >= 10}>Save evidence <Plus size={15} /></button></form></section>}
  </>
}

function DecisionPanel({ room, host, disabled, run, snapshot, stale, votes, members, review }: { room: Row<Room>; host: boolean; disabled: boolean; run: Run; snapshot?: Row<Snapshot>; stale: boolean; votes: Row<Vote>[]; members: Row<Member>[]; review?: Row<Review> }) {
  const [optionId, setOption] = useState(room.data.options[0].id); const [rationale, setRationale] = useState(''); const [attach, setAttach] = useState(true)
  const [reviewTime, setReviewTime] = useState(''); const [authUrl, setAuthUrl] = useState(''); const [confirm, setConfirm] = useState(false)
  const closed = room.data.status === 'decided'
  async function finalize(e: FormEvent) { e.preventDefault(); if (!confirm) { setConfirm(true); return }; await run('Recording decision', () => action('finalize', { roomId: room.recordId, optionId, rationale, snapshotId: attach && !stale ? snapshot?.recordId || '' : '' })) }
  return <><section className="dr-panel"><h2>The people behind the choice.</h2>{votes.length === 0 && <p>No votes yet.</p>}{votes.map(v => <div className="dr-vote-row" key={v.recordId}><Check size={14} /><div><strong>{members.find(m => m.data.userId === v.data.userId)?.data.displayName || 'Member'}</strong><p>{room.data.options.find(o => o.id === v.data.optionId)?.name}</p></div></div>)}</section>
    {host && !closed ? <section className="dr-panel"><h2>Make the call.</h2><p className="dr-caption">A vote is an input, not an obligation. Explain the choice in your own words. Confirming freezes the room’s evidence and votes.</p><form className="dr-form" onSubmit={finalize}><label>The decision<select value={optionId} onChange={e => { setOption(e.target.value); setConfirm(false) }}>{room.data.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Why this choice?<textarea required maxLength={1600} value={rationale} onChange={e => { setRationale(e.target.value); setConfirm(false) }} placeholder="What mattered most? What uncertainty are we accepting?" /></label>{snapshot && !stale && <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={attach} onChange={e => setAttach(e.target.checked)} /> Attach the current AI comparison as a draft appendix</label>}{stale && <div className="dr-notice dr-warning">The comparison is out of date. This will be recorded as a manual decision unless you regenerate it.</div>}{confirm && <Notice>Ready to record “{room.data.options.find(o => o.id === optionId)?.name}”? This closes voting and freezes evidence.</Notice>}<button className="dr-button" disabled={disabled}>{confirm ? 'Confirm & close decision' : 'Review final decision'} <Check size={16} /></button></form></section> : !closed ? <Notice>The host will record the final decision. You can keep adding evidence and voting.</Notice> : null}
    {closed && host && <section className="dr-panel"><h2>A decision is worth revisiting.</h2><p className="dr-caption">Create one 30-minute review in your primary Google Calendar. No attendees or invitation emails. Review time is shown in your browser’s local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      {review?.data.status === 'created' ? <Notice>Review scheduled for {new Date(review.data.startsAt).toLocaleString()}.{review.data.eventUrl && <a className="dr-text-button" style={{ display: 'block' }} href={review.data.eventUrl} target="_blank" rel="noreferrer">Open Google Calendar ↗</a>}</Notice>
        : review?.data.status === 'uncertain' || review?.data.status === 'pending' ? <Notice error>Calendar creation was not confirmed. Check your Google Calendar. Automatic retries are disabled to prevent duplicate events.</Notice>
        : <form className="dr-form" onSubmit={e => { e.preventDefault(); run('Scheduling review', async () => { const result = await action<{ requiresOAuth?: boolean; authUrl?: string }>('scheduleReview', { roomId: room.recordId, startsAt: new Date(reviewTime).toISOString() }); if (result.requiresOAuth && result.authUrl) setAuthUrl(result.authUrl) }) }}><label>Review date & time<input required type="datetime-local" value={reviewTime} onChange={e => setReviewTime(e.target.value)} /></label>{authUrl && <Notice>Connect your Google Calendar, then return here and submit again. Nothing has been added yet.<a className="dr-button dr-button-light" style={{ display: 'flex', marginTop: 10 }} href={authUrl}>Connect Google Calendar <ArrowUpRight size={14} /></a></Notice>}<button className="dr-button" disabled={disabled}>Confirm review & add to Google Calendar</button></form>}
    </section>}
  </>
}
