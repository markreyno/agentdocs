import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setSessionCookie } from '../_lib/auth/cookies.js'
import { beginAuthRoute, loadSessionUser } from '../_lib/auth/http.js'
import { remainingCookieSec } from '../_lib/auth/store.js'
import { toPublicUser } from '../_lib/auth/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['GET'])) return

  const loaded = await loadSessionUser(req)
  if (!loaded) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  setSessionCookie(req, res, loaded.session.token, remainingCookieSec(loaded.session))
  res.json({
    user: toPublicUser(loaded.user),
    session: {
      createdAt: loaded.session.createdAt,
      lastSeenAt: loaded.session.lastSeenAt,
      idleExpiresAt: loaded.session.idleExpiresAt,
      absoluteExpiresAt: loaded.session.absoluteExpiresAt,
    },
  })
}
