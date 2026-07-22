import {
  formatRelativeTime,
  type DocumentRecord,
} from '../../lib/documents'
import { MOCK_BILLING, MOCK_USAGE, WEB_GATED_SECTIONS } from '../constants'
import type { DashboardSection } from '../types'

interface OverviewSectionProps {
  isDesktop: boolean
  documents: DocumentRecord[]
  skillsCount: number
  theme: string
  openingWeb: boolean
  onOpenWebSignIn: () => void
  onOpenEditor?: () => void
  onNavigate: (id: DashboardSection) => void
}

export function OverviewSection({
  isDesktop,
  documents,
  skillsCount,
  theme,
  openingWeb,
  onOpenWebSignIn,
  onOpenEditor,
  onNavigate,
}: OverviewSectionProps) {
  const stats = isDesktop
    ? [
        { label: 'Documents', value: String(documents.length) },
        { label: 'Skills', value: String(skillsCount) },
        { label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light' },
      ]
    : [
        { label: 'Plan', value: MOCK_BILLING.plan },
        { label: 'Frontier requests', value: String(MOCK_USAGE.frontier.requests) },
        { label: 'Local requests', value: String(MOCK_USAGE.local.requests) },
      ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <p className="text-xs font-sans text-gray-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-sans font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {isDesktop && (
        <section className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
          <h2 className="text-sm font-sans font-semibold text-white mb-1">Cloud account</h2>
          <p className="text-sm font-sans text-gray-400 mb-4">
            Billing, usage history, and password settings are managed after you sign in on the web.
          </p>
          <button
            type="button"
            onClick={onOpenWebSignIn}
            disabled={openingWeb}
            className="px-4 py-2 rounded-lg border border-white/15 text-sm font-sans text-gray-200 hover:bg-white/5 cursor-pointer bg-transparent disabled:opacity-60"
          >
            {openingWeb ? 'Opening browser…' : 'Sign in on the web'}
          </button>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-sans font-semibold text-white">Recent documents</h2>
          {onOpenEditor && (
            <button
              type="button"
              onClick={onOpenEditor}
              className="text-xs font-sans text-indigo-300 hover:text-indigo-200 cursor-pointer bg-none border-none"
            >
              {isDesktop ? 'Back to home' : 'New document'}
            </button>
          )}
        </div>
        {documents.length === 0 ? (
          <p className="text-sm font-sans text-gray-500 py-6 border border-dashed border-white/10 rounded-xl text-center">
            No documents yet. Open the editor to create one.
          </p>
        ) : (
          <ul className="divide-y divide-white/8 rounded-xl border border-white/8 overflow-hidden">
            {documents.slice(0, 5).map(doc => (
              <li key={doc.id} className="flex items-center justify-between px-4 py-3 bg-white/[0.02]">
                <span className="text-sm font-sans text-gray-200 truncate">{doc.title}</span>
                <span className="text-xs font-sans text-gray-500 shrink-0 ml-4">
                  {formatRelativeTime(doc.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-sans font-semibold text-white mb-3">Quick links</h2>
        <div className="flex flex-wrap gap-2">
          {(['account', 'billing', 'usage', 'skills'] as DashboardSection[]).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="px-3 py-1.5 rounded-md border border-white/10 text-xs font-sans text-gray-300 hover:bg-white/5 cursor-pointer bg-transparent capitalize"
            >
              {id}
              {isDesktop && WEB_GATED_SECTIONS.has(id) ? ' · web' : ''}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
