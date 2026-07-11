import { useTheme } from './lib/theme'

interface LandingPageProps {
  onGetStarted: () => void
  onSignIn: () => void
  onLearn: () => void
  onDownload?: () => void
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

export default function LandingPage({ onGetStarted, onSignIn, onLearn, onDownload }: LandingPageProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className={`min-h-screen flex flex-col font-serif ${
        isDark
          ? 'bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100'
          : 'bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] text-gray-900'
      }`}
    >
      {/* Nav */}
      <nav
        className={`flex items-center justify-between px-12 py-5 border-b ${
          isDark ? 'border-white/8' : 'border-black/8'
        }`}
      >
        <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          agentdocs
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={onLearn}
            className={`px-5 py-2 text-sm font-sans transition-colors cursor-pointer bg-none border-none ${
              isDark ? 'text-white hover:bg-white/10' : 'text-gray-800 hover:bg-black/5'
            }`}
          >
            Learn
          </button>
          <button
            onClick={onSignIn}
            className={`px-5 py-2 rounded-md border text-sm font-sans transition-colors cursor-pointer ${
              isDark
                ? 'border-white/30 text-gray-200 hover:bg-white/10'
                : 'border-black/20 text-gray-700 hover:bg-black/5'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={onGetStarted}
            className={`px-5 py-2 rounded-md border text-sm font-sans transition-colors cursor-pointer ${
              isDark
                ? 'border-white/30 text-gray-200 hover:bg-white/10'
                : 'border-black/20 text-gray-700 hover:bg-black/5'
            }`}
          >
            Open Demo
          </button>
          <button
            onClick={onDownload}
            className={`px-5 py-2 rounded-md border text-sm font-sans transition-colors cursor-pointer ${
              isDark
                ? 'border-white/30 text-gray-200 hover:bg-white/10'
                : 'border-black/20 text-gray-700 hover:bg-black/5'
            }`}
          >
            Download
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div
          className={`inline-block px-4 py-1 rounded-full text-xs tracking-widest uppercase mb-8 font-sans ${
            isDark
              ? 'bg-indigo-500/15 border border-indigo-400/40 text-indigo-300'
              : 'bg-indigo-500/10 border border-indigo-400/30 text-indigo-600'
          }`}
        >
          AI-Native Text Editor
        </div>

        <h1
          className={`text-5xl md:text-7xl font-bold leading-tight max-w-3xl mb-6 bg-clip-text text-transparent ${
            isDark
              ? 'bg-gradient-to-br from-white to-indigo-300'
              : 'bg-gradient-to-br from-gray-900 to-indigo-600'
          }`}
        >
          Write more.<br />Think less about the tools.
        </h1>

        <p
          className={`text-lg max-w-xl leading-relaxed mb-12 font-sans ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
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
      <section
        className={`flex flex-wrap justify-center gap-6 px-12 py-20 border-t ${
          isDark ? 'border-white/6' : 'border-black/6'
        }`}
      >
        {features.map(f => (
          <div
            key={f.title}
            className={`max-w-xs rounded-xl p-7 text-left ${
              isDark
                ? 'bg-white/4 border border-white/8'
                : 'bg-white/70 border border-black/8'
            }`}
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3
              className={`text-base font-semibold mb-2 font-sans ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {f.title}
            </h3>
            <p
              className={`text-sm leading-relaxed font-sans ${
                isDark ? 'text-gray-500' : 'text-gray-600'
              }`}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      <footer
        className={`flex items-center justify-center gap-4 py-5 text-xs font-sans border-t ${
          isDark ? 'text-gray-700 border-white/4' : 'text-gray-500 border-black/6'
        }`}
      >
        <span>© 2026 agentdocs</span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className={`px-3 py-1.5 rounded-md border text-xs font-sans transition-colors cursor-pointer ${
            isDark
              ? 'border-white/30 text-gray-300 hover:bg-white/10'
              : 'border-black/20 text-gray-700 hover:bg-black/5'
          }`}
        >
          {isDark ? 'Light' : 'Dark'}
        </button>
      </footer>
    </div>
  )
}
