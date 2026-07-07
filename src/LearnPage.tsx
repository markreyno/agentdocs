interface LearnPageProps {
  onBack: () => void
  onGetStarted: () => void
}

const steps = [
  {
    title: '1. Open the editor',
    body: 'Click "Open Editor" or "Get Started" from the home page. You land on a clean, paginated canvas — like a word processor, built for long-form writing.',
  },
  {
    title: '2. Write your draft',
    body: 'Use the toolbar for headings, lists, alignment, fonts, and colors. The editor grows page by page as you write — no manual page breaks.',
  },
  {
    title: '3. Open the AI agent',
    body: 'Click the agent button in the toolbar to open the sidebar. The AI sees your full document and any text you have selected.',
  },
  {
    title: '4. Use slash commands',
    body: 'Type a slash command in the agent chat to run built-in skills on your selection:',
    examples: [
      { cmd: '/summarize', desc: 'Condense selected text (or the whole doc if nothing is selected)' },
      { cmd: '/changetone formal', desc: 'Rewrite selection in a different tone' },
    ],
  },
  {
    title: '5. Ask freely',
    body: 'You can also type any question or instruction — "expand this paragraph", "suggest a stronger opening", "check grammar in the selection". The agent responds in the sidebar; copy or adapt what you need back into the document.',
  },
]

const sampleDoc = `The morning fog rolled across the valley before anyone stirred.

By the time the first light reached the ridge, three figures were already moving through the trees — each carrying a reason to leave, and none willing to say it aloud.`

export default function LearnPage({ onBack, onGetStarted }: LearnPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      <nav className="flex items-center justify-between px-12 py-5 border-b border-white/8">
        <span className="text-xl font-bold tracking-tight text-white">agentdocs</span>
        <button
          onClick={onBack}
          className="text-sm text-gray-400 font-sans hover:text-white transition-colors cursor-pointer bg-none border-none"
        >
          ← Back
        </button>
      </nav>

      <main className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">
        <h1 className="text-4xl font-bold text-white mb-3">How to use agentdocs</h1>
        <p className="text-gray-400 text-sm font-sans leading-relaxed mb-12">
          A quick walkthrough of the writing workflow — from blank page to AI-assisted polish.
        </p>

        <div className="space-y-10 mb-16">
          {steps.map(step => (
            <section key={step.title}>
              <h2 className="text-lg font-semibold text-white mb-2 font-sans">{step.title}</h2>
              <p className="text-sm text-gray-400 font-sans leading-relaxed">{step.body}</p>
              {step.examples && (
                <ul className="mt-3 space-y-2">
                  {step.examples.map(ex => (
                    <li key={ex.cmd} className="flex gap-3 text-sm font-sans">
                      <code className="shrink-0 px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-xs">
                        {ex.cmd}
                      </code>
                      <span className="text-gray-500">{ex.desc}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4 font-sans">Example workflow</h2>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <div className="px-5 py-3 bg-white/4 border-b border-white/8 text-xs text-gray-500 font-sans uppercase tracking-wider">
              Your document
            </div>
            <pre className="px-5 py-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-serif">
              {sampleDoc}
            </pre>
            <div className="px-5 py-3 bg-white/4 border-t border-white/8 text-xs text-gray-500 font-sans uppercase tracking-wider">
              Agent chat
            </div>
            <div className="px-5 py-4 space-y-3 font-sans text-sm">
              <div className="text-gray-500">
                <span className="text-indigo-400">You:</span>{' '}
                <code className="text-indigo-300">/changetone suspenseful</code>
              </div>
              <div className="text-gray-400 leading-relaxed">
                <span className="text-violet-400">Agent:</span>{' '}
                Fog swallowed the valley before a soul stirred. By the time pale light clawed at the ridge, three silhouettes were already threading through the pines — each fleeing something they refused to name.
              </div>
            </div>
          </div>
        </section>

        <button
          onClick={onGetStarted}
          className="px-8 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
        >
          Try it yourself
        </button>
      </main>
    </div>
  )
}
