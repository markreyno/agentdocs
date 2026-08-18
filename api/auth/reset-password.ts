import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginAuthRoute, getClientIp, readJsonBody, readString } from '../_lib/auth/http.js'
import { logAuthEvent } from '../_lib/auth/log.js'
import { sendSecurityNotice } from '../_lib/auth/mail.js'
import { hashPassword, validateNewPassword } from '../_lib/auth/password.js'
import { isAccountLocked } from '../_lib/auth/rateLimit.js'
import { consumeResetToken, deleteAllSessions, getUserById, peekResetToken, saveUser } from '../_lib/auth/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const body = readJsonBody(req)
  const token = readString(body, 'token').trim()
  const password = readString(body, 'password')
  const ip = getClientIp(req)

  if (!token) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }

  const userId = await peekResetToken(token)
  if (!userId) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }

  const user = await getUserById(userId)
  if (!user) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }

  if (await isAccountLocked(user.email)) {
    res.status(429).json({
      error: 'This account is temporarily locked after too many sign-in attempts. Try again after the lockout ends.',
    })
    return
  }

  const passwordError = await validateNewPassword(password, {
    mfaEnabled: Boolean(user.totp?.enabled),
    email: user.email,
  })
  if (passwordError) {
    res.status(400).json({ error: passwordError })
    return
  }

  const consumed = await consumeResetToken(token)
  if (!consumed || consumed !== user.id) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    return
  }

  user.password = await hashPassword(password)
  user.passwordChangedAt = Date.now()
  await saveUser(user)
  await deleteAllSessions(user.id)
  sendSecurityNotice(
    user.email,
    'Your agentdocs password was changed',
    'Your password was reset. If you did not do this, contact support and reset it again from a device you trust.\n',
  )
  await logAuthEvent({ type: 'password_reset_complete', ip, email: user.email, userId: user.id })
  res.json({ ok: true, message: 'Password updated. You can sign in with your new password.' })
}
