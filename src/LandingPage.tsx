interface LandingPageProps {
  onGetStarted: () => void
  onSignIn: () => void
}

const features = [
  {
    icon: '✍️',
    title: 'Built for Authors',
    desc: 'A clean, distraction-free canvas designed for long-form writing — not code, not slides.',
  },
  {
    icon: '⚡',
    title: 'AI at Every Step',
    desc: 'From first draft to final polish, AI assistance lives inside the editor — no copy-pasting required.',
  },
  {
    icon: '🧠',
    title: 'Context-Aware',
    desc: 'The AI understands your document, your style, and your intent — not just the sentence you highlighted.',
  },
]

export default function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      {/* Nav */}
      <nav className="flex items-center justify-between px-12 py-5 border-b border-white/8">
        <span className="text-xl font-bold tracking-tight text-white">agentdocs</span>
        <div className="flex items-center gap-3">
          <button
            onClick={onSignIn}
            className="px-5 py-2 rounded-md border border-white/30 text-gray-200 text-sm font-sans hover:bg-white/10 transition-colors cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={onGetStarted}
            className="px-5 py-2 rounded-md border border-white/30 text-gray-200 text-sm font-sans hover:bg-white/10 transition-colors cursor-pointer"
          >
            Open Editor
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-block px-4 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/40 text-indigo-300 text-xs tracking-widest uppercase mb-8 font-sans">
          AI-Native Text Editor
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-tight max-w-3xl mb-6 bg-gradient-to-br from-white to-indigo-300 bg-clip-text text-transparent">
          Write more.<br />Think less about the tools.
        </h1>

        <p className="text-lg text-gray-400 max-w-xl leading-relaxed mb-12 font-sans">
          agentdocs is a writing environment built for authors who want AI woven into every part of their process — not bolted on as an afterthought.
        </p>

        <button
          onClick={onGetStarted}
          className="px-10 py-4 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-lg font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
        >
          Get Started — it's free
        </button>
      </main>

      {/* Features */}
      <section className="flex flex-wrap justify-center gap-6 px-12 py-20 border-t border-white/6">
        {features.map(f => (
          <div
            key={f.title}
            className="max-w-xs bg-white/4 border border-white/8 rounded-xl p-7 text-left"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-base font-semibold text-white mb-2 font-sans">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-sans">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="text-center py-5 text-gray-700 text-xs font-sans border-t border-white/4">
        © 2026 agentdocs
      </footer>
    </div>
  )
}
