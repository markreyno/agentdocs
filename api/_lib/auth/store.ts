import { randomBytes, randomUUID } from 'node:crypto'
import { secondsFromMs } from '../config.js'
import {
  MAX_SESSIONS_PER_USER,
  MFA_PENDING_TTL_MS,
  RESET_TOKEN_TTL_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  VERIFY_TOKEN_TTL_MS,
} from './constants.js'
import { kvDel, kvGet, kvSet, setAdd, setClear, setMembers, setRemove } from './kv.js'
import type { MfaPending, SessionRecord, UserRecord } from './types.js'

function userKey(id: string) {
  return `auth:user:${id}`
}
function emailKey(email: string) {
  return `auth:email:${email}`
}
function sessionKey(token: string) {
  return `auth:session:${token}`
}
function userSessionsKey(userId: string) {
  return `auth:sessions:${userId}`
}
function verifyKey(token: string) {
  return `auth:verify:${token}`
}
function resetKey(token: string) {
  return `auth:reset:${token}`
}
function mfaPendingKey(token: string) {
  return `auth:mfa-pending:${token}`
}

export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  return kvGet<UserRecord>(userKey(id))
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const id = await kvGet<string>(emailKey(email))
  if (!id) return null
  return getUserById(id)
}

export async function saveUser(user: UserRecord): Promise<void> {
  await kvSet(userKey(user.id), user)
  await kvSet(emailKey(user.email), user.id)
}

export async function createUser(input: Omit<UserRecord, 'id' | 'createdAt' | 'passwordChangedAt'> & {
  id?: string
  createdAt?: number
  passwordChangedAt?: number
}): Promise<UserRecord> {
  const now = Date.now()
  const user: UserRecord = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? now,
    passwordChangedAt: input.passwordChangedAt ?? now,
  }
  await saveUser(user)
  return user
}

export async function createVerifyToken(userId: string): Promise<string> {
  const token = newOpaqueToken()
  await kvSet(verifyKey(token), { userId }, secondsFromMs(VERIFY_TOKEN_TTL_MS))
  return token
}

export async function consumeVerifyToken(token: string): Promise<string | null> {
  const stored = await kvGet<{ userId: string }>(verifyKey(token))
  if (!stored?.userId) return null
  await kvDel(verifyKey(token))
  return stored.userId
}

export async function createResetToken(userId: string): Promise<string> {
  const token = newOpaqueToken()
  await kvSet(resetKey(token), { userId }, secondsFromMs(RESET_TOKEN_TTL_MS))
  return token
}

export async function consumeResetToken(token: string): Promise<string | null> {
  const stored = await kvGet<{ userId: string }>(resetKey(token))
  if (!stored?.userId) return null
  await kvDel(resetKey(token))
  return stored.userId
}

export async function peekResetToken(token: string): Promise<string | null> {
  const stored = await kvGet<{ userId: string }>(resetKey(token))
  return stored?.userId ?? null
}

export async function createMfaPending(userId: string, ip: string): Promise<string> {
  const token = newOpaqueToken()
  const pending: MfaPending = { userId, ip, expiresAt: Date.now() + MFA_PENDING_TTL_MS }
  await kvSet(mfaPendingKey(token), pending, secondsFromMs(MFA_PENDING_TTL_MS))
  return token
}

export async function getMfaPending(token: string): Promise<MfaPending | null> {
  const stored = await kvGet<MfaPending>(mfaPendingKey(token))
  if (!stored) return null
  if (stored.expiresAt <= Date.now()) {
    await kvDel(mfaPendingKey(token))
    return null
  }
  return stored
}

export async function consumeMfaPending(token: string): Promise<MfaPending | null> {
  const stored = await getMfaPending(token)
  if (!stored) return null
  await kvDel(mfaPendingKey(token))
  return stored
}

async function persistSession(session: SessionRecord): Promise<void> {
  const ttlMs = Math.max(1, Math.min(session.idleExpiresAt, session.absoluteExpiresAt) - Date.now())
  await kvSet(sessionKey(session.token), session, secondsFromMs(ttlMs))
  await setAdd(userSessionsKey(session.userId), session.token)
}

export async function createSession(
  userId: string,
  ip: string,
  userAgent: string,
): Promise<SessionRecord> {
  const now = Date.now()
  const session: SessionRecord = {
    token: newOpaqueToken(),
    userId,
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt: now + SESSION_IDLE_MS,
    absoluteExpiresAt: now + SESSION_ABSOLUTE_MS,
    ip,
    userAgent,
  }
  await persistSession(session)
  await enforceSessionCap(userId, session.token)
  return session
}

async function enforceSessionCap(userId: string, keepToken: string): Promise<void> {
  const tokens = await setMembers(userSessionsKey(userId))
  if (tokens.length <= MAX_SESSIONS_PER_USER) return
  const sessions: SessionRecord[] = []
  for (const token of tokens) {
    const session = await kvGet<SessionRecord>(sessionKey(token))
    if (!session) {
      await setRemove(userSessionsKey(userId), token)
      continue
    }
    sessions.push(session)
  }
  sessions.sort((a, b) => a.createdAt - b.createdAt)
  while (sessions.length > MAX_SESSIONS_PER_USER) {
    const oldest = sessions.shift()
    if (!oldest) break
    if (oldest.token === keepToken) {
      sessions.push(oldest)
      continue
    }
    await deleteSession(oldest.token)
  }
}

export async function getSession(token: string): Promise<SessionRecord | null> {
  return kvGet<SessionRecord>(sessionKey(token))
}

export async function touchSession(session: SessionRecord): Promise<SessionRecord | null> {
  const now = Date.now()
  if (now >= session.absoluteExpiresAt || now >= session.idleExpiresAt) {
    await deleteSession(session.token)
    return null
  }
  session.lastSeenAt = now
  session.idleExpiresAt = now + SESSION_IDLE_MS
  if (session.idleExpiresAt > session.absoluteExpiresAt) {
    session.idleExpiresAt = session.absoluteExpiresAt
  }
  await persistSession(session)
  return session
}

export async function deleteSession(token: string): Promise<void> {
  const session = await kvGet<SessionRecord>(sessionKey(token))
  await kvDel(sessionKey(token))
  if (session) await setRemove(userSessionsKey(session.userId), token)
}

export async function deleteAllSessions(userId: string, exceptToken?: string): Promise<void> {
  const tokens = await setMembers(userSessionsKey(userId))
  for (const token of tokens) {
    if (exceptToken && token === exceptToken) continue
    await kvDel(sessionKey(token))
    await setRemove(userSessionsKey(userId), token)
  }
  if (!exceptToken) await setClear(userSessionsKey(userId))
}

export async function rotateSession(
  previous: SessionRecord | null,
  userId: string,
  ip: string,
  userAgent: string,
): Promise<SessionRecord> {
  if (previous) await deleteSession(previous.token)
  return createSession(userId, ip, userAgent)
}

export function remainingCookieSec(session: SessionRecord): number {
  return secondsFromMs(Math.max(1, Math.min(session.idleExpiresAt, session.absoluteExpiresAt) - Date.now()))
}
