import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENERIC_LOGIN_ERROR } from '../../_lib/auth/constants.js'
import { beginAuthRoute, getClientIp, loadSessionUser, readJsonBody, readString } from '../../_lib/auth/http.js'
import { logAuthEvent } from '../../_lib/auth/log.js'
import { sendSecurityNotice } from '../../_lib/auth/mail.js'
import { verifyPassword } from '../../_lib/auth/password.js'
import { minPasswordLength } from '../../_lib/auth/policy.js'
import { saveUser } from '../../_lib/auth/store.js'
import { verifyTotp } from '../../_lib/auth/totp.js'
import { toPublicUser } from '../../_lib/auth/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const loaded = await loadSessionUser(req)
  if (!loaded) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  if (!loaded.user.totp?.enabled) {
    res.status(400).json({ error: 'Authenticator app is not enabled.' })
    return
  }

  const body = readJsonBody(req)
  const password = readString(body, 'password')
  const code = readString(body, 'code')

  if (!(await verifyPassword(password, loaded.user.password))) {
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  if (password.length < minPasswordLength(false)) {
    res.status(400).json({
      error: `Set a password of at least ${minPasswordLength(false)} characters before turning off your authenticator app.`,
    })
    return
  }

  if (!verifyTotp(loaded.user.totp.secretBase32, code)) {
    res.status(401).json({ error: 'Enter a valid authenticator code.' })
    return
  }

  loaded.user.totp = null
  loaded.user.backupCodeHashes = []
  await saveUser(loaded.user)
  sendSecurityNotice(
    loaded.user.email,
    'Authenticator app removed from your agentdocs account',
    'Two-factor authentication was turned off on your account.\n',
  )
  await logAuthEvent({
    type: 'mfa_disable',
    ip: getClientIp(req),
    email: loaded.user.email,
    userId: loaded.user.id,
  })
  res.json({ ok: true, user: toPublicUser(loaded.user) })
}
