interface SecuritySectionProps {
  isDesktop: boolean
  onSignOut: () => void
}

export function SecuritySection({ isDesktop, onSignOut }: SecuritySectionProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
        <div>
          <p className="text-sm font-sans text-white mb-1">Password</p>
          <p className="text-xs font-sans text-gray-500 mb-3">
            Last changed — not available in this demo build.
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-white/15 text-sm font-sans text-gray-200 hover:bg-white/5 cursor-pointer bg-transparent"
          >
            Change password
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
        <div>
          <p className="text-sm font-sans text-white mb-1">Sessions</p>
          <p className="text-xs font-sans text-gray-500 mb-3">
            {isDesktop
              ? 'You are signed in locally on this device.'
              : 'You are signed in on this browser only (local demo account).'}
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
