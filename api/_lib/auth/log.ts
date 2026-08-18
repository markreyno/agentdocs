import { getRedis } from '../redis.js'
import { STUFFING_ALERT_THRESHOLD, STUFFING_ALERT_WINDOW_MS } from './constants.js'
import type { AuthEvent } from './types.js'

const memoryEvents: AuthEvent[] = []
const MAX_EVENTS = 500

export async function logAuthEvent(event: Omit<AuthEvent, 'at'> & { at?: number }): Promise<void> {
  const record: AuthEvent = { ...event, at: event.at ?? Date.now() }
  const line = JSON.stringify({ src: 'auth', ...record })
  if (record.type === 'credential_stuffing_pattern' || record.type === 'lockout') {
    console.warn(line)
  } else {
    console.info(line)
  }

  const redis = getRedis()
  if (redis) {
    await redis.lpush('auth:events', record)
    await redis.ltrim('auth:events', 0, MAX_EVENTS - 1)
    return
  }
  memoryEvents.unshift(record)
  if (memoryEvents.length > MAX_EVENTS) memoryEvents.length = MAX_EVENTS
}

const recentFailures: number[] = []

export async function noteGlobalFailure(): Promise<void> {
  const now = Date.now()
  recentFailures.push(now)
  while (recentFailures.length && now - recentFailures[0]! > STUFFING_ALERT_WINDOW_MS) {
    recentFailures.shift()
  }
  if (recentFailures.length === STUFFING_ALERT_THRESHOLD) {
    await logAuthEvent({
      type: 'credential_stuffing_pattern',
      ip: 'aggregate',
      detail: `${recentFailures.length} failures in ${STUFFING_ALERT_WINDOW_MS / 1000}s`,
    })
  }
}
