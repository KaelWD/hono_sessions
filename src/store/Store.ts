import type { Context } from 'hono'
import type { SessionData } from '../Session'

/**
 * Interface for required methods in session storage drivers
 */
export default interface Store {
  get(c: Context, sessionId?: string): SessionData | null | undefined | Promise<SessionData | null | undefined>
  set(c: Context, sessionId: string, sessionData: SessionData): Promise<void> | void
  delete(c: Context, sessionId: string): Promise<void> | void
}
