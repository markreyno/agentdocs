import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENERIC_SIGNUP_OK } from '../_lib/auth/constants.js'
import { beginAuthRoute, getClientIp, readJsonBody, readString } from '../_lib/auth/http.js'
import { logAuthEvent } from '../_lib/auth/log.js'
import { sendVerifyEmail } from '../_lib/auth/mail.js'
import { dummyVerify, hashPassword, validateNewPassword } from '../_lib/auth/password.js'
import { normalizeEmail } from '../_lib/auth/policy.js'
import { allowSignup } from '../_lib/auth/rateLimit.js'
import { createUser, createVerifyToken, getUserByEmail } from '../_lib/auth/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const ip = getClientIp(req)
  if (!(await allowSignup(ip))) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' })
    return
  }

  const body = readJsonBody(req)
  const email = normalizeEmail(readString(body, 'email'))
  const password = readString(body, 'password')

  if (!email) {
    res.status(400).json({ error: 'Enter a valid email address.' })
    return
  }

  const passwordError = await validateNewPassword(password, { mfaEnabled: false, email })
  if (passwordError) {
    res.status(400).json({ error: passwordError })
    return
  }

  const existing = await getUserByEmail(email)
  if (existing) {
    await dummyVerify(password)
    await logAuthEvent({ type: 'signup_duplicate', ip, email, userId: existing.id })
    res.status(200).json({ ok: true, message: GENERIC_SIGNUP_OK })
    return
  }

  const user = await createUser({
    email,
    emailVerified: false,
    password: await hashPassword(password),
    totp: null,
    backupCodeHashes: [],
  })
  const token = await createVerifyToken(user.id)
  sendVerifyEmail(email, token)
  await logAuthEvent({ type: 'signup', ip, email, userId: user.id })

  res.status(200).json({ ok: true, message: GENERIC_SIGNUP_OK })
}
