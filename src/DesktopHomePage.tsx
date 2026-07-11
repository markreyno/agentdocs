import { useEffect, useState } from 'react'
import {
  createDocument,
  formatRelativeTime,
  getOrCreateUser,
  listRecentDocuments,
  updateUserDisplayName,
  type DocumentRecord,
  type LocalUser,
} from './lib/documents'
import ProviderSettingsPanel from './ProviderSettingsPanel'

interface DesktopHomePageProps {
  onNewDocument: (documentId: string) => void
  onOpenDocument: (documentId: string) => void
}

export default function DesktopHomePage({ onNewDocument, onOpenDocument }: DesktopHomePageProps) {
  const [user, setUser] = useState<LocalUser>(() => getOrCreateUser())
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => listRecentDocuments(user.id))
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setDocuments(listRecentDocuments(user.id))
  }, [user.id])

  const handleNewDocument = () => {
    const doc = createDocument(user.id)
    setDocuments(listRecentDocuments(user.id))
    onNewDocument(doc.id)
  }

  const handleNameBlur = (value: string) => {
    const updated = updateUserDisplayName(value)
    setUser(updated)
  }

  return (
    <div className="desktop-home">
      <header className="desktop-home-header">
        <span className="desktop-home-logo">agentdocs</span>
        <div className="desktop-home-user">
          <button type="button" onClick={() => setShowSettings(true)} className="desktop-home-user-label cursor-pointer">
            Model providers
          </button>
          <span className="desktop-home-user-label">Signed in as</span>
          <input
            type="text"
            defaultValue={user.displayName}
            onBlur={(e) => handleNameBlur(e.target.value)}
            aria-label="Your name"
            className="desktop-home-user-name"
          />
        </div>
      </header>

      {showSettings && <ProviderSettingsPanel onClose={() => setShowSettings(false)} />}

      <main className="desktop-home-main">
        <section className="desktop-home-hero">
          <h1 className="desktop-home-title">Welcome back, {user.displayName}</h1>
          <p className="desktop-home-subtitle">Pick up where you left off or start something new.</p>
          <button type="button" onClick={handleNewDocument} className="desktop-home-new-btn">
            <span className="desktop-home-new-icon" aria-hidden="true">+</span>
            New document
          </button>
        </section>

        <section className="desktop-home-recent">
          <h2 className="desktop-home-section-title">Recent documents</h2>

          {documents.length === 0 ? (
            <div className="desktop-home-empty">
              <p>No documents yet.</p>
              <button type="button" onClick={handleNewDocument} className="desktop-home-empty-btn">
                Create your first document
              </button>
            </div>
          ) : (
            <ul className="desktop-home-doc-list">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDocument(doc.id)}
                    className="desktop-home-doc-card"
                  >
                    <span className="desktop-home-doc-icon" aria-hidden="true">
                      <DocIcon />
                    </span>
                    <span className="desktop-home-doc-info">
                      <span className="desktop-home-doc-title">{doc.title}</span>
                      <span className="desktop-home-doc-meta">
                        Edited {formatRelativeTime(doc.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={20} height={20} aria-hidden="true">
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12h8M8 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
