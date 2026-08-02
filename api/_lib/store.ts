import { randomBytes, randomUUID } from 'node:crypto'
import {
  DEMO_RATE_LIMIT,
  DEMO_SESSION_MINT_LIMIT,
  DEMO_SESSION_MINT_WINDOW_MS,
  DEMO_SESSION_TTL_MS,
  DEMO_USAGE_TTL_MS,
  secondsFromMs,
} from './config'
import { getRedis } from './redis'

export interface DemoSession {
  token: string
  ip: string
  expiresAt: number
}

interface MintWindow {
  count: number
  windowStart: number
}

interface MemoryState {
  epoch: string
  usageByIp: Map<string, { count: number; expiresAt: number }>
  sessionsByToken: Map<string, DemoSession>
  ipSession: Map<string, string>
  mintByIp: Map<string, MintWindow>
}

const memory: MemoryState = {
  epoch: randomUUID(),
  usageByIp: new Map(),
  sessionsByToken: new Map(),
  ipSession: new Map(),
  mintByIp: new Map(),
}

function usageKey(ip: string) {
  return `demo:usage:${ip}`
}
function sessionKey(token: string) {
  return `demo:session:${token}`
}
function ipSessionKey(ip: string) {
  return `demo:ip-session:${ip}`
}
function mintKey(ip: string) {
  return `demo:mint:${ip}`
}

const EPOCH_KEY = 'demo:epoch'

export async function getServerEpoch(): Promise<string> {
  const fromEnv = process.env.DEMO_EPOCH?.trim()
  if (fromEnv) return fromEnv

  const redis = getRedis()
  if (!redis) return memory.epoch

  const existing = await redis.get<string>(EPOCH_KEY)
  if (existing) return existing

  const id = randomUUID()
  const created = await redis.set(EPOCH_KEY, id, { nx: true })
  if (created === 'OK') return id
  return (await redis.get<string>(EPOCH_KEY)) ?? id
}

export async function remainingForIp(ip: string): Promise<number> {
  const redis = getRedis()
  if (!redis) {
    pruneMemory()
    const entry = memory.usageByIp.get(ip)
    return Math.max(0, DEMO_RATE_LIMIT - (entry?.count ?? 0))
  }
  const count = Number((await redis.get<number | string>(usageKey(ip))) ?? 0)
  return Math.max(0, DEMO_RATE_LIMIT - count)
}

/** Atomically consume one demo use. Returns remaining after consume, or null if limit hit. */
export async function tryConsumeDemoUse(ip: string): Promise<number | null> {
  const redis = getRedis()
  if (!redis) {
    pruneMemory()
    const now = Date.now()
    const existing = memory.usageByIp.get(ip)
    const count = existing && existing.expiresAt > now ? existing.count : 0
    if (count >= DEMO_RATE_LIMIT) return null
    memory.usageByIp.set(ip, {
      count: count + 1,
      expiresAt: now + DEMO_USAGE_TTL_MS,
    })
    return DEMO_RATE_LIMIT - (count + 1)
  }

  const key = usageKey(ip)
  const next = await redis.incr(key)
  if (next === 1) {
    await redis.expire(key, secondsFromMs(DEMO_USAGE_TTL_MS))
  }
  if (next > DEMO_RATE_LIMIT) {
    await redis.decr(key)
    return null
  }
  return DEMO_RATE_LIMIT - next
}

async function canMintSession(ip: string): Promise<boolean> {
  const redis = getRedis()
  if (!redis) {
    const now = Date.now()
    const window = memory.mintByIp.get(ip)
    if (!window || now - window.windowStart >= DEMO_SESSION_MINT_WINDOW_MS) {
      memory.mintByIp.set(ip, { count: 1, windowStart: now })
      return true
    }
    if (window.count >= DEMO_SESSION_MINT_LIMIT) return false
    window.count += 1
    return true
  }

  const key = mintKey(ip)
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, secondsFromMs(DEMO_SESSION_MINT_WINDOW_MS))
  }
  return count <= DEMO_SESSION_MINT_LIMIT
}

export async function mintSession(ip: string): Promise<DemoSession | null> {
  const now = Date.now()
  const expiresAt = now + DEMO_SESSION_TTL_MS
  const ttlSec = secondsFromMs(DEMO_SESSION_TTL_MS)

  const redis = getRedis()
  if (!redis) {
    pruneMemory()
    const existingToken = memory.ipSession.get(ip)
    if (existingToken) {
      const existing = memory.sessionsByToken.get(existingToken)
      if (existing && existing.expiresAt > now && existing.ip === ip) return existing
    }
    if (!(await canMintSession(ip))) return null
    const session: DemoSession = {
      token: randomBytes(32).toString('base64url'),
      ip,
      expiresAt,
    }
    memory.sessionsByToken.set(session.token, session)
    memory.ipSession.set(ip, session.token)
    return session
  }

  const existingToken = await redis.get<string>(ipSessionKey(ip))
  if (existingToken) {
    const storedIp = await redis.get<string>(sessionKey(existingToken))
    if (storedIp === ip) {
      // Refresh TTLs on reuse
      await redis.expire(sessionKey(existingToken), ttlSec)
      await redis.expire(ipSessionKey(ip), ttlSec)
      const ttl = await redis.ttl(sessionKey(existingToken))
      return {
        token: existingToken,
        ip,
        expiresAt: ttl > 0 ? now + ttl * 1000 : expiresAt,
      }
    }
  }

  if (!(await canMintSession(ip))) return null

  const token = randomBytes(32).toString('base64url')
  await redis.set(sessionKey(token), ip, { ex: ttlSec })
  await redis.set(ipSessionKey(ip), token, { ex: ttlSec })
  return { token, ip, expiresAt }
}

export async function resolveSession(token: string, ip: string): Promise<DemoSession | null> {
  const now = Date.now()
  const redis = getRedis()

  if (!redis) {
    pruneMemory()
    const session = memory.sessionsByToken.get(token)
    if (!session) return null
    if (session.expiresAt <= now) {
      memory.sessionsByToken.delete(token)
      if (memory.ipSession.get(session.ip) === token) memory.ipSession.delete(session.ip)
      return null
    }
    if (session.ip !== ip) return null
    return session
  }

  const storedIp = await redis.get<string>(sessionKey(token))
  if (!storedIp || storedIp !== ip) return null

  const ttl = await redis.ttl(sessionKey(token))
  if (ttl <= 0) return null

  const ttlSec = secondsFromMs(DEMO_SESSION_TTL_MS)
  await redis.expire(sessionKey(token), ttlSec)
  await redis.expire(ipSessionKey(ip), ttlSec)

  return {
    token,
    ip,
    expiresAt: now + ttl * 1000,
  }
}

function pruneMemory(now = Date.now()): void {
  for (const [ip, entry] of memory.usageByIp) {
    if (entry.expiresAt <= now) memory.usageByIp.delete(ip)
  }
  for (const [token, session] of memory.sessionsByToken) {
    if (session.expiresAt <= now) {
      memory.sessionsByToken.delete(token)
      if (memory.ipSession.get(session.ip) === token) memory.ipSession.delete(session.ip)
    }
  }
}
