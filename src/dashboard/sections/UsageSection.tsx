import { MOCK_USAGE } from '../constants'
import { formatTokens } from '../formatTokens'
import { UsageBar } from '../UsageBar'

export function UsageSection() {
  return (
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
  )
}
