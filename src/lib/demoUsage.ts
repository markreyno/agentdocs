export const DEMO_USAGE_LIMIT = 5

const STORAGE_KEY = 'agentdocs:demo-uses'

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
