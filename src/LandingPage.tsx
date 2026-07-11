import { useEffect, useRef, useState } from 'react'
import { useTheme } from './lib/theme'

interface LandingPageProps {
  onGetStarted: () => void
  onSignIn: () => void
  onLearn: () => void
  onDownload?: () => void
}

const HERO_VIDEOS = {
  dark: '/videos/hero-dark.mp4',
  light: '/videos/hero-light.mp4',
} as const

const sections = [
  {
    slug: 'editor',
    title: 'Author-Focused Text Editor',
    body: 'Writing requires deep focus, not a screen cluttered with formatting bars. Our editor provides a beautifully minimalist, distraction-free canvas designed specifically for long-form narrative structure. Beneath its clean surface lies a powerful version-control system, seamless chapter management, and real-time formatting that stays out of your way so you can stay in the flow.',
  },
  {
    slug: 'agent',
    title: 'AI Agent Assistance',
    body: 'Meet your tireless co-writer and developmental editor. Instead of rigid, single-prompt chat windows, our integrated AI agents work directly alongside your manuscript. They can map out character arcs, flag narrative inconsistencies, suggest sensory details for a scene, or brainstorm plot directions—all while maintaining the unique voice and tone of your story.',
  },
  {
    slug: 'skills',
    title: 'Agent Skill Creation',
    body: 'Every author’s workflow is unique, which is why you can build and customize your own agent skills. Teach your AI assistants exactly how you want them to work. Whether you need a skill that rigorously checks your sci-fi worldbuilding rules, formats dialogue to a specific style guide, or critiques pacing based on a classic three-act structure, you can script and save bespoke behaviors without writing a single line of code.',
  },
  {
    slug: 'models',
    title: 'Local or Frontier Models',
    body: 'Take absolute control over your creative privacy and computing power. Seamlessly connect to commercial frontier models via high-speed APIs for cutting-edge analysis, or run your environment entirely offline. By supporting local deployment through Ollama, you can leverage open-source models right on your machine—ensuring your manuscript, lore, and ideas never leave your local hardware.',
  },
] as const

function SectionVideo({ slug, isDark }: { slug: string; isDark: boolean }) {
  const [failed, setFailed] = useState(false)
  const src = `/videos/section-${slug}.mp4`

  return (
    <div
      className={`relative w-full max-w-sm shrink-0 aspect-video overflow-hidden ${
        isDark ? 'bg-[#0a0a12]' : 'bg-[#e8ecf4]'
      }`}
    >
      {!failed ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center font-sans">
          <p className={`text-xs opacity-70 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Add <code className="font-mono">section-{slug}.mp4</code>
          </p>
        </div>
      )}
    </div>
  )
}

function HeroDemoVideo({ isDark }: { isDark: boolean }) {
  const darkRef = useRef<HTMLVideoElement>(null)
  const lightRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState({ dark: false, light: false })

  const activeFailed = isDark ? failed.dark : failed.light
  const placeholderFile = isDark ? 'hero-dark.mp4' : 'hero-light.mp4'

  useEffect(() => {
    const active = isDark ? darkRef.current : lightRef.current
    const inactive = isDark ? lightRef.current : darkRef.current
    inactive?.pause()
    if (active) {
      void active.play().catch(() => {
        // Autoplay can be blocked; muted + playsInline usually allows it.
      })
    }
  }, [isDark, failed.dark, failed.light])

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${
        isDark ? 'bg-[#0a0a12]' : 'bg-[#e8ecf4]'
      }`}
      aria-hidden
    >
      <video
        ref={darkRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          isDark && !failed.dark ? 'opacity-100' : 'opacity-0'
        }`}
        src={HERO_VIDEOS.dark}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed((prev) => (prev.dark ? prev : { ...prev, dark: true }))}
      />
      <video
        ref={lightRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          !isDark && !failed.light ? 'opacity-100' : 'opacity-0'
        }`}
        src={HERO_VIDEOS.light}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed((prev) => (prev.light ? prev : { ...prev, light: true }))}
      />

      {/* Scrim so headline stays readable over the demo */}
      <div
        className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-black/70 via-black/55 to-black/75'
            : 'bg-gradient-to-b from-white/75 via-white/65 to-white/80'
        }`}
      />

      {activeFailed && (
        <p
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-sans opacity-60 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Add <code className="font-mono">{placeholderFile}</code> to{' '}
          <code className="font-mono">public/videos/</code>
        </p>
      )}
    </div>
  )
}

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
      <main className="relative flex-1 flex flex-col min-h-[calc(100vh-4.5rem)]">
        <HeroDemoVideo isDark={isDark} />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6 py-24">
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
            className={`text-lg max-w-xl leading-relaxed mb-10 font-sans ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            agentdocs is a writing environment built for authors who want AI woven into every part of their process — not bolted on as an afterthought.
          </p>

          <button
            onClick={onGetStarted}
            className="px-10 py-4 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-lg font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            Open Demo
          </button>
        </div>
      </main>

      {sections.map((section, index) => {
        const textLeft = index % 2 === 0

        return (
          <section
            key={section.title}
            className={`px-6 md:px-12 py-20 border-t ${
              isDark ? 'border-white/6' : 'border-black/6'
            }`}
          >
            <div
              className={`mx-auto max-w-5xl flex flex-col md:flex-row items-center gap-10 md:gap-14 ${
                textLeft ? '' : 'md:flex-row-reverse'
              }`}
            >
              <div className={`flex-1 min-w-0 ${textLeft ? 'text-left' : 'text-right'}`}>
                <h2
                  className={`text-2xl md:text-3xl font-semibold mb-5 font-sans tracking-tight ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {section.title}
                </h2>
                <p
                  className={`text-base md:text-lg leading-relaxed font-sans ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {section.body}
                </p>
              </div>
              <SectionVideo slug={section.slug} isDark={isDark} />
            </div>
          </section>
        )
      })}

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
