import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { useCallback, useEffect, useRef, useState } from 'react'
import Toolbar from './Toolbar'
import AgentSidebar from './AgentSidebar'
import ProviderSettingsPanel from './ProviderSettingsPanel'
import { isDesktopApp } from './lib/isDesktop'
import {
  getDocument,
  saveDocument,
} from './lib/documents'
import { InlineReview } from './extensions/InlineReview'

const PAGE_HEIGHT_PX = 1056 // 11in at 96dpi
const PAGE_GAP_PX = 24
const DEFAULT_TEXT_COLOR = '#000000'
const DEFAULT_TITLE = 'Untitled document'

interface TiptapEditorProps {
  documentId?: string
  onBack?: () => void
  showBack?: boolean
}

function getInitialTitle(documentId?: string) {
  if (!documentId) return DEFAULT_TITLE
  return getDocument(documentId)?.title ?? DEFAULT_TITLE
}

export default function TiptapEditor({ documentId, onBack, showBack }: TiptapEditorProps) {
  const [pageCount, setPageCount] = useState(1)
  const [agentOpen, setAgentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [title, setTitle] = useState(() => getInitialTitle(documentId))
  const titleRef = useRef(title)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  titleRef.current = title

  const initialContent = documentId
    ? getDocument(documentId)?.content ?? '<p></p>'
    : '<p></p>'

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      InlineReview,
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      editor.chain().focus().setColor(DEFAULT_TEXT_COLOR).run()
    },
  }, [documentId])

  useEffect(() => {
    setTitle(getInitialTitle(documentId))
  }, [documentId])

  useEffect(() => {
    if (!editor) return

    const updatePageCount = () => {
      const contentEl = editor.view.dom.closest('.editor-content')
      const totalHeight = contentEl?.scrollHeight ?? editor.view.dom.scrollHeight
      const pages = Math.max(1, Math.ceil(totalHeight / PAGE_HEIGHT_PX))
      setPageCount(pages)
    }

    updatePageCount()
    editor.on('update', updatePageCount)
    editor.on('selectionUpdate', updatePageCount)

    return () => {
      editor.off('update', updatePageCount)
      editor.off('selectionUpdate', updatePageCount)
    }
  }, [editor])

  // Content autosave must not write the title — remount/effect cleanup used to
  // persist the default "Untitled document" before the real title loaded.
  const persistContent = useCallback(() => {
    if (!editor || !documentId) return
    saveDocument(documentId, { content: editor.getHTML() })
  }, [editor, documentId])

  const persistTitleIfSet = useCallback(() => {
    if (!documentId) return
    const trimmed = titleRef.current.trim()
    if (!trimmed) return
    saveDocument(documentId, { title: trimmed })
  }, [documentId])

  useEffect(() => {
    if (!editor || !documentId) return

    const handleUpdate = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(persistContent, 500)
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      persistContent()
      persistTitleIfSet()
    }
  }, [editor, documentId, persistContent, persistTitleIfSet])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    titleRef.current = value
  }

  const handleTitleBlur = () => {
    const trimmed = titleRef.current.trim() || DEFAULT_TITLE
    setTitle(trimmed)
    titleRef.current = trimmed

    if (documentId) {
      saveDocument(documentId, { title: trimmed })
    }
  }

  const documentHeight =
    pageCount * PAGE_HEIGHT_PX + (pageCount - 1) * PAGE_GAP_PX

  return (
    <div className="flex w-full">
      <div className="editor-workspace flex-1 min-w-0">
        <Toolbar
          editor={editor}
          onToggleAgent={() => setAgentOpen((v) => !v)}
          onOpenSettings={isDesktopApp() ? () => setSettingsOpen(true) : undefined}
          onBack={onBack}
          showBack={showBack}
          documentTitle={documentId ? title : undefined}
          onDocumentTitleChange={documentId ? handleTitleChange : undefined}
          onDocumentTitleBlur={documentId ? handleTitleBlur : undefined}
        />
        <div className="editor-scroll">
          <div
            className="editor-document"
            style={{ minHeight: documentHeight }}
          >
            <div className="editor-pages" aria-hidden="true">
              {Array.from({ length: pageCount }, (_, index) => (
                <div
                  key={index}
                  className="editor-page"
                  style={{ top: index * (PAGE_HEIGHT_PX + PAGE_GAP_PX) }}
                />
              ))}
            </div>
            <EditorContent editor={editor} className="editor-content" />
          </div>
        </div>
      </div>
      <AgentSidebar editor={editor} open={agentOpen} onClose={() => setAgentOpen(false)} />
      {settingsOpen && <ProviderSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
