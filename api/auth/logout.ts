import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearMfaCookie, clearSessionCookie, readCookie } from '../_lib/auth/cookies.js'
import { beginAuthRoute, getClientIp } from '../_lib/auth/http.js'
import { logAuthEvent } from '../_lib/auth/log.js'
import { deleteSession, getSession } from '../_lib/auth/store.js'
import { SESSION_COOKIE } from '../_lib/auth/constants.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const token = readCookie(req, SESSION_COOKIE)
  if (token) {
    const session = await getSession(token)
    await deleteSession(token)
    await logAuthEvent({
      type: 'logout',
      ip: getClientIp(req),
      userId: session?.userId,
    })
  }
  clearSessionCookie(req, res)
  clearMfaCookie(req, res)
  res.json({ ok: true })
}
