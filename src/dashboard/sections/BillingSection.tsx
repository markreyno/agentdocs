import { MOCK_BILLING } from '../constants'

export function BillingSection() {
  return (
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
  )
}
