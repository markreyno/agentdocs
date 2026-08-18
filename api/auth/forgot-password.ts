import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENERIC_FORGOT_OK } from '../_lib/auth/constants.js'
import { beginAuthRoute, getClientIp, readJsonBody, readString } from '../_lib/auth/http.js'
import { logAuthEvent } from '../_lib/auth/log.js'
import { sendResetEmail } from '../_lib/auth/mail.js'
import { normalizeEmail } from '../_lib/auth/policy.js'
import { allowForgot } from '../_lib/auth/rateLimit.js'
import { createResetToken, getUserByEmail } from '../_lib/auth/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const ip = getClientIp(req)
  const email = normalizeEmail(readString(readJsonBody(req), 'email'))

  if (!email) {
    res.status(200).json({ ok: true, message: GENERIC_FORGOT_OK })
    return
  }

  if (!(await allowForgot(email, ip))) {
    res.status(200).json({ ok: true, message: GENERIC_FORGOT_OK })
    return
  }

  const user = await getUserByEmail(email)
  if (user?.emailVerified) {
    const token = await createResetToken(user.id)
    sendResetEmail(email, token)
    await logAuthEvent({ type: 'password_reset_request', ip, email, userId: user.id })
  } else {
    await logAuthEvent({ type: 'password_reset_request', ip, email, detail: 'no_account_or_unverified' })
  }

  res.status(200).json({ ok: true, message: GENERIC_FORGOT_OK })
}
