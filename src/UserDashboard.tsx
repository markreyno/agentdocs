import { useEffect, useState } from 'react'
import {
  formatRelativeTime,
  getOrCreateUser,
  listRecentDocuments,
  updateUserDisplayName,
  type DocumentRecord,
  type LocalUser,
} from './lib/documents'
import { useSkills } from './lib/skills'
import { useTheme } from './lib/theme'
import { openWebSignIn } from './lib/webAccount'

interface UserDashboardProps {
  onBack: () => void
  onOpenEditor?: () => void
  /** Desktop shows local account info; billing/security open the web sign-in in the browser. */
  variant?: 'web' | 'desktop'
}

type DashboardSection =
  | 'overview'
  | 'account'
  | 'billing'
  | 'usage'
  | 'skills'
  | 'preferences'
  | 'security'

/** Sections that require the cloud account — desktop opens the web sign-in instead. */
const WEB_GATED_SECTIONS = new Set<DashboardSection>(['billing', 'usage', 'security'])

const NAV_ITEMS: { id: DashboardSection; label: string; group: string }[] = [
  { id: 'overview', label: 'Overview', group: 'General' },
  { id: 'account', label: 'Account', group: 'General' },
  { id: 'billing', label: 'Billing', group: 'General' },
  { id: 'usage', label: 'Usage', group: 'AI' },
  { id: 'skills', label: 'Skills', group: 'AI' },
  { id: 'preferences', label: 'Preferences', group: 'Settings' },
  { id: 'security', label: 'Security', group: 'Settings' },
]

const WEB_GATED_COPY: Record<'billing' | 'usage' | 'security', { title: string; body: string }> = {
  billing: {
    title: 'Manage billing on the web',
    body: 'Plans, invoices, and payment methods are handled in your agentdocs web account. Sign in in your browser to continue.',
  },
  usage: {
    title: 'View usage on the web',
    body: 'Frontier and local model usage history is available from your web account dashboard after you sign in.',
  },
  security: {
    title: 'Account security on the web',
    body: 'Password changes and session management require your web account. Sign in in your browser to continue.',
  },
}

/** Mock usage for dashboard prototyping — not wired to real metering yet. */
const MOCK_USAGE = {
  periodLabel: 'July 1 – July 11, 2026',
  frontier: {
    requests: 148,
    inputTokens: 412_800,
    outputTokens: 96_420,
    estimatedCost: 4.82,
    limit: 500,
    byProvider: [
      { name: 'Anthropic', requests: 92, tokens: 318_000 },
      { name: 'OpenAI', requests: 41, tokens: 142_200 },
      { name: 'Gemini', requests: 15, tokens: 49_020 },
    ],
  },
  local: {
    requests: 67,
    inputTokens: 188_400,
    outputTokens: 54_100,
    byModel: [
      { name: 'llama3.2', requests: 44, tokens: 156_000 },
      { name: 'mistral', requests: 23, tokens: 86_500 },
    ],
  },
}

const MOCK_BILLING = {
  plan: 'Pro',
  price: '$12 / month',
  status: 'Active',
  renewsOn: 'August 1, 2026',
  paymentMethod: 'Visa ending in 4242',
  invoices: [
    { id: 'inv_0726', date: 'Jul 1, 2026', amount: '$12.00', status: 'Paid' },
    { id: 'inv_0626', date: 'Jun 1, 2026', amount: '$12.00', status: 'Paid' },
    { id: 'inv_0526', date: 'May 1, 2026', amount: '$12.00', status: 'Paid' },
  ],
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function UsageBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs font-sans text-gray-400 mb-1.5">
        <span>{label}</span>
        <span>
          {value} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function UserDashboard({ onBack, onOpenEditor, variant = 'web' }: UserDashboardProps) {
  const isDesktop = variant === 'desktop'
  const [section, setSection] = useState<DashboardSection>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<LocalUser>(() => getOrCreateUser())
  const [email, setEmail] = useState('author@example.com')
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => listRecentDocuments(user.id))
  const [openingWeb, setOpeningWeb] = useState(false)
  const { skills, customSkills, removeSkill } = useSkills()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setDocuments(listRecentDocuments(user.id))
  }, [user.id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [section])

  function goTo(id: DashboardSection) {
    setSection(id)
    setSidebarOpen(false)
  }

  function handleDisplayNameBlur(value: string) {
    setUser(updateUserDisplayName(value))
  }

  async function handleOpenWebSignIn() {
    setOpeningWeb(true)
    try {
      await openWebSignIn()
    } finally {
      setOpeningWeb(false)
    }
  }

  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

  const sectionTitle = NAV_ITEMS.find(i => i.id === section)?.label ?? 'Dashboard'
  const showWebGate = isDesktop && WEB_GATED_SECTIONS.has(section)
  const webGateCopy =
    showWebGate && (section === 'billing' || section === 'usage' || section === 'security')
      ? WEB_GATED_COPY[section]
      : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      <nav className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/8 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(open => !open)}
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

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen && (
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-20 bg-black/50 border-none cursor-pointer"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
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
              <p className="text-sm font-sans text-white truncate">{user.displayName}</p>
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
                        onClick={() => goTo(item.id)}
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

        <main className="flex-1 min-w-0 px-5 sm:px-10 py-10 sm:py-12">
          <div className="max-w-3xl mx-auto w-full">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{sectionTitle}</h1>
            <p className="text-sm text-gray-500 font-sans mb-8">
              {isDesktop
                ? 'Local account details on this device. Billing and cloud settings open in your browser.'
                : 'Manage your agentdocs account, plan, and AI usage.'}
            </p>

            {webGateCopy && (
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6 max-w-lg">
                <h2 className="text-lg font-sans font-semibold text-white mb-2">{webGateCopy.title}</h2>
                <p className="text-sm font-sans text-gray-400 leading-relaxed mb-5">{webGateCopy.body}</p>
                <button
                  type="button"
                  onClick={() => void handleOpenWebSignIn()}
                  disabled={openingWeb}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {openingWeb ? 'Opening browser…' : 'Sign in on the web'}
                </button>
              </div>
            )}

            {!showWebGate && section === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(isDesktop
                    ? [
                        { label: 'Documents', value: String(documents.length) },
                        { label: 'Skills', value: String(skills.length) },
                        { label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light' },
                      ]
                    : [
                        { label: 'Plan', value: MOCK_BILLING.plan },
                        { label: 'Frontier requests', value: String(MOCK_USAGE.frontier.requests) },
                        { label: 'Local requests', value: String(MOCK_USAGE.local.requests) },
                      ]
                  ).map(stat => (
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
                      onClick={() => void handleOpenWebSignIn()}
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
                        onClick={() => goTo(id)}
                        className="px-3 py-1.5 rounded-md border border-white/10 text-xs font-sans text-gray-300 hover:bg-white/5 cursor-pointer bg-transparent capitalize"
                      >
                        {id}
                        {isDesktop && WEB_GATED_SECTIONS.has(id) ? ' · web' : ''}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {!showWebGate && section === 'account' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-5">
                  <div>
                    <label htmlFor="displayName" className="block text-xs font-sans text-gray-500 mb-2">
                      Display name
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      defaultValue={user.displayName}
                      onBlur={e => handleDisplayNameBlur(e.target.value)}
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
                      onChange={e => setEmail(e.target.value)}
                      className="w-full max-w-md px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-sans text-gray-500 mb-1">User ID</p>
                    <code className="text-xs font-mono text-gray-400 break-all">{user.id}</code>
                  </div>
                </div>
                <p className="text-xs font-sans text-gray-500">
                  Changes to display name are saved locally on this {isDesktop ? 'device' : 'browser'}.
                </p>
              </div>
            )}

            {!showWebGate && section === 'billing' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs font-sans text-gray-500 mb-1">Current plan</p>
                      <p className="text-2xl font-sans font-semibold text-white">{MOCK_BILLING.plan}</p>
                      <p className="text-sm font-sans text-gray-400 mt-1">{MOCK_BILLING.price}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 text-xs font-sans">
                      {MOCK_BILLING.status}
                    </span>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-sans">
                    <div>
                      <dt className="text-gray-500 text-xs mb-1">Renews on</dt>
                      <dd className="text-gray-200">{MOCK_BILLING.renewsOn}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 text-xs mb-1">Payment method</dt>
                      <dd className="text-gray-200">{MOCK_BILLING.paymentMethod}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2 mt-5">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-sans hover:bg-white/15 cursor-pointer border-none"
                    >
                      Change plan
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg border border-white/15 text-gray-300 text-sm font-sans hover:bg-white/5 cursor-pointer bg-transparent"
                    >
                      Update payment
                    </button>
                  </div>
                </div>

                <section>
                  <h2 className="text-sm font-sans font-semibold text-white mb-3">Invoices</h2>
                  <ul className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/8">
                    {MOCK_BILLING.invoices.map(inv => (
                      <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm font-sans bg-white/[0.02]">
                        <div>
                          <p className="text-gray-200">{inv.date}</p>
                          <p className="text-xs text-gray-500">{inv.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-200">{inv.amount}</p>
                          <p className="text-xs text-emerald-400">{inv.status}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {!showWebGate && section === 'usage' && (
              <div className="space-y-8">
                <p className="text-xs font-sans text-gray-500">Billing period: {MOCK_USAGE.periodLabel}</p>

                <section className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-5">
                  <div>
                    <h2 className="text-sm font-sans font-semibold text-white">Frontier models</h2>
                    <p className="text-xs font-sans text-gray-500 mt-1">
                      Anthropic, OpenAI, Gemini — metered API usage
                    </p>
                  </div>
                  <UsageBar
                    value={MOCK_USAGE.frontier.requests}
                    max={MOCK_USAGE.frontier.limit}
                    label="Requests this period"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-sans">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Input tokens</p>
                      <p className="text-white">{formatTokens(MOCK_USAGE.frontier.inputTokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Output tokens</p>
                      <p className="text-white">{formatTokens(MOCK_USAGE.frontier.outputTokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Est. cost</p>
                      <p className="text-white">${MOCK_USAGE.frontier.estimatedCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Requests</p>
                      <p className="text-white">{MOCK_USAGE.frontier.requests}</p>
                    </div>
                  </div>
                  <ul className="divide-y divide-white/8 border-t border-white/8 pt-2">
                    {MOCK_USAGE.frontier.byProvider.map(row => (
                      <li key={row.name} className="flex justify-between py-2.5 text-sm font-sans">
                        <span className="text-gray-300">{row.name}</span>
                        <span className="text-gray-500">
                          {row.requests} req · {formatTokens(row.tokens)} tok
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-xl border border-white/8 bg-white/[0.03] p-5 space-y-5">
                  <div>
                    <h2 className="text-sm font-sans font-semibold text-white">Local models</h2>
                    <p className="text-xs font-sans text-gray-500 mt-1">
                      Ollama and other on-device runs — no API billing
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm font-sans">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Requests</p>
                      <p className="text-white">{MOCK_USAGE.local.requests}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Input tokens</p>
                      <p className="text-white">{formatTokens(MOCK_USAGE.local.inputTokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Output tokens</p>
                      <p className="text-white">{formatTokens(MOCK_USAGE.local.outputTokens)}</p>
                    </div>
                  </div>
                  <ul className="divide-y divide-white/8 border-t border-white/8 pt-2">
                    {MOCK_USAGE.local.byModel.map(row => (
                      <li key={row.name} className="flex justify-between py-2.5 text-sm font-sans">
                        <span className="text-gray-300 font-mono text-xs sm:text-sm">{row.name}</span>
                        <span className="text-gray-500">
                          {row.requests} req · {formatTokens(row.tokens)} tok
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {!showWebGate && section === 'skills' && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-sm font-sans font-semibold text-white mb-3">Built-in skills</h2>
                  <ul className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/8">
                    {skills
                      .filter(s => !customSkills.some(c => c.id === s.id))
                      .map(skill => (
                        <li key={skill.id} className="px-4 py-3 bg-white/[0.02]">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs font-mono text-indigo-300">/{skill.name}</code>
                            <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">
                              Built-in
                            </span>
                          </div>
                          <p className="text-sm font-sans text-gray-400">{skill.description}</p>
                        </li>
                      ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-sm font-sans font-semibold text-white mb-3">Custom skills</h2>
                  {customSkills.length === 0 ? (
                    <p className="text-sm font-sans text-gray-500 py-6 border border-dashed border-white/10 rounded-xl text-center">
                      No custom skills yet. Create them from the agent sidebar in the editor.
                    </p>
                  ) : (
                    <ul className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/8">
                      {customSkills.map(skill => (
                        <li key={skill.id} className="px-4 py-3 bg-white/[0.02] flex items-start justify-between gap-3">
                          <div>
                            <code className="text-xs font-mono text-indigo-300">/{skill.name}</code>
                            <p className="text-sm font-sans text-gray-400 mt-1">{skill.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSkill(skill.id)}
                            className="text-xs font-sans text-red-400/80 hover:text-red-300 cursor-pointer bg-none border-none shrink-0"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {!showWebGate && section === 'preferences' && (
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
                    onClick={toggleTheme}
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
            )}

            {!showWebGate && section === 'security' && (
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
                      onClick={onBack}
                      className="px-4 py-2 rounded-lg border border-red-500/30 text-sm font-sans text-red-300 hover:bg-red-500/10 cursor-pointer bg-transparent"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
