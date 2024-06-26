import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'
import type { CookieOptions } from 'hono/utils/cookie'

import CookieStore from './store/CookieStore'
import { encrypt, decrypt } from './Crypto'
import { type SessionData, Session } from './Session'
import type Store from './store/Store'

interface SessionOptions {
  store: Store | CookieStore
  encryptionKey?: string,
  expireAfterSeconds?: number,
  cookieOptions?: CookieOptions,
  sessionCookieName?: string
}

/** Function that returns a Hono-compatible session middleware */
export function sessionMiddleware(options: SessionOptions): MiddlewareHandler {

  const store = options.store
  const encryptionKey = options.encryptionKey
  const expireAfterSeconds = options.expireAfterSeconds
  const cookieOptions = options.cookieOptions
  const sessionCookieName = options.sessionCookieName || 'session'

  if (store instanceof CookieStore) {
    store.sessionCookieName = sessionCookieName
  
    if (encryptionKey) {
      store.encryptionKey = encryptionKey
    } else {
      throw new Error('encryptionKey is required while using CookieStore. encryptionKey must be at least 32 characters long.')
    }
  
    if (cookieOptions) {
      store.cookieOptions = cookieOptions
    }
  }

  const middleware = createMiddleware(async (c, next) => {
    let session = new Session(expireAfterSeconds)
    let sid = ''
    let session_data: SessionData | null | undefined
    let createNewSession = false

    const sessionCookie = getCookie(c, sessionCookieName)
  
    if (sessionCookie) { // If there is a session cookie present...

      if (store instanceof CookieStore) {
        session_data = await store.getSession(c)
      } else {
        try {
          sid = (encryptionKey ? await decrypt(encryptionKey, sessionCookie) : sessionCookie) as string
          session_data = await store.get(c, sid)
        } catch {
          createNewSession = true
        }
      }

      if (session_data) {
        session.setCache(session_data)

        if (session.sessionValid()) {
          session.reupSession(expireAfterSeconds)
        } else {
          store instanceof CookieStore ? await store.deleteSession(c) : await store.delete(c, sid)
          createNewSession = true
        }
      } else {
        createNewSession = true
      }
    } else {
      createNewSession = true
    }

    if (createNewSession) {
      session = new Session(expireAfterSeconds)
      if (!(store instanceof CookieStore)) {
        sid = globalThis.crypto.randomUUID()
      }
    }
  
    if (!(store instanceof CookieStore)) {
      setCookie(c, sessionCookieName, encryptionKey ? await encrypt(encryptionKey, sid) : sid, cookieOptions)
    }

    session.updateAccess()

    const sessionProxy = new Proxy(session, {
      get (target: Session, p: string, receiver: any) {
        if (Reflect.has(target, p)) return Reflect.get(target, p, receiver)
        return session.get(p as keyof Session)
      },
      set (target: Session, p: string, newValue: any, receiver: any) {
        if (Reflect.has(target, p)) return Reflect.set(target, p, receiver)
        session.set(p as keyof Session, newValue)
        return true
      }
    })

    c.session = sessionProxy

    c.set('session', sessionProxy)

    await next()

    const shouldDelete = session.getCache()._delete;
    const shouldRotateSessionKey = session.getCache()._rotate;
    const storeIsCookieStore = store instanceof CookieStore;

    if (shouldDelete) {
      store instanceof CookieStore
        ? await store.deleteSession(c)
        : await store.delete(c, sid);
    }

    /*
     * Only update session data if we didn't just delete it.
     * If session key rotation is enabled and the store is not a CookieStore,
     * we need to roate the session key by deleting the old session and creating a new one.
     */
    const shouldRecreateSessionForNonCookieStore =
      !shouldDelete &&
      !storeIsCookieStore &&
      shouldRotateSessionKey;

    if (shouldRecreateSessionForNonCookieStore) {
      session.getCache()._rotate = false;
      await store.delete(c, sid);
      sid = globalThis.crypto.randomUUID();

      setCookie(
        c,
        sessionCookieName,
        encryptionKey ? await encrypt(encryptionKey, sid) : sid,
        cookieOptions
      );
    }

    /*
     * We skip session data persistence if it was just deleted.
     * Only persist if we didn't just rotate the session key,
     * or the store is a CookieStore (which does not have its session key rotated)
     */
    const shouldPersistSession =
      !shouldDelete &&
      (!shouldRotateSessionKey || storeIsCookieStore || shouldRecreateSessionForNonCookieStore);

    if (shouldPersistSession) {
      store instanceof CookieStore
        ? await store.persistSessionData(c, session.getCache())
        : await store.set(c, sid, session.getCache());
    }
  })

  return middleware
}
