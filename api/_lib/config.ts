/** Demo API limits and feature flags (shared by all /api routes). */

export const DEMO_MAX_TOKENS = process.env.DEMO_MAX_TOKENS ? Number(process.env.DEMO_MAX_TOKENS) : 4096
export const DEMO_MAX_TOOL_ITERATIONS = process.env.DEMO_MAX_TOOL_ITERATIONS
  ? Number(process.env.DEMO_MAX_TOOL_ITERATIONS)
  : 6
export const DEMO_MAX_MESSAGES = process.env.DEMO_MAX_MESSAGES ? Number(process.env.DEMO_MAX_MESSAGES) : 12
export const DEMO_MAX_MESSAGE_CHARS = process.env.DEMO_MAX_MESSAGE_CHARS
  ? Number(process.env.DEMO_MAX_MESSAGE_CHARS)
  : 4_000

export const DEMO_RATE_LIMIT = 5
export const DEMO_MODEL = process.env.DEMO_MODEL ?? 'claude-haiku-4-5'

export const DEMO_SESSION_TTL_MS = process.env.DEMO_SESSION_TTL_MS
  ? Number(process.env.DEMO_SESSION_TTL_MS)
  : 20 * 60 * 1000
export const DEMO_SESSION_MINT_LIMIT = process.env.DEMO_SESSION_MINT_LIMIT
  ? Number(process.env.DEMO_SESSION_MINT_LIMIT)
  : 20
export const DEMO_SESSION_MINT_WINDOW_MS = process.env.DEMO_SESSION_MINT_WINDOW_MS
  ? Number(process.env.DEMO_SESSION_MINT_WINDOW_MS)
  : 60 * 60 * 1000

export const DEMO_USAGE_TTL_MS = process.env.DEMO_USAGE_TTL_MS
  ? Number(process.env.DEMO_USAGE_TTL_MS)
  : 24 * 60 * 60 * 1000

export const DEMO_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5183',
  'http://127.0.0.1:5183',
]

/** Strip optional wrapping quotes from a single env value. */
function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/** Current Vercel deployment / production hostnames as https origins. */
function vercelOrigins(): string[] {
  const hosts = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  const origins: string[] = []
  for (const host of hosts) {
    const value = host?.trim()
    if (!value) continue
    origins.push(value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`)
  }
  return origins
}

export function getAllowedOrigins(): Set<string> {
  const fromEnv = process.env.DEMO_ALLOWED_ORIGINS?.trim()
    ? process.env.DEMO_ALLOWED_ORIGINS.split(',').map(stripQuotes).filter(Boolean)
    : []
  // Always allow local defaults + this Vercel deployment; merge any extra origins from env.
  return new Set([...DEFAULT_ORIGINS, ...vercelOrigins(), ...fromEnv])
}

export function secondsFromMs(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000))
}
