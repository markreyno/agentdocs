import { useState, type FormEvent } from 'react'
import {
  PASSWORD_MAX,
  PASSWORD_MIN_MFA,
  PASSWORD_MIN_SOLO,
  changePassword,
  confirmMfa,
  disableMfa,
  enrollMfa,
  type AuthSessionInfo,
  type AuthUser,
} from '../../lib/authClient'

interface SecuritySectionProps {
  isDesktop: boolean
  account?: AuthUser | null
  session?: AuthSessionInfo | null
  onAccountUpdate?: (user: AuthUser) => void
  onSignOut: () => void
}

const inputClass =
  'w-full max-w-md px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30'
const secondaryBtn =
  'px-4 py-2 rounded-lg border border-white/15 text-sm font-sans text-gray-200 hover:bg-white/5 cursor-pointer bg-transparent disabled:opacity-60'

export function SecuritySection({
  isDesktop,
  account,
  session,
  onAccountUpdate,
  onSignOut,
}: SecuritySectionProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null)

  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaInfo, setMfaInfo] = useState<string | null>(null)

  const minLen = account?.mfaEnabled ? PASSWORD_MIN_MFA : PASSWORD_MIN_SOLO
  const lastChanged = account?.passwordChangedAt
    ? new Date(account.passwordChangedAt).toLocaleString()
    : isDesktop
      ? 'Managed on this device'
      : 'Not available'

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordInfo(null)
    setPasswordBusy(true)
    try {
      const result = await changePassword({
        currentPassword,
        password: newPassword,
        totpCode: account?.mfaEnabled ? totpCode : undefined,
      })
      if (result.error) setPasswordError(result.error)
      else {
        setPasswordInfo('Password updated. Other sessions were signed out.')
        setCurrentPassword('')
        setNewPassword('')
        setTotpCode('')
        if (result.user) onAccountUpdate?.(result.user)
      }
    } finally {
      setPasswordBusy(false)
    }
  }

  async function handleEnroll() {
    setMfaError(null)
    setMfaInfo(null)
    setMfaBusy(true)
    try {
      const result = await enrollMfa()
      if (result.error || !result.secret) setMfaError(result.error ?? 'Could not start authenticator setup.')
      else {
        setMfaSecret(result.secret)
        setOtpauthUrl(result.otpauthUrl ?? null)
      }
    } finally {
      setMfaBusy(false)
    }
  }

  async function handleConfirmMfa(event: FormEvent) {
    event.preventDefault()
    setMfaError(null)
    setMfaBusy(true)
    try {
      const result = await confirmMfa(mfaCode)
      if (result.error) setMfaError(result.error)
      else {
        setBackupCodes(result.backupCodes ?? [])
        setMfaSecret(null)
        setOtpauthUrl(null)
        setMfaCode('')
        setMfaInfo('Authenticator app enabled. Store these backup codes somewhere safe.')
        if (result.user) onAccountUpdate?.(result.user)
      }
    } finally {
      setMfaBusy(false)
    }
  }

  async function handleDisableMfa(event: FormEvent) {
    event.preventDefault()
    setMfaError(null)
    setMfaBusy(true)
    try {
      const result = await disableMfa(disablePassword, disableCode)
      if (result.error) setMfaError(result.error)
      else {
        setMfaInfo('Authenticator app turned off.')
        setDisablePassword('')
        setDisableCode('')
        if (result.user) onAccountUpdate?.(result.user)
      }
    } finally {
      setMfaBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
        <div>
          <p className="text-sm font-sans text-white mb-1">Password</p>
          <p className="text-xs font-sans text-gray-500 mb-3">Last changed {lastChanged}.</p>
          {account ? (
            <form className="space-y-3" onSubmit={e => void handleChangePassword(e)}>
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="Current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={minLen}
                maxLength={PASSWORD_MAX}
                placeholder={`New passphrase (${minLen}+ characters)`}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={inputClass}
              />
              {account.mfaEnabled && (
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="Authenticator code"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value)}
                  className={inputClass}
                />
              )}
              {passwordError && <p className="text-xs font-sans text-red-300">{passwordError}</p>}
              {passwordInfo && <p className="text-xs font-sans text-indigo-200">{passwordInfo}</p>}
              <button type="submit" className={secondaryBtn} disabled={passwordBusy}>
                {passwordBusy ? 'Saving…' : 'Change password'}
              </button>
            </form>
          ) : (
            <p className="text-xs font-sans text-gray-500">Sign in on the web to change your cloud password.</p>
          )}
        </div>
      </div>

      {account && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
          <p className="text-sm font-sans text-white mb-1">Authenticator app</p>
          <p className="text-xs font-sans text-gray-500">
            {account.mfaEnabled
              ? 'A TOTP authenticator is enabled. Passkeys are preferred when you add them later; SMS is not offered.'
              : 'Add an authenticator app. After it is enabled, passwords may be as short as 8 characters.'}
          </p>
          {!account.mfaEnabled && !mfaSecret && (
            <button type="button" className={secondaryBtn} disabled={mfaBusy} onClick={() => void handleEnroll()}>
              {mfaBusy ? 'Starting…' : 'Enable authenticator'}
            </button>
          )}
          {mfaSecret && (
            <form className="space-y-3" onSubmit={e => void handleConfirmMfa(e)}>
              <p className="text-xs font-sans text-gray-400 break-all">
                Secret: <code className="font-mono text-gray-200">{mfaSecret}</code>
              </p>
              {otpauthUrl && (
                <p className="text-xs font-sans text-gray-500 break-all">
                  Add this in your app: <code className="font-mono text-gray-400">{otpauthUrl}</code>
                </p>
              )}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="Code from authenticator"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                className={inputClass}
              />
              <button type="submit" className={secondaryBtn} disabled={mfaBusy}>
                Confirm
              </button>
            </form>
          )}
          {backupCodes && (
            <ul className="grid grid-cols-2 gap-1 text-xs font-mono text-gray-300">
              {backupCodes.map(code => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          )}
          {account.mfaEnabled && (
            <form className="space-y-3" onSubmit={e => void handleDisableMfa(e)}>
              <p className="text-xs font-sans text-gray-500">
                Turning this off requires your password (at least {PASSWORD_MIN_SOLO} characters) and a current
                authenticator code.
              </p>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={PASSWORD_MIN_SOLO}
                placeholder="Password"
                value={disablePassword}
                onChange={e => setDisablePassword(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="Authenticator code"
                value={disableCode}
                onChange={e => setDisableCode(e.target.value)}
                className={inputClass}
              />
              <button type="submit" className={secondaryBtn} disabled={mfaBusy}>
                Turn off authenticator
              </button>
            </form>
          )}
          {mfaError && <p className="text-xs font-sans text-red-300">{mfaError}</p>}
          {mfaInfo && <p className="text-xs font-sans text-indigo-200">{mfaInfo}</p>}
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
        <div>
          <p className="text-sm font-sans text-white mb-1">Sessions</p>
          <p className="text-xs font-sans text-gray-500 mb-3">
            {session
              ? `This browser session is idle-timeout and absolute-timeout enforced on the server. Signed in ${new Date(session.createdAt).toLocaleString()}.`
              : isDesktop
                ? 'You are signed in locally on this device.'
                : 'You are signed in on this browser.'}
          </p>
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 rounded-lg border border-red-500/30 text-sm font-sans text-red-300 hover:bg-red-500/10 cursor-pointer bg-transparent"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
