import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENERIC_LOGIN_ERROR } from '../_lib/auth/constants.js'
import { setSessionCookie } from '../_lib/auth/cookies.js'
import { beginAuthRoute, getClientIp, loadSessionUser, readJsonBody, readString, userAgentOf } from '../_lib/auth/http.js'
import { logAuthEvent } from '../_lib/auth/log.js'
import { sendSecurityNotice } from '../_lib/auth/mail.js'
import { hashPassword, validateNewPassword, verifyPassword } from '../_lib/auth/password.js'
import { verifyTotp } from '../_lib/auth/totp.js'
import { deleteAllSessions, remainingCookieSec, rotateSession, saveUser } from '../_lib/auth/store.js'
import { toPublicUser } from '../_lib/auth/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const loaded = await loadSessionUser(req)
  if (!loaded) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  const body = readJsonBody(req)
  const currentPassword = readString(body, 'currentPassword')
  const newPassword = readString(body, 'password')
  const totpCode = readString(body, 'totpCode')

  const matches = await verifyPassword(currentPassword, loaded.user.password)
  if (!matches) {
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  if (loaded.user.totp?.enabled) {
    if (!verifyTotp(loaded.user.totp.secretBase32, totpCode)) {
      res.status(401).json({ error: 'Enter a valid authenticator code to change your password.' })
      return
    }
  }

  const passwordError = await validateNewPassword(newPassword, {
    mfaEnabled: Boolean(loaded.user.totp?.enabled),
    email: loaded.user.email,
  })
  if (passwordError) {
    res.status(400).json({ error: passwordError })
    return
  }

  loaded.user.password = await hashPassword(newPassword)
  loaded.user.passwordChangedAt = Date.now()
  await saveUser(loaded.user)
  await deleteAllSessions(loaded.user.id)
  const session = await rotateSession(null, loaded.user.id, getClientIp(req), userAgentOf(req))
  setSessionCookie(req, res, session.token, remainingCookieSec(session))
  sendSecurityNotice(
    loaded.user.email,
    'Your agentdocs password was changed',
    'Your password was changed from a signed-in session. Other sessions were signed out.\n',
  )
  await logAuthEvent({
    type: 'password_change',
    ip: getClientIp(req),
    email: loaded.user.email,
    userId: loaded.user.id,
  })
  res.json({ ok: true, user: toPublicUser(loaded.user) })
}
