import type { VercelRequest, VercelResponse } from '@vercel/node'
import { MFA_COOKIE, SESSION_COOKIE } from '../../_lib/auth/constants.js'
import { clearMfaCookie, readCookie, setSessionCookie } from '../../_lib/auth/cookies.js'
import { beginAuthRoute, getClientIp, readJsonBody, readString, userAgentOf } from '../../_lib/auth/http.js'
import { logAuthEvent } from '../../_lib/auth/log.js'
import { backupCodesMatch, hashBackupCode } from '../../_lib/auth/password.js'
import {
  consumeMfaPending,
  getMfaPending,
  getSession,
  getUserById,
  remainingCookieSec,
  rotateSession,
  saveUser,
} from '../../_lib/auth/store.js'
import { verifyTotp } from '../../_lib/auth/totp.js'
import { toPublicUser } from '../../_lib/auth/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const ip = getClientIp(req)
  const token = readCookie(req, MFA_COOKIE)
  if (!token) {
    res.status(401).json({ error: 'Sign in again to continue.' })
    return
  }

  const pending = await getMfaPending(token)
  if (!pending || pending.ip !== ip) {
    clearMfaCookie(req, res)
    res.status(401).json({ error: 'Sign in again to continue.' })
    return
  }

  const user = await getUserById(pending.userId)
  if (!user?.totp?.enabled) {
    clearMfaCookie(req, res)
    res.status(401).json({ error: 'Sign in again to continue.' })
    return
  }

  const code = readString(readJsonBody(req), 'code')
  const totpOk = verifyTotp(user.totp.secretBase32, code)
  const backupOk = !totpOk && backupCodesMatch(code, user.backupCodeHashes)
  if (!totpOk && !backupOk) {
    await logAuthEvent({ type: 'mfa_failure', ip, email: user.email, userId: user.id })
    res.status(401).json({ error: 'Invalid authenticator code.' })
    return
  }

  await consumeMfaPending(token)

  if (backupOk) {
    const hashed = hashBackupCode(code.trim().toLowerCase())
    user.backupCodeHashes = user.backupCodeHashes.filter(h => h !== hashed)
    await saveUser(user)
  }

  const previousToken = readCookie(req, SESSION_COOKIE)
  const previous = previousToken ? await getSession(previousToken) : null
  const session = await rotateSession(previous, user.id, ip, userAgentOf(req))
  clearMfaCookie(req, res)
  setSessionCookie(req, res, session.token, remainingCookieSec(session))
  await logAuthEvent({ type: 'mfa_success', ip, email: user.email, userId: user.id })
  res.json({ ok: true, user: toPublicUser(user) })
}
