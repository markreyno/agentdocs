import type { DashboardSection } from './types'

/** Sections that require the cloud account — desktop opens the web sign-in instead. */
export const WEB_GATED_SECTIONS = new Set<DashboardSection>(['billing', 'usage', 'security'])

export const NAV_ITEMS: { id: DashboardSection; label: string; group: string }[] = [
  { id: 'overview', label: 'Overview', group: 'General' },
  { id: 'account', label: 'Account', group: 'General' },
  { id: 'billing', label: 'Billing', group: 'General' },
  { id: 'usage', label: 'Usage', group: 'AI' },
  { id: 'skills', label: 'Skills', group: 'AI' },
  { id: 'preferences', label: 'Preferences', group: 'Settings' },
  { id: 'security', label: 'Security', group: 'Settings' },
]

export const WEB_GATED_COPY: Record<'billing' | 'usage' | 'security', { title: string; body: string }> = {
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
export const MOCK_USAGE = {
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

export const MOCK_BILLING = {
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
