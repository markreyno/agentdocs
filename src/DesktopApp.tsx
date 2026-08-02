import { useEffect, useState } from 'react'
import DesktopHomePage from './DesktopHomePage'
import TiptapEditor from './TiptapEditor'
import { ensureOllamaWhenSelected } from './lib/ollama'
import { getActiveProvider } from './lib/providerSettings'

type Page = 'home' | 'editor'

export default function DesktopApp() {
  const [page, setPage] = useState<Page>('home')
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

  useEffect(() => {
    if (getActiveProvider() === 'ollama') {
      void ensureOllamaWhenSelected('ollama')
    }
  }, [])

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
