import { getRedis } from '../redis.js'

interface MemEntry {
  value: unknown
  expiresAt: number | null
}

const memory = new Map<string, MemEntry>()
const memorySets = new Map<string, Set<string>>()

function prune(now = Date.now()): void {
  for (const [key, entry] of memory) {
    if (entry.expiresAt != null && entry.expiresAt <= now) memory.delete(key)
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (redis) {
    const value = await redis.get<T>(key)
    return value ?? null
  }
  prune()
  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return entry.value as T
}

export async function kvSet(key: string, value: unknown, ttlSec?: number): Promise<void> {
  const redis = getRedis()
  if (redis) {
    if (ttlSec != null) await redis.set(key, value, { ex: ttlSec })
    else await redis.set(key, value)
    return
  }
  memory.set(key, {
    value,
    expiresAt: ttlSec != null ? Date.now() + ttlSec * 1000 : null,
  })
}

export async function kvDel(key: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(key)
    return
  }
  memory.delete(key)
}

export async function kvIncr(key: string, windowSec: number): Promise<number> {
  const redis = getRedis()
  if (redis) {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSec)
    return count
  }
  prune()
  const existing = memory.get(key)
  const now = Date.now()
  if (!existing || (existing.expiresAt != null && existing.expiresAt <= now)) {
    memory.set(key, { value: 1, expiresAt: now + windowSec * 1000 })
    return 1
  }
  const next = Number(existing.value) + 1
  existing.value = next
  return next
}

export async function setAdd(key: string, member: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.sadd(key, member)
    return
  }
  const set = memorySets.get(key) ?? new Set<string>()
  set.add(member)
  memorySets.set(key, set)
}

export async function setRemove(key: string, member: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.srem(key, member)
    return
  }
  memorySets.get(key)?.delete(member)
}

export async function setMembers(key: string): Promise<string[]> {
  const redis = getRedis()
  if (redis) {
    const members = await redis.smembers(key)
    return members.map(String)
  }
  return [...(memorySets.get(key) ?? [])]
}

export async function setClear(key: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(key)
    return
  }
  memorySets.delete(key)
}
