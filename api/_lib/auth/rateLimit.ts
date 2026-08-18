import { secondsFromMs } from '../config.js'
import {
  ACCOUNT_FAIL_LIMIT,
  ACCOUNT_LOCK_MS,
  FORGOT_EMAIL_LIMIT,
  FORGOT_EMAIL_WINDOW_MS,
  FORGOT_IP_LIMIT,
  FORGOT_IP_WINDOW_MS,
  IP_FAIL_LIMIT,
  IP_FAIL_WINDOW_MS,
  SIGNUP_IP_LIMIT,
  SIGNUP_IP_WINDOW_MS,
} from './constants.js'
import { kvDel, kvGet, kvIncr, kvSet } from './kv.js'

function lockKey(email: string) {
  return `auth:lock:${email}`
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const until = await kvGet<number>(lockKey(email))
  return typeof until === 'number' && until > Date.now()
}

export async function clearAccountLock(email: string): Promise<void> {
  await kvDel(lockKey(email))
  await kvDel(`auth:rl:acct:${email}`)
}

export async function registerLoginFailure(email: string, ip: string): Promise<{ locked: boolean; ipBlocked: boolean }> {
  const ipCount = await kvIncr(`auth:rl:ip:${ip}`, secondsFromMs(IP_FAIL_WINDOW_MS))
  const ipBlocked = ipCount > IP_FAIL_LIMIT

  const acctCount = await kvIncr(`auth:rl:acct:${email}`, secondsFromMs(ACCOUNT_LOCK_MS))
  let locked = await isAccountLocked(email)
  if (acctCount >= ACCOUNT_FAIL_LIMIT && !locked) {
    const until = Date.now() + ACCOUNT_LOCK_MS
    await kvSet(lockKey(email), until, secondsFromMs(ACCOUNT_LOCK_MS))
    locked = true
  }
  return { locked, ipBlocked }
}

export async function ipOverLoginLimit(ip: string): Promise<boolean> {
  const count = await kvGet<number>(`auth:rl:ip:${ip}`)
  return typeof count === 'number' && count > IP_FAIL_LIMIT
}

export async function allowSignup(ip: string): Promise<boolean> {
  const count = await kvIncr(`auth:rl:signup-ip:${ip}`, secondsFromMs(SIGNUP_IP_WINDOW_MS))
  return count <= SIGNUP_IP_LIMIT
}

export async function allowForgot(email: string, ip: string): Promise<boolean> {
  const emailCount = await kvIncr(`auth:rl:forgot:${email}`, secondsFromMs(FORGOT_EMAIL_WINDOW_MS))
  const ipCount = await kvIncr(`auth:rl:forgot-ip:${ip}`, secondsFromMs(FORGOT_IP_WINDOW_MS))
  return emailCount <= FORGOT_EMAIL_LIMIT && ipCount <= FORGOT_IP_LIMIT
}
