import { useEffect, useState } from 'react'

interface LearnPageProps {
  onBack: () => void
  onGetStarted: () => void
}

type LearnSection = {
  slug: string
  title: string
  body: string
  examples?: { cmd: string; desc: string }[]
  kind?: 'guide' | 'example'
}

const sections: LearnSection[] = [
  {
    slug: 'open-editor',
    title: 'Open the editor',
    body: 'Click "Open Demo" or "Get Started" from the home page. You land on a clean, paginated canvas — like a word processor, built for long-form writing.',
  },
  {
    slug: 'write-draft',
    title: 'Write your draft',
    body: 'Use the toolbar for headings, lists, alignment, fonts, and colors. The editor grows page by page as you write — no manual page breaks.',
  },
  {
    slug: 'open-agent',
    title: 'Open the AI agent',
    body: 'Click the agent button in the toolbar to open the sidebar. The AI sees your full document and any text you have selected.',
  },
  {
    slug: 'slash-commands',
    title: 'Use slash commands',
    body: 'Type a slash command in the agent chat to run built-in skills on your selection:',
    examples: [
      { cmd: '/summarize', desc: 'Condense selected text (or the whole doc if nothing is selected)' },
      { cmd: '/changetone formal', desc: 'Rewrite selection in a different tone' },
    ],
  },
  {
    slug: 'ask-freely',
    title: 'Ask freely',
    body: 'You can also type any question or instruction — "expand this paragraph", "suggest a stronger opening", "check grammar in the selection". The agent responds in the sidebar; copy or adapt what you need back into the document.',
  },
  {
    slug: 'example-workflow',
    title: 'Example workflow',
    body: 'Here is a short walkthrough of rewriting a passage with a tone skill.',
    kind: 'example',
  },
]

const sampleDoc = `The morning fog rolled across the valley before anyone stirred.

By the time the first light reached the ridge, three figures were already moving through the trees — each carrying a reason to leave, and none willing to say it aloud.`

export default function LearnPage({ onBack, onGetStarted }: LearnPageProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const section = sections[activeIndex]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === sections.length - 1
  const prev = !isFirst ? sections[activeIndex - 1] : null
  const next = !isLast ? sections[activeIndex + 1] : null

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeIndex])

  function goTo(index: number) {
    setActiveIndex(index)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      <nav className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/8 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(open => !open)}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer bg-transparent"
            aria-label={sidebarOpen ? 'Close sections' : 'Open sections'}
            aria-expanded={sidebarOpen}
          >
            <span className="sr-only">Sections</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-xl font-bold tracking-tight text-white">agentdocs</span>
          <span className="hidden sm:inline text-xs font-sans text-gray-500 border-l border-white/10 pl-3 ml-1">
            Docs
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-400 font-sans hover:text-white transition-colors cursor-pointer bg-none border-none"
        >
          ← Back
        </button>
      </nav>

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen && (
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-20 bg-black/50 border-none cursor-pointer"
            aria-label="Close sections"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`
            fixed lg:sticky top-[57px] lg:top-[57px] z-20
            h-[calc(100vh-57px)] w-72 shrink-0
            border-r border-white/8 bg-[#0f0f0f]/95 backdrop-blur-md
            overflow-y-auto
            transition-transform duration-200 ease-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="px-5 py-6">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Getting started
            </p>
            <nav className="flex flex-col gap-0.5" aria-label="Documentation sections">
              {sections.map((item, index) => {
                const active = index === activeIndex
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => goTo(index)}
                    className={`
                      text-left px-3 py-2 rounded-md text-sm font-sans transition-colors cursor-pointer border-none
                      ${active
                        ? 'bg-white/10 text-white'
                        : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'}
                    `}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.title}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-5 sm:px-10 py-10 sm:py-14">
          <div className="max-w-2xl mx-auto w-full">
            <p className="text-xs font-sans text-gray-500 mb-3">
              {activeIndex + 1} / {sections.length}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              {section.title}
            </h1>
            <p className="text-sm sm:text-[15px] text-gray-400 font-sans leading-relaxed mb-8">
              {section.body}
            </p>

            {section.examples && (
              <ul className="mb-10 space-y-3">
                {section.examples.map(ex => (
                  <li key={ex.cmd} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 text-sm font-sans">
                    <code className="shrink-0 w-fit px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-xs">
                      {ex.cmd}
                    </code>
                    <span className="text-gray-500">{ex.desc}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.kind === 'example' && (
              <div className="mb-10 rounded-xl border border-white/8 overflow-hidden">
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
            )}

            <div className="mt-14 pt-6 border-t border-white/8 flex flex-col-reverse sm:flex-row sm:items-stretch gap-3 sm:gap-4">
              {prev ? (
                <button
                  type="button"
                  onClick={() => goTo(activeIndex - 1)}
                  className="flex-1 text-left px-4 py-3 rounded-lg border border-white/10 bg-white/3 hover:bg-white/6 transition-colors cursor-pointer font-sans"
                >
                  <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">Previous</span>
                  <span className="text-sm text-gray-200">{prev.title}</span>
                </button>
              ) : (
                <div className="flex-1 hidden sm:block" />
              )}

              {next ? (
                <button
                  type="button"
                  onClick={() => goTo(activeIndex + 1)}
                  className="flex-1 text-right px-4 py-3 rounded-lg border border-white/10 bg-white/3 hover:bg-white/6 transition-colors cursor-pointer font-sans"
                >
                  <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">Next</span>
                  <span className="text-sm text-gray-200">{next.title}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="flex-1 sm:flex-none sm:min-w-[200px] px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
                >
                  Try it yourself
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
