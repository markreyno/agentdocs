interface DashboardTopNavProps {
  isDesktop: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onBack: () => void
  onOpenEditor?: () => void
}

export function DashboardTopNav({
  isDesktop,
  sidebarOpen,
  onToggleSidebar,
  onBack,
  onOpenEditor,
}: DashboardTopNavProps) {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/8 bg-[#0f0f0f]/90 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer bg-transparent"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-xl font-bold tracking-tight text-white">agentdocs</span>
        <span className="hidden sm:inline text-xs font-sans text-gray-500 border-l border-white/10 pl-3 ml-1">
          {isDesktop ? 'Account' : 'Dashboard'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {onOpenEditor && (
          <button
            type="button"
            onClick={onOpenEditor}
            className="hidden sm:inline-flex text-sm text-gray-300 font-sans hover:text-white transition-colors cursor-pointer bg-none border-none"
          >
            Open editor
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-400 font-sans hover:text-white transition-colors cursor-pointer bg-none border-none"
        >
          ← Back
        </button>
      </div>
    </nav>
  )
}
