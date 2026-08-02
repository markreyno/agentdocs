import { Redis } from '@upstash/redis'

let redis: Redis | null | undefined

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1'
}

/** Returns Upstash Redis client, or null when env is not configured. */
export function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    redis = null
    return null
  }
  redis = new Redis({ url, token })
  return redis
}

/** On Vercel, Redis is required so sessions/limits are shared across instances. */
export function assertStoreAvailable(): string | null {
  if (isVercelRuntime() && !getRedis()) {
    return 'Demo API requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on Vercel.'
  }
  return null
}
