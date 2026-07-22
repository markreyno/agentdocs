interface PreferencesSectionProps {
  theme: string
  onToggleTheme: () => void
}

export function PreferencesSection({ theme, onToggleTheme }: PreferencesSectionProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-sans text-white">Appearance</p>
          <p className="text-xs font-sans text-gray-500 mt-1">
            Current theme: {theme === 'dark' ? 'Dark' : 'Light'}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="px-4 py-2 rounded-lg border border-white/15 text-sm font-sans text-gray-200 hover:bg-white/5 cursor-pointer bg-transparent"
        >
          Switch to {theme === 'dark' ? 'light' : 'dark'}
        </button>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
        <p className="text-sm font-sans text-white">Editor defaults</p>
        <label className="flex items-center gap-3 text-sm font-sans text-gray-400 cursor-pointer">
          <input type="checkbox" defaultChecked className="accent-indigo-500" />
          Open agent sidebar by default
        </label>
        <label className="flex items-center gap-3 text-sm font-sans text-gray-400 cursor-pointer">
          <input type="checkbox" defaultChecked className="accent-indigo-500" />
          Autosave documents
        </label>
      </div>
    </div>
  )
}
