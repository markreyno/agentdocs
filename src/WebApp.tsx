import { useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import LearnPage from './LearnPage'
import SignInPage from './SignInPage'
import TiptapEditor from './TiptapEditor'
import UserDashboard from './UserDashboard'
import { openDesktopDownload } from './lib/desktopDownload'

type Page = 'landing' | 'signin' | 'learn' | 'editor' | 'dashboard'

function pageFromHash(): Page | null {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [segment] = raw.split('/')
  if (segment === 'signin') return 'signin'
  if (segment === 'dashboard') return 'dashboard'
  if (segment === 'learn') return 'learn'
  if (segment === 'editor') return 'editor'
  if (segment === '' || segment === 'landing') return 'landing'
  return null
}

function hashForPage(page: Page): string {
  if (page === 'landing') return ''
  return `#${page}`
}

export default function WebApp() {
  const [page, setPage] = useState<Page>(() => pageFromHash() ?? 'landing')

  useEffect(() => {
    const onHashChange = () => {
      const next = pageFromHash()
      if (next) setPage(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const desired = hashForPage(page)
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired || window.location.pathname + window.location.search)
    }
  }, [page])

  if (page === 'signin') {
    return (
      <SignInPage
        onBack={() => setPage('landing')}
        onOpenDashboard={() => setPage('dashboard')}
      />
    )
  }

  if (page === 'dashboard') {
    return (
      <UserDashboard
        onBack={() => setPage('landing')}
        onOpenEditor={() => setPage('editor')}
      />
    )
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
      <div className="min-h-screen bg-[var(--editor-canvas)] flex flex-col">
        <TiptapEditor onBack={() => setPage('landing')} showBack />
      </div>
    )
  }

  return (
    <LandingPage
      onGetStarted={() => setPage('editor')}
      onSignIn={() => setPage('signin')}
      onLearn={() => setPage('learn')}
      onDownload={openDesktopDownload}
    />
  )
}
