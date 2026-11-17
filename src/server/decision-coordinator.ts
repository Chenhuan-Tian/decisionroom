import type { Env } from '../../worker'
import { createActionTools } from './action-routes'
import { execute } from '../decisionroom/service.ts'

/** One platform Durable Object per decision. Serializes state transitions even
 * while record calls yield, so racing votes/finalization and evidence caps are
 * enforced together. This queue is not a database: SDK RecordRoom stores all data.
 * No public route reaches this binding; the verified server action sets identity.
 */
export class DecisionCoordinator {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(private state: DurableObjectState, private env: Env) {}
  async fetch(request: Request): Promise<Response> {
    const run = this.tail.then(async () => {
      const { name, params } = await request.json() as { name: string; params: Record<string, unknown> }
      const userId = request.headers.get('X-Verified-User')
      const token = request.headers.get('Authorization')?.slice(7)
      if (!userId || !token) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      // Short evaluation budget per room, stored durably before paid requests.
      if (name === 'search' || name === 'compare') {
        const key = `attempts:${name}`
        const count = await this.state.storage.get<number>(key) ?? 0
        if (count >= 8) return Response.json({ success: false, error: 'This room has reached its integration attempt limit. Manual evidence and decisions still work.' })
        await this.state.storage.put(key, count + 1)
      }
      const tools = createActionTools(this.env, userId, token)
      return Response.json(await execute(name, { userId, params, tools }))
    })
    this.tail = run.catch(() => undefined)
    return run
  }
}
