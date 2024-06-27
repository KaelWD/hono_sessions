import type { Context } from 'hono'
import type Store from './Store'
import type { SessionData } from '../Session'

/**
 * Memory storage driver class
 */
class MemoryStore implements Store {
  private data: Map<string, SessionData>

  constructor() {
    this.data = new Map
  }

  get(c: Context, sid: string): SessionData | null | undefined {
    return this.data.has(sid) ? this.data.get(sid) : null
  }

  set(c: Context, sid: string, session_data: SessionData) {
    this.data.set(sid, session_data)
  }

  delete(c: Context, sid: string) {
    this.data.delete(sid)
  }
}

export default MemoryStore
