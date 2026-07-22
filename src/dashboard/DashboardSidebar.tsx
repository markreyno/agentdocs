import { NAV_ITEMS, WEB_GATED_SECTIONS } from './constants'
import type { DashboardSection } from './types'

interface DashboardSidebarProps {
  isDesktop: boolean
  sidebarOpen: boolean
  section: DashboardSection
  displayName: string
  email: string
  onNavigate: (id: DashboardSection) => void
  onClose: () => void
}

export function DashboardSidebar({
  isDesktop,
  sidebarOpen,
  section,
  displayName,
  email,
  onNavigate,
  onClose,
}: DashboardSidebarProps) {
  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-20 bg-black/50 border-none cursor-pointer"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-[57px] z-20
          h-[calc(100vh-57px)] w-64 shrink-0
          border-r border-white/8 bg-[#0f0f0f]/95 backdrop-blur-md
          overflow-y-auto
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-4 py-6 space-y-6">
          <div className="px-2">
            <p className="text-sm font-sans text-white truncate">{displayName}</p>
            <p className="text-xs font-sans text-gray-500 truncate">{email}</p>
          </div>

          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 text-[11px] font-sans font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {group}
              </p>
              <nav className="flex flex-col gap-0.5" aria-label={group}>
                {items.map(item => {
                  const active = item.id === section
                  const webGated = isDesktop && WEB_GATED_SECTIONS.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`
                        text-left px-3 py-2 rounded-md text-sm font-sans transition-colors cursor-pointer border-none
                        ${active
                          ? 'bg-white/10 text-white'
                          : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'}
                      `}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>{item.label}</span>
                        {webGated && (
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">
                            Web
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
