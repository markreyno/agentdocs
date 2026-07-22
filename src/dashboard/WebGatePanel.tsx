interface WebGatePanelProps {
  title: string
  body: string
  openingWeb: boolean
  onOpenWebSignIn: () => void
}

export function WebGatePanel({ title, body, openingWeb, onOpenWebSignIn }: WebGatePanelProps) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6 max-w-lg">
      <h2 className="text-lg font-sans font-semibold text-white mb-2">{title}</h2>
      <p className="text-sm font-sans text-gray-400 leading-relaxed mb-5">{body}</p>
      <button
        type="button"
        onClick={onOpenWebSignIn}
        disabled={openingWeb}
        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {openingWeb ? 'Opening browser…' : 'Sign in on the web'}
      </button>
    </div>
  )
}
