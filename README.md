# Hono Sessions Middleware
Use cookie-based sessions with the [Hono](https://hono.dev/) framework. Currently tested to work with Cloudflare Workers and Deno.

## Usage

### Cloudflare Workers

```ts
import { Hono } from 'hono'
import { sessionMiddleware, CookieStore, Session } from 'hono-sessions'

const store = new CookieStore()

const app = new Hono()

const sessionRoutes = new Hono<{
  Variables: {
    session: Session,
    session_key_rotation: boolean
  }
}>()

sessionRoutes.use('*', session({
  store,
  expireAfterSeconds: 900 // delete session after 15 minutes of inactivity
}))

sessionRoutes.post('/login', async (c) => {
  const session = c.get('session')

  const { email, password } = await c.req.parseBody()

  if (password === 'correct') {
    c.set('session_key_rotation', true)
    session.set('email', email)
    session.set('failed-login-attempts', null)
    session.flash('message', 'Login Successful')
  } else {
    const failedLoginAttempts = (await session.get('failed-login-attempts') || 0) as number
    session.set('failed-login-attempts', failedLoginAttempts + 1)
    session.flash('error', 'Incorrect username or password')
  }

  return c.redirect('/')
})

sessionRoutes.post('/logout', async (c) => {
  await c.get('session').deleteSession()
  return c.redirect('/')
})

sessionRoutes.get('/', async (c) => {
  const session = c.get('session')

  const message = await session.get('message') || ''
  const error = await session.get('error') || ''
  const failedLoginAttempts = await session.get('failed-login-attempts')
  const email = await session.get('email')

  return c.html(`<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hono Sessions</title>
  </head>
  <body>
        <p>
            ${message}
        </p>
        <p>
            ${error}
        </p>
        <p>
            ${failedLoginAttempts ? `Failed login attempts: ${failedLoginAttempts}` : ''}
        </p>

        ${email ? 
        `<form id="logout" action="/logout" method="post">
            <button name="logout" type="submit">Log out ${email}</button>
        </form>`
        : 
        `<form id="login" action="/login" method="post">
            <p>
                <input id="email" name="email" type="text" placeholder="you@email.com">
            </p>
            <p>
                <input id="password" name="password" type="password" placeholder="password">
            </p>
            <button name="login" type="submit">Log in</button>
        </form>` 
    }
    </body>
  </html>`)
})

app.route('/', sessionRoutes)

export default app
```

### Deno
```ts
import { Hono } from 'https://deno.land/x/hono/mod.ts'
import { sessionMiddleware, CookieStore, Session } from 'https://deno.land/x/hono_sessions/mod.ts'

// Same as CF Workers, however instead of:
// export default app
// use:

Deno.serve(app.fetch)
```