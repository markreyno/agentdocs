import { useEffect, useState } from 'react'
import {
  createDocument,
  deleteDocument,
  formatRelativeTime,
  getOrCreateUser,
  listRecentDocuments,
  type DocumentRecord,
} from './lib/documents'
import ProviderSettingsPanel from './ProviderSettingsPanel'

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

interface DesktopHomePageProps {
  onNewDocument: (documentId: string) => void
  onOpenDocument: (documentId: string) => void
}

export default function DesktopHomePage({ onNewDocument, onOpenDocument }: DesktopHomePageProps) {
  const [userId] = useState(() => getOrCreateUser().id)
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => listRecentDocuments(userId))
  const [showSettings, setShowSettings] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    setDocuments(listRecentDocuments(userId))
  }, [userId])

  useEffect(() => {
    const updater = window.agentdocs?.updater
    if (!updater) return

    void updater.getVersion().then(setAppVersion)
    void updater.getStatus().then(setUpdateStatus)
    return updater.onStatus(setUpdateStatus)
  }, [])

  const handleNewDocument = () => {
    const doc = createDocument(userId)
    setDocuments(listRecentDocuments(userId))
    onNewDocument(doc.id)
  }

  const handleCheckUpdates = () => {
    void window.agentdocs?.updater.check()
  }

  const handleInstallUpdate = () => {
    void window.agentdocs?.updater.install()
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    deleteDocument(pendingDelete.id)
    setDocuments(listRecentDocuments(userId))
    setPendingDelete(null)
  }

  return (
    <div className="desktop-home">
      <header className="desktop-home-header">
        <span className="desktop-home-logo">agentdocs</span>
        <div className="desktop-home-user">
          {appVersion && <span className="desktop-home-user-label">v{appVersion}</span>}
          <button type="button" onClick={() => setShowSettings(true)} className="desktop-home-user-label cursor-pointer">
            Model providers
          </button>
          <button type="button" onClick={handleCheckUpdates} className="desktop-home-user-label cursor-pointer">
            Check for updates
          </button>
        </div>
      </header>

      <UpdateBanner status={updateStatus} onInstall={handleInstallUpdate} onDismiss={() => setUpdateStatus({ state: 'idle' })} />

      {showSettings && <ProviderSettingsPanel onClose={() => setShowSettings(false)} />}

      {pendingDelete && (
        <DeleteConfirmDialog
          title={pendingDelete.title}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      <main className="desktop-home-main">
        <section className="desktop-home-hero">
          <h1 className="desktop-home-title">Your documents</h1>
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
                <li key={doc.id} className="desktop-home-doc-item">
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
                  <button
                    type="button"
                    className="desktop-home-doc-delete"
                    aria-label={`Delete ${doc.title}`}
                    onClick={() => setPendingDelete(doc)}
                  >
                    <TrashIcon />
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

function UpdateBanner({
  status,
  onInstall,
  onDismiss,
}: {
  status: UpdateStatus
  onInstall: () => void
  onDismiss: () => void
}) {
  if (status.state === 'idle') return null

  let message: string | null = null
  let action: { label: string; onClick: () => void } | null = null

  switch (status.state) {
    case 'checking':
      message = 'Checking for updates…'
      break
    case 'available':
      message = `Update ${status.version} available — downloading…`
      break
    case 'downloading':
      message = `Downloading update… ${Math.round(status.percent)}%`
      break
    case 'downloaded':
      message = `Update ${status.version} ready to install.`
      action = { label: 'Restart now', onClick: onInstall }
      break
    case 'not-available':
      message = `You're on the latest version (${status.version}).`
      action = { label: 'Dismiss', onClick: onDismiss }
      break
    case 'error':
      message = `Update check failed: ${status.message}`
      action = { label: 'Dismiss', onClick: onDismiss }
      break
  }

  if (!message) return null

  return (
    <div className="desktop-home-update-banner" role="status">
      <span>{message}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="desktop-home-update-action">
          {action.label}
        </button>
      )}
    </div>
  )
}

function DeleteConfirmDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="desktop-home-confirm" role="presentation" onClick={onCancel}>
      <div
        className="desktop-home-confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="desktop-home-delete-title"
        aria-describedby="desktop-home-delete-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="desktop-home-delete-title" className="desktop-home-confirm-title">
          Delete document?
        </h2>
        <p id="desktop-home-delete-desc" className="desktop-home-confirm-body">
          “{title}” will be permanently removed. This cannot be undone.
        </p>
        <div className="desktop-home-confirm-actions">
          <button type="button" className="desktop-home-confirm-cancel" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="desktop-home-confirm-delete" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width={14} height={14} aria-hidden="true">
      <path
        d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
