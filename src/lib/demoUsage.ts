import { mintDemoSession } from './demoSession'

export const DEMO_USAGE_LIMIT = 5

const STORAGE_KEY = 'agentdocs:demo-uses'
const EPOCH_KEY = 'agentdocs:demo-epoch'

export function getDemoUseCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function incrementDemoUseCount(): number {
  const next = Math.min(getDemoUseCount() + 1, DEMO_USAGE_LIMIT)
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // ignore quota errors
  }
  return next
}

export function setDemoUseCountToLimit(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(DEMO_USAGE_LIMIT))
  } catch {
    // ignore quota errors
  }
}

export function isDemoLimitReached(): boolean {
  return getDemoUseCount() >= DEMO_USAGE_LIMIT
}

export function getRemainingDemoUses(): number {
  return Math.max(0, DEMO_USAGE_LIMIT - getDemoUseCount())
}

/**
 * Mints an ephemeral demo session (invisible to the user) and reconciles the
 * locally-cached use count against the API server. Call on web-demo mount
 * before trusting isDemoLimitReached() for anything user-facing.
 */
export async function syncDemoUsageWithServer(): Promise<void> {
  const body = await mintDemoSession()
  if (!body) return

  if (typeof body.epoch !== 'string') return

  // Server has demo chat turned off — treat as exhausted so UI shows download CTA.
  if (body.enabled === false || typeof body.remaining !== 'number') {
    try {
      localStorage.setItem(EPOCH_KEY, body.epoch)
      localStorage.setItem(STORAGE_KEY, String(DEMO_USAGE_LIMIT))
    } catch {
      // ignore quota errors
    }
    return
  }

  let storedEpoch: string | null = null
  try {
    storedEpoch = localStorage.getItem(EPOCH_KEY)
  } catch {
    return
  }

  if (storedEpoch === body.epoch) return

  try {
    localStorage.setItem(EPOCH_KEY, body.epoch)
    localStorage.setItem(STORAGE_KEY, String(Math.max(0, DEMO_USAGE_LIMIT - body.remaining)))
  } catch {
    // ignore quota errors
  }
}
