import type { VercelRequest, VercelResponse } from '@vercel/node'
import { secondsFromMs } from '../_lib/config.js'
import { GENERIC_LOGIN_ERROR, MFA_PENDING_TTL_MS, SESSION_COOKIE } from '../_lib/auth/constants.js'
import { clearMfaCookie, readCookie, setMfaCookie, setSessionCookie } from '../_lib/auth/cookies.js'
import { beginAuthRoute, getClientIp, readJsonBody, readString, userAgentOf } from '../_lib/auth/http.js'
import { logAuthEvent, noteGlobalFailure } from '../_lib/auth/log.js'
import { dummyVerify, verifyPassword } from '../_lib/auth/password.js'
import { normalizeEmail } from '../_lib/auth/policy.js'
import { clearAccountLock, ipOverLoginLimit, isAccountLocked, registerLoginFailure } from '../_lib/auth/rateLimit.js'
import { createMfaPending, getSession, getUserByEmail, remainingCookieSec, rotateSession } from '../_lib/auth/store.js'
import { toPublicUser } from '../_lib/auth/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const ip = getClientIp(req)
  if (await ipOverLoginLimit(ip)) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' })
    return
  }

  const body = readJsonBody(req)
  const email = normalizeEmail(readString(body, 'email'))
  const password = readString(body, 'password')

  if (!email || !password) {
    await dummyVerify(password || 'x')
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  const user = await getUserByEmail(email)
  if (!user) {
    await dummyVerify(password)
    await noteGlobalFailure()
    const { ipBlocked } = await registerLoginFailure(email, ip)
    if (ipBlocked) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' })
      return
    }
    await logAuthEvent({ type: 'login_failure', ip, email })
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  if (await isAccountLocked(email)) {
    await dummyVerify(password)
    await logAuthEvent({ type: 'login_locked', ip, email, userId: user.id })
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  const ok = await verifyPassword(password, user.password)
  if (!ok) {
    await noteGlobalFailure()
    const { locked, ipBlocked } = await registerLoginFailure(email, ip)
    if (locked) await logAuthEvent({ type: 'lockout', ip, email, userId: user.id })
    await logAuthEvent({ type: 'login_failure', ip, email, userId: user.id })
    if (ipBlocked) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' })
      return
    }
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  if (!user.emailVerified) {
    await logAuthEvent({ type: 'login_unverified', ip, email, userId: user.id })
    res.status(403).json({ error: 'Please verify your email before signing in.' })
    return
  }

  await clearAccountLock(email)
  const previousToken = readCookie(req, SESSION_COOKIE)
  const previous = previousToken ? await getSession(previousToken) : null

  if (user.totp?.enabled) {
    const mfaToken = await createMfaPending(user.id, ip)
    clearMfaCookie(req, res)
    setMfaCookie(req, res, mfaToken, secondsFromMs(MFA_PENDING_TTL_MS))
    await logAuthEvent({ type: 'login_success', ip, email, userId: user.id, detail: 'mfa_pending' })
    res.json({ ok: true, mfaRequired: true })
    return
  }

  const session = await rotateSession(previous, user.id, ip, userAgentOf(req))
  clearMfaCookie(req, res)
  setSessionCookie(req, res, session.token, remainingCookieSec(session))
  await logAuthEvent({ type: 'login_success', ip, email, userId: user.id })
  res.json({ ok: true, mfaRequired: false, user: toPublicUser(user) })
}
