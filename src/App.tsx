import { useState } from 'react'
import LandingPage from './LandingPage'
import LearnPage from './LearnPage'
import SignInPage from './SignInPage'
import TiptapEditor from './TiptapEditor'
import { isDesktopApp } from './lib/isDesktop'

type Page = 'landing' | 'signin' | 'learn' | 'editor'

export default function App() {
  const desktop = isDesktopApp()
  const [page, setPage] = useState<Page>(desktop ? 'editor' : 'landing')

  if (page === 'signin') {
    return <SignInPage onBack={() => setPage('landing')} />
  }

  if (page === 'learn') {
    return (
      <LearnPage
        onBack={() => setPage('landing')}
        onGetStarted={() => setPage('editor')}
      />
    )
  }

  if (page === 'editor') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 max-w-[8.5in] w-full mx-auto">
          {desktop ? (
            <div className="w-12" />
          ) : (
            <button
              onClick={() => setPage('landing')}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors font-sans cursor-pointer bg-none border-none"
            >
              ← Back
            </button>
          )}
          <span className="text-lg font-bold font-serif">agentdocs</span>
          <div className="w-12" />
        </div>
        <TiptapEditor />
      </div>
    )
  }

  return (
    <LandingPage
      onGetStarted={() => setPage('editor')}
      onSignIn={() => setPage('signin')}
      onLearn={() => setPage('learn')}
    />
  )
}
