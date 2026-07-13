export interface LocalUser {
  id: string
  displayName: string
}

export interface DocumentRecord {
  id: string
  userId: string
  title: string
  content: string
  updatedAt: number
}

const USER_KEY = 'agentdocs:user'
const DOCUMENTS_KEY = 'agentdocs:documents'

function readDocuments(): DocumentRecord[] {
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DocumentRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDocuments(documents: DocumentRecord[]) {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents))
}

export function getOrCreateUser(): LocalUser {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LocalUser
      if (parsed.id && parsed.displayName) return parsed
    }
  } catch {
    // fall through to create
  }

  const user: LocalUser = {
    id: crypto.randomUUID(),
    displayName: 'You',
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export function updateUserDisplayName(displayName: string) {
  const user = getOrCreateUser()
  const trimmed = displayName.trim() || 'You'
  const updated = { ...user, displayName: trimmed }
  localStorage.setItem(USER_KEY, JSON.stringify(updated))
  return updated
}

export function listRecentDocuments(userId: string): DocumentRecord[] {
  return readDocuments()
    .filter((doc) => doc.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getDocument(id: string): DocumentRecord | undefined {
  return readDocuments().find((doc) => doc.id === id)
}

export function createDocument(userId: string): DocumentRecord {
  const doc: DocumentRecord = {
    id: crypto.randomUUID(),
    userId,
    title: 'Untitled document',
    content: '<p></p>',
    updatedAt: Date.now(),
  }

  const documents = readDocuments()
  documents.push(doc)
  writeDocuments(documents)
  return doc
}

export function saveDocument(
  id: string,
  updates: Partial<Pick<DocumentRecord, 'title' | 'content'>>,
): DocumentRecord | undefined {
  const documents = readDocuments()
  const index = documents.findIndex((doc) => doc.id === id)
  if (index === -1) return undefined

  const updated: DocumentRecord = {
    ...documents[index],
    ...updates,
    updatedAt: Date.now(),
  }
  documents[index] = updated
  writeDocuments(documents)
  return updated
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
