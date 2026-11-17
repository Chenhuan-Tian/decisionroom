import type { CollectionSchema, ColumnDefinition } from 'deepspace/schema'

const plain = (name: string): ColumnDefinition => ({ name, storage: 'text', interpretation: 'plain' })
const json = (name: string): ColumnDefinition => ({ name, storage: 'text', interpretation: { kind: 'json' } })
// Writes are action-only. The service validates membership and state transitions;
// native team RBAC filters records BEFORE they reach a WebSocket subscriber.
const closed = { read: false, create: false, update: false, delete: false } as const
const team = { read: 'team', create: false, update: false, delete: false } as const
function collection(name: string, columns: ColumnDefinition[]): CollectionSchema {
  return { name, columns: [plain('teamId'), ...columns], teamField: 'teamId',
    permissions: { '*': closed, viewer: closed, member: team, admin: team } }
}
export const decisionSchemas: CollectionSchema[] = [
  collection('rooms', ['ownerId', 'question', 'constraints', 'status', 'decision', 'rationale', 'decidedAt', 'snapshotId'].map(plain).concat(json('options'))),
  { ...collection('team_members', [{ ...plain('userId'), userBound: true, immutable: true }, plain('status'), plain('displayName')]), uniqueOn: ['teamId', 'userId'] },
  collection('evidence', ['optionId', 'title', 'url', 'note'].map(plain)),
  { ...collection('votes', [{ ...plain('userId'), userBound: true, immutable: true }, plain('optionId'), plain('reason')]), uniqueOn: ['teamId', 'userId'] },
  collection('snapshots', [plain('inputSignature'), plain('summary'), json('comparison')]),
  collection('reviews', ['userId', 'startsAt', 'status', 'eventUrl'].map(plain)),
  { name: 'invitations', columns: ['teamId', 'tokenHash', 'expiresAt'].map(plain),
    permissions: { '*': closed, viewer: closed, member: closed, admin: closed } },
]
