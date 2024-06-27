import type { Context } from 'hono'
import Store from '../Store'
import { SessionData } from '../../Session'

export class CloudflareD1Store implements Store {
  db: any
  tableName: string
  
  constructor(tableName: string = 'sessions') {
    this.tableName = tableName
  }

  async get(c: Context, sessionId?: string|undefined) {
    const session = await this.db.prepare(`SELECT data FROM ${ this.tableName } WHERE id = ?`)
      .bind(sessionId)
      .first('data')
      
    if (session) {
      return JSON.parse(session)
    } else {
      return null
    }
  }

  async set(c: Context, sessionId: string,initialData: SessionData) {
    await this.db.prepare(`INSERT INTO ${ this.tableName } (id, data) VALUES (?, ?) ON CONFLICT DO UPDATE SET data = ?`).bind(sessionId, JSON.stringify(initialData)).run()
  }

  async delete(c: Context, sessionId: string) {
    await this.db.prepare(`DELETE FROM ${ this.tableName } WHERE id = ?`).bind(sessionId).run()
  }
}
