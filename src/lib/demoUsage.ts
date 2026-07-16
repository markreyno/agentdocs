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
 * Reconciles the locally-cached use count against the API server's actual state.
 * The server's usage counter lives in memory and resets on restart/redeploy, but
 * this client-side count persists in localStorage — without this check, a stale
 * "limit reached" cached from a previous server process can lock the UI out
 * forever even though the server would happily accept fresh requests. Call this
 * before trusting isDemoLimitReached() for anything user-facing (e.g. on mount).
 */
export async function syncDemoUsageWithServer(): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/demo-status')
  } catch {
    return
  }
  if (!response.ok) return

  let body: { epoch?: string; remaining?: number }
  try {
    body = await response.json()
  } catch {
    return
  }
  if (typeof body.epoch !== 'string' || typeof body.remaining !== 'number') return

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
