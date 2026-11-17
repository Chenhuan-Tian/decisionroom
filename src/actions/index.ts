import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { actionNames } from '../decisionroom/service'

export const actions: Record<string, ActionHandler<Env>> = Object.fromEntries(actionNames.map(name => [name,
  async ({ params, userId, callerJwt, env }) => {
    // Never key a coordinator to an arbitrary client string: one UUID identifies
    // a room across create/join/writes, so all its mutations share a queue.
    const roomId = params.roomId
    if (typeof roomId !== 'string' || !/^[a-f0-9-]{36}$/.test(roomId)) return { success: false, error: 'Invalid room ID.' }
    const stub = env.DECISION_COORDINATORS.get(env.DECISION_COORDINATORS.idFromName(roomId))
    const response = await stub.fetch(new Request('https://internal/execute', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Verified-User': userId, Authorization: `Bearer ${callerJwt}` },
      body: JSON.stringify({ name, params }) }))
    return response.json()
  },
]))
