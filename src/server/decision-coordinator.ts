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
      const tools = createActionTools(this.env, userId, token)
      const callIntegration = tools.integration.bind(tools)
      tools.integration = async <T>(endpoint: string, body?: unknown) => {
        if (endpoint === 'google/calendar-create-event') {
          const previous = await this.state.storage.get<{ status: string; result?: unknown }>('calendar')
          if (previous?.status === 'created') return { success: true, data: previous.result as T }
          if (previous) return { success: false, error: 'Calendar outcome uncertain; check Google Calendar.' }
          // Persist BEFORE the external write. A crash or timeout is ambiguous,
          // never an invitation to create the same event again.
          await this.state.storage.put('calendar', { status: 'pending' })
          const result = await callIntegration<T>(endpoint, body)
          if (result.success) {
            if ((result.data as Record<string, unknown>)?.requiresOAuth === true) await this.state.storage.delete('calendar')
            else await this.state.storage.put('calendar', { status: 'created', result: result.data })
          }
          return result
        }
        const key = `attempts:${endpoint}`
        const count = await this.state.storage.get<number>(key) ?? 0
        if (count >= 8) return { success: false, error: 'Integration attempt limit reached.' }
        await this.state.storage.put(key, count + 1)
        return callIntegration<T>(endpoint, body)
      }
      return Response.json(await execute(name, { userId, params, tools }))
    })
    this.tail = run.catch(() => undefined)
    return run
  }
}
