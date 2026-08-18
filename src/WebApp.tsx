import { useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import LearnPage from './LearnPage'
import SignInPage, { type SignInMode } from './SignInPage'
import TiptapEditor from './TiptapEditor'
import UserDashboard from './UserDashboard'
import { AuthProvider, useAuth } from './lib/AuthSession'
import {
  DownloadAgreementProvider,
  useRequestDesktopDownload,
} from './lib/downloadAgreement'

type Page = 'landing' | 'learn' | 'editor' | 'auth' | 'dashboard'

interface Route {
  page: Page
  authMode: SignInMode
  token?: string
}

function parseRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [segment, rest] = raw.split('/')
  if (segment === 'learn') return { page: 'learn', authMode: 'signin' }
  if (segment === 'editor') return { page: 'editor', authMode: 'signin' }
  if (segment === 'dashboard') return { page: 'dashboard', authMode: 'signin' }
  if (segment === 'signup') return { page: 'auth', authMode: 'signup' }
  if (segment === 'forgot') return { page: 'auth', authMode: 'forgot' }
  if (segment === 'reset') return { page: 'auth', authMode: 'reset', token: rest }
  if (segment === 'verify') return { page: 'auth', authMode: 'verify', token: rest }
  if (segment === 'signin' || segment === 'login') return { page: 'auth', authMode: 'signin' }
  return { page: 'landing', authMode: 'signin' }
}

function hashFor(route: Route): string {
  if (route.page === 'landing') return ''
  if (route.page === 'auth') {
    if (route.authMode === 'reset' && route.token) return `#reset/${route.token}`
    if (route.authMode === 'verify' && route.token) return `#verify/${route.token}`
    if (route.authMode === 'signup') return '#signup'
    if (route.authMode === 'forgot') return '#forgot'
    return '#signin'
  }
  return `#${route.page}`
}

export default function WebApp() {
  return (
    <DownloadAgreementProvider>
      <AuthProvider>
        <WebAppRoutes />
      </AuthProvider>
    </DownloadAgreementProvider>
  )
}

function WebAppRoutes() {
  const [route, setRoute] = useState<Route>(() => parseRoute())
  const requestDesktopDownload = useRequestDesktopDownload()
  const { user, session, loading, setUser, signOut } = useAuth()

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const desired = hashFor(route)
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired || window.location.pathname + window.location.search)
    }
  }, [route])

  useEffect(() => {
    if (loading) return
    if (route.page === 'dashboard' && !user) {
      setRoute({ page: 'auth', authMode: 'signin' })
    }
    if (route.page === 'auth' && user && route.authMode !== 'verify') {
      setRoute({ page: 'dashboard', authMode: 'signin' })
    }
  }, [loading, route.page, route.authMode, user])

  function go(page: Page, authMode: SignInMode = 'signin', token?: string) {
    setRoute({ page, authMode, token })
  }

  if (route.page === 'learn') {
    return (
      <LearnPage
        onBack={() => go('landing')}
        onGetStarted={() => go('editor')}
      />
    )
  }

  if (route.page === 'editor') {
    return (
      <div className="min-h-screen bg-[var(--editor-canvas)] flex flex-col">
        <TiptapEditor onBack={() => go('landing')} showBack />
      </div>
    )
  }

  if (route.page === 'auth') {
    return (
      <SignInPage
        mode={route.authMode}
        token={route.token}
        onBack={() => go('landing')}
        onMode={authMode => go('auth', authMode, route.token)}
        onSignedIn={next => {
          setUser(next)
          go('dashboard')
        }}
      />
    )
  }

  if (route.page === 'dashboard') {
    if (loading || !user) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-300 flex items-center justify-center font-sans text-sm">
          Loading account…
        </div>
      )
    }
    return (
      <UserDashboard
        variant="web"
        account={user}
        session={session}
        onAccountUpdate={setUser}
        onBack={() => go('landing')}
        onOpenEditor={() => go('editor')}
        onSignedOut={() => {
          void signOut().then(() => go('landing'))
        }}
      />
    )
  }

  return (
    <LandingPage
      onGetStarted={() => go('editor')}
      onLearn={() => go('learn')}
      onDownload={requestDesktopDownload}
    />
  )
}
