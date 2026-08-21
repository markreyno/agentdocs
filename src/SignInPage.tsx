import { useEffect, useState, type FormEvent } from 'react'
import BrandLogo from './BrandLogo'
import {
  PASSWORD_MAX,
  PASSWORD_MIN_SOLO,
  completeMfa,
  forgotPassword,
  resetPassword,
  signIn,
  signUp,
  verifyEmail,
  type AuthUser,
} from './lib/authClient'

export type SignInMode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' | 'mfa'

interface SignInPageProps {
  onBack: () => void
  onSignedIn: (user: AuthUser) => void
  mode: SignInMode
  onMode: (mode: SignInMode) => void
  token?: string
}

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans placeholder:text-gray-600 focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 transition-colors'
const buttonClass =
  'w-full px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed'
const linkClass = 'text-indigo-300 hover:text-indigo-200 cursor-pointer bg-none border-none p-0 font-sans text-sm'

export default function SignInPage({ onBack, onSignedIn, mode, onMode, token }: SignInPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setInfo(null)
    setPassword('')
    setConfirm('')
    setCode('')
  }, [mode])

  useEffect(() => {
    if (mode !== 'verify' || !token) return
    let cancelled = false
    setBusy(true)
    void verifyEmail(token)
      .then(result => {
        if (cancelled) return
        if (result.error) setError(result.error)
        else setInfo(result.message ?? 'Email verified. You can sign in.')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, token])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (password !== confirm) {
          setError('Passwords do not match.')
          return
        }
        const result = await signUp(email, password)
        if (!result.ok) setError(result.error ?? 'Could not create account.')
        else setInfo(result.message ?? 'Check for a verification link.')
        return
      }
      if (mode === 'forgot') {
        const result = await forgotPassword(email)
        if (result.error && !result.ok) setError(result.error)
        else setInfo(result.message ?? 'If an account exists, we sent a reset link.')
        return
      }
      if (mode === 'reset') {
        if (!token) {
          setError('This reset link is invalid or has expired.')
          return
        }
        if (password !== confirm) {
          setError('Passwords do not match.')
          return
        }
        const result = await resetPassword(token, password)
        if (result.error) setError(result.error)
        else {
          setInfo(result.message ?? 'Password updated. You can sign in.')
          onMode('signin')
        }
        return
      }
      if (mode === 'mfa') {
        const result = await completeMfa(code)
        if (result.error || !result.user) setError(result.error ?? 'Invalid authenticator code.')
        else onSignedIn(result.user)
        return
      }
      const result = await signIn(email, password)
      if (result.mfaRequired) {
        onMode('mfa')
        return
      }
      if (result.error || !result.user) setError(result.error ?? 'Invalid email or password')
      else onSignedIn(result.user)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'signup'
      ? 'Create account'
      : mode === 'forgot'
        ? 'Forgot password'
        : mode === 'reset'
          ? 'Set a new password'
          : mode === 'verify'
            ? 'Verify email'
            : mode === 'mfa'
              ? 'Authenticator code'
              : 'Sign in'

  const subtitle =
    mode === 'signup'
      ? 'Use a passphrase of at least 15 characters. Mixed character types are optional.'
      : mode === 'forgot'
        ? 'We will send a single-use, time-limited link to the email on file.'
        : mode === 'reset'
          ? `Choose a passphrase of at least ${PASSWORD_MIN_SOLO} characters.`
          : mode === 'verify'
            ? 'Confirming your email so it can be used to sign in.'
            : mode === 'mfa'
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Welcome back to agentdocs'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      <nav className="flex items-center justify-between px-12 py-5 border-b border-white/8">
        <BrandLogo />
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 rounded-md border border-white/30 text-gray-200 text-sm font-sans hover:bg-white/10 transition-colors cursor-pointer"
        >
          ← Back
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">{title}</h1>
          <p className="text-gray-400 text-sm font-sans text-center mb-8">{subtitle}</p>

          {mode !== 'verify' && (
            <form className="space-y-5" onSubmit={e => void handleSubmit(e)} autoComplete="on">
              {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
                <div>
                  <label htmlFor="email" className="block text-sm text-gray-400 font-sans mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </div>
              )}

              {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
                <div>
                  <label htmlFor="password" className="block text-sm text-gray-400 font-sans mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    spellCheck={false}
                    required
                    minLength={mode === 'signup' ? PASSWORD_MIN_SOLO : undefined}
                    maxLength={PASSWORD_MAX}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Passphrase"
                  />
                  {mode !== 'signin' && (
                    <p className="mt-2 text-xs font-sans text-gray-500">
                      At least {PASSWORD_MIN_SOLO} characters. Paste is allowed so a password manager can fill this
                      field. Do not reuse a password from a breach.
                    </p>
                  )}
                </div>
              )}

              {(mode === 'signup' || mode === 'reset') && (
                <div>
                  <label htmlFor="confirm" className="block text-sm text-gray-400 font-sans mb-2">
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    required
                    maxLength={PASSWORD_MAX}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className={inputClass}
                    placeholder="Repeat passphrase"
                  />
                </div>
              )}

              {mode === 'mfa' && (
                <div>
                  <label htmlFor="code" className="block text-sm text-gray-400 font-sans mb-2">
                    Authenticator code
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className={inputClass}
                    placeholder="123456"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm font-sans text-red-300" role="alert">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm font-sans text-indigo-200" role="status">
                  {info}
                </p>
              )}

              <button type="submit" className={buttonClass} disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'signup'
                    ? 'Create account'
                    : mode === 'forgot'
                      ? 'Send reset link'
                      : mode === 'reset'
                        ? 'Update password'
                        : mode === 'mfa'
                          ? 'Continue'
                          : 'Sign in'}
              </button>
            </form>
          )}

          {mode === 'verify' && (
            <div className="space-y-4 text-center">
              {busy && <p className="text-sm font-sans text-gray-400">Verifying…</p>}
              {error && (
                <p className="text-sm font-sans text-red-300" role="alert">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm font-sans text-indigo-200" role="status">
                  {info}
                </p>
              )}
              <button type="button" className={buttonClass} onClick={() => onMode('signin')}>
                Continue to sign in
              </button>
            </div>
          )}

          <div className="mt-6 space-y-2 text-center">
            {mode === 'signin' && (
              <>
                <p className="text-sm font-sans text-gray-500">
                  No account?{' '}
                  <button type="button" className={linkClass} onClick={() => onMode('signup')}>
                    Create one
                  </button>
                </p>
                <p className="text-sm font-sans text-gray-500">
                  <button type="button" className={linkClass} onClick={() => onMode('forgot')}>
                    Forgot password?
                  </button>
                </p>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot' || mode === 'mfa') && (
              <p className="text-sm font-sans text-gray-500">
                <button type="button" className={linkClass} onClick={() => onMode('signin')}>
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
