import { describe, expect, it } from 'vitest'
import { canCreate, canRead, canUpdate, canDelete } from 'deepspace/worker'
import { decisionSchemas } from '../schemas/decisionroom-schema'

describe('native DeepSpace collection policies', () => {
  const row = { recordId: 'row', createdBy: 'host', data: { teamId: 'private-room' } }
  const context = { isTeamMember: (teamId: string, userId: string) => teamId === 'private-room' && ['host', 'guest'].includes(userId) }
  it('allows members and excludes an unrelated signed-in user at the SDK boundary', () => {
    for (const schema of decisionSchemas.filter(s => s.name !== 'invitations')) {
      expect(canRead(schema, 'member', row, 'guest', context), schema.name).toBe(true)
      expect(canRead(schema, 'member', row, 'outsider', context), schema.name).toBe(false)
      expect(canRead(schema, 'admin', row, 'unrelated-admin', context), schema.name).toBe(false)
      expect(canRead(schema, 'viewer', row, 'anonymous', context), schema.name).toBe(false)
    }
  })
  it('never exposes invitation hashes through record subscriptions', () => {
    const schema = decisionSchemas.find(s => s.name === 'invitations')!
    for (const role of ['viewer', 'member', 'admin']) expect(canRead(schema, role, row, 'host', context)).toBe(false)
  })
  it('rejects direct record writes for every role, including the owner', () => {
    for (const schema of decisionSchemas) for (const role of ['viewer', 'member', 'admin']) {
      expect(canCreate(schema, role), schema.name).toBe(false)
      expect(canUpdate(schema, role, row, 'host', context), schema.name).toBe(false)
      expect(canDelete(schema, role, row, 'host', context), schema.name).toBe(false)
    }
  })
})
