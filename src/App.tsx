import { useState } from 'react'
import LandingPage from './LandingPage'
import TiptapEditor from './TiptapEditor'

type Page = 'landing' | 'editor'

export default function App() {
  const [page, setPage] = useState<Page>('landing')

  if (page === 'editor') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setPage('landing')}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors font-sans cursor-pointer bg-none border-none"
            >
              ← Back
            </button>
            <span className="text-lg font-bold font-serif">agentdocs</span>
            <div className="w-12" />
          </div>
          <TiptapEditor />
        </div>
      </div>
    )
  }

  return <LandingPage onGetStarted={() => setPage('editor')} />
}
