export function appOrigin(): string {
  const fromEnv = process.env.AUTH_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (prod) return prod.startsWith('http') ? prod.replace(/\/$/, '') : `https://${prod}`
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:5173'
}

function deliver(to: string, subject: string, text: string): void {
  console.info(`[auth-mail] to=${to} subject=${subject}\n${text}`)
}

export function sendVerifyEmail(email: string, token: string): void {
  const url = `${appOrigin()}/#verify/${token}`
  deliver(
    email,
    'Verify your agentdocs email',
    `Verify your email by opening this single-use link (expires in 24 hours):\n${url}\n`,
  )
}

export function sendResetEmail(email: string, token: string): void {
  const url = `${appOrigin()}/#reset/${token}`
  deliver(
    email,
    'Reset your agentdocs password',
    `Reset your password with this single-use link (expires in 30 minutes):\n${url}\nIf you did not request this, you can ignore this message.\n`,
  )
}

export function sendSecurityNotice(email: string, subject: string, text: string): void {
  deliver(email, subject, text)
}
