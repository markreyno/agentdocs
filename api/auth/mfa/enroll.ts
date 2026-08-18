import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginAuthRoute, loadSessionUser } from '../../_lib/auth/http.js'
import { otpauthUrl, randomTotpSecret } from '../../_lib/auth/totp.js'
import { saveUser } from '../../_lib/auth/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginAuthRoute(req, res, ['POST'])) return

  const loaded = await loadSessionUser(req)
  if (!loaded) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  if (loaded.user.totp?.enabled) {
    res.status(400).json({ error: 'Authenticator app is already enabled.' })
    return
  }

  const secret = randomTotpSecret()
  loaded.user.totp = {
    secretBase32: loaded.user.totp?.secretBase32 ?? secret,
    pendingSecretBase32: secret,
    enabled: false,
    enrolledAt: null,
  }
  await saveUser(loaded.user)

  res.json({
    ok: true,
    secret,
    otpauthUrl: otpauthUrl(loaded.user.email, secret),
  })
}
