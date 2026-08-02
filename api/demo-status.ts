import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEMO_ENABLED } from './_lib/config'
import { enforceAllowedOrigin, handleOptions } from './_lib/cors'
import { assertStoreAvailable } from './_lib/redis'
import { getClientIp } from './_lib/request'
import { getServerEpoch, remainingForIp } from './_lib/store'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
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
    res.json({ epoch, remaining: 0, enabled: false })
    return
  }

  res.json({
    epoch,
    remaining: await remainingForIp(getClientIp(req)),
    enabled: true,
  })
}
