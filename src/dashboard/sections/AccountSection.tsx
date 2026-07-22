interface AccountSectionProps {
  isDesktop: boolean
  displayName: string
  userId: string
  email: string
  onEmailChange: (email: string) => void
  onDisplayNameBlur: (value: string) => void
}

export function AccountSection({
  isDesktop,
  displayName,
  userId,
  email,
  onEmailChange,
  onDisplayNameBlur,
}: AccountSectionProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-5">
        <div>
          <label htmlFor="displayName" className="block text-xs font-sans text-gray-500 mb-2">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            defaultValue={displayName}
            onBlur={e => onDisplayNameBlur(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-sans text-gray-500 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
          />
        </div>
        <div>
          <p className="text-xs font-sans text-gray-500 mb-1">User ID</p>
          <code className="text-xs font-mono text-gray-400 break-all">{userId}</code>
        </div>
      </div>
      <p className="text-xs font-sans text-gray-500">
        Changes to display name are saved locally on this {isDesktop ? 'device' : 'browser'}.
      </p>
    </div>
  )
}
