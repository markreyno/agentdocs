import { useState } from 'react'
import LandingPage from './LandingPage'
import LearnPage from './LearnPage'
import SignInPage from './SignInPage'
import TiptapEditor from './TiptapEditor'

type Page = 'landing' | 'signin' | 'learn' | 'editor'

export default function WebApp() {
  const [page, setPage] = useState<Page>('landing')

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
        <TiptapEditor onBack={() => setPage('landing')} showBack />
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
