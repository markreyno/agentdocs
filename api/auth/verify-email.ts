import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginAuthRoute, getClientIp, readJsonBody, readString } from '../_lib/auth/http.js'
import { logAuthEvent } from '../_lib/auth/log.js'
import { consumeVerifyToken, getUserById, saveUser } from '../_lib/auth/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const token = readString(readJsonBody(req), 'token').trim()
  if (!token) {
    res.status(400).json({ error: 'This verification link is invalid or has expired.' })
    return
  }

  const userId = await consumeVerifyToken(token)
  if (!userId) {
    res.status(400).json({ error: 'This verification link is invalid or has expired.' })
    return
  }

  const user = await getUserById(userId)
  if (!user) {
    res.status(400).json({ error: 'This verification link is invalid or has expired.' })
    return
  }

  user.emailVerified = true
  await saveUser(user)
  await logAuthEvent({ type: 'verify_email', ip: getClientIp(req), email: user.email, userId: user.id })
  res.json({ ok: true, message: 'Email verified. You can sign in.' })
}
