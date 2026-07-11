import { useState } from 'react'
import DesktopHomePage from './DesktopHomePage'
import TiptapEditor from './TiptapEditor'
import UserDashboard from './UserDashboard'

type Page = 'home' | 'editor' | 'account'

export default function DesktopApp() {
  const [page, setPage] = useState<Page>('home')
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

  if (page === 'account') {
    return (
      <UserDashboard
        variant="desktop"
        onBack={() => setPage('home')}
        onOpenEditor={() => setPage('home')}
      />
    )
  }

  if (page === 'editor' && activeDocumentId) {
    return (
      <div className="min-h-screen bg-[var(--editor-canvas)] flex flex-col">
        <TiptapEditor documentId={activeDocumentId} onBack={() => setPage('home')} showBack />
      </div>
    )
  }

  return (
    <DesktopHomePage
      onOpenAccount={() => setPage('account')}
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
