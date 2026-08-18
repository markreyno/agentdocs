import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginAuthRoute, getClientIp, loadSessionUser, readJsonBody, readString } from '../../_lib/auth/http.js'
import { logAuthEvent } from '../../_lib/auth/log.js'
import { sendSecurityNotice } from '../../_lib/auth/mail.js'
import { hashBackupCode } from '../../_lib/auth/password.js'
import { saveUser } from '../../_lib/auth/store.js'
import { randomBackupCodes, verifyTotp } from '../../_lib/auth/totp.js'
import { toPublicUser } from '../../_lib/auth/types.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const loaded = await loadSessionUser(req)
  if (!loaded) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  const pending = loaded.user.totp?.pendingSecretBase32
  if (!pending) {
    res.status(400).json({ error: 'Start authenticator setup first.' })
    return
  }

  const code = readString(readJsonBody(req), 'code')
  if (!verifyTotp(pending, code)) {
    res.status(401).json({ error: 'Invalid authenticator code.' })
    return
  }

  const backupCodes = randomBackupCodes()
  loaded.user.totp = {
    secretBase32: pending,
    enabled: true,
    enrolledAt: Date.now(),
  }
  loaded.user.backupCodeHashes = backupCodes.map(code => hashBackupCode(code))
  await saveUser(loaded.user)
  sendSecurityNotice(
    loaded.user.email,
    'Authenticator app enabled on your agentdocs account',
    'An authenticator app was added to your account. Store your backup codes somewhere safe.\n',
  )
  await logAuthEvent({
    type: 'mfa_enroll',
    ip: getClientIp(req),
    email: loaded.user.email,
    userId: loaded.user.id,
  })
  res.json({ ok: true, user: toPublicUser(loaded.user), backupCodes })
}
