import type { Context } from 'hono'
import Store from '../Store'
import { SessionData } from '../../Session'

export class BunSqliteStore implements Store {
  db: any
  tableName: string

  constructor(db: any, tableName = 'sessions') {
    this.db = db
    this.tableName = tableName
    const query = db.query(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, data TEXT)`)
    query.run()
  }

  get(c: Context, sessionId: string) {
    const query = this.db.query(`SELECT data FROM ${this.tableName} WHERE id = $id`)
    const result = query.get({ $id: sessionId })
    
    if (result) {
      return JSON.parse(result.data)
    } else {
      return null
    }
  }

  set(c: Context, sessionId: string,sessionData: SessionData) {
    const query = this.db.query(`INSERT INTO ${this.tableName} (id, data) VALUES ($id, $data) ON CONFLICT DO UPDATE SET data = $data`)
    query.run({ $id: sessionId, $data: JSON.stringify(sessionData) })
  }

  delete(c: Context, sessionId: string) {
    const query = this.db.query(`DELETE FROM ${this.tableName} WHERE id = $id`)
    query.run({ $id: sessionId})
  }
}
