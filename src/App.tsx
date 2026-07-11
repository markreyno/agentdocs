import { useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import LearnPage from './LearnPage'
import SignInPage from './SignInPage'
import DesktopHomePage from './DesktopHomePage'
import TiptapEditor from './TiptapEditor'
import { isDesktopApp } from './lib/isDesktop'

type Page = 'landing' | 'signin' | 'learn' | 'home' | 'editor'

export default function App() {
  const desktop = isDesktopApp()
  const [page, setPage] = useState<Page>(desktop ? 'home' : 'landing')
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

  useEffect(() => {
    if (desktop && page === 'editor' && !activeDocumentId) {
      setPage('home')
    }
  }, [desktop, page, activeDocumentId])

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

  if (desktop && page === 'home') {
    return (
      <DesktopHomePage
        onNewDocument={(documentId) => {
          setActiveDocumentId(documentId)
          setPage('editor')
        }}
        onOpenDocument={(documentId) => {
          setActiveDocumentId(documentId)
          setPage('editor')
        }}
      />
    )
  }

  if (page === 'editor') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TiptapEditor
          documentId={desktop ? activeDocumentId ?? undefined : undefined}
          onBack={() => setPage(desktop ? 'home' : 'landing')}
          showBack
        />
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
