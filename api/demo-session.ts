import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEMO_ENABLED } from './_lib/config.js'
import { enforceAllowedOrigin, handleOptions } from './_lib/cors.js'
import { assertStoreAvailable } from './_lib/redis.js'
import { getClientIp } from './_lib/request.js'
import { getServerEpoch, mintSession, remainingForIp } from './_lib/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!enforceAllowedOrigin(req, res)) return

  const storeError = assertStoreAvailable()
  if (storeError) {
    res.status(503).json({ error: storeError, remaining: 0, enabled: false })
    return
  }

  const epoch = await getServerEpoch()
  if (!DEMO_ENABLED) {
    res.status(503).json({
      error: 'Demo chat is disabled (ANTHROPIC_API_KEY not configured).',
      epoch,
      remaining: 0,
      enabled: false,
    })
    return
  }

  const ip = getClientIp(req)
  const session = await mintSession(ip)
  if (!session) {
    res.status(429).json({ error: 'Too many demo sessions from this network. Try again later.' })
    return
  }

  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    epoch,
    remaining: await remainingForIp(ip),
    enabled: true,
  })
}
