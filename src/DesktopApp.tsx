import { useState } from 'react'
import DesktopHomePage from './DesktopHomePage'
import TiptapEditor from './TiptapEditor'

type Page = 'home' | 'editor'

export default function DesktopApp() {
  const [page, setPage] = useState<Page>('home')
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

  if (page === 'editor' && activeDocumentId) {
    return (
      <div className="min-h-screen bg-[var(--editor-canvas)] flex flex-col">
        <TiptapEditor documentId={activeDocumentId} onBack={() => setPage('home')} showBack />
      </div>
    )
  }

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
