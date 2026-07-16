import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { PaginationPlus } from 'tiptap-pagination-plus'
import { useCallback, useEffect, useRef, useState } from 'react'
import Toolbar from './Toolbar'
import AgentSidebar from './AgentSidebar'
import ProviderSettingsPanel from './ProviderSettingsPanel'
import DownloadModal from './DownloadModal'
import { isDesktopApp } from './lib/isDesktop'
import { isDemoLimitReached, syncDemoUsageWithServer } from './lib/demoUsage'
import {
  getDocument,
  saveDocument,
} from './lib/documents'
import { InlineReview } from './extensions/InlineReview'
import { useTheme } from './lib/theme'
import {
  PAGE_GAP_PX,
  PAGE_HEADER_CONTENT_GAP_PX,
  PAGE_HEIGHT_PX,
  PAGE_MARGIN_PX,
  PAGE_WIDTH_PX,
  canvasColorForTheme,
  pageHeaderLeftHtml,
} from './lib/pageLayout'

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
  const { theme } = useTheme()
  const isWebDemo = !documentId && !isDesktopApp()
  const [agentOpen, setAgentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agentLocked, setAgentLocked] = useState(() => isWebDemo && isDemoLimitReached())
  const [showDownloadModal, setShowDownloadModal] = useState(() => isWebDemo && isDemoLimitReached())
  const [title, setTitle] = useState(() => getInitialTitle(documentId))
  const titleRef = useRef(title)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  titleRef.current = title

  const initialContent = documentId
    ? getDocument(documentId)?.content ?? '<p></p>'
    : '<p></p>'

  const canvasColor = canvasColorForTheme(theme)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      InlineReview,
      PaginationPlus.configure({
        pageHeight: PAGE_HEIGHT_PX,
        pageWidth: PAGE_WIDTH_PX,
        pageGap: PAGE_GAP_PX,
        pageGapBorderSize: 0,
        pageGapBorderColor: canvasColor,
        pageBreakBackground: canvasColor,
        marginTop: PAGE_MARGIN_PX,
        marginBottom: PAGE_MARGIN_PX,
        marginLeft: PAGE_MARGIN_PX,
        marginRight: PAGE_MARGIN_PX,
        contentMarginTop: PAGE_HEADER_CONTENT_GAP_PX,
        contentMarginBottom: 0,
        headerLeft: pageHeaderLeftHtml(documentId ? getInitialTitle(documentId) : undefined),
        headerRight: '',
        footerLeft: '',
        footerRight: '',
      }),
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      editor.chain().focus().setColor(DEFAULT_TEXT_COLOR).run()
    },
  }, [documentId])

  useEffect(() => {
    if (!editor) return
    editor.chain().updatePageBreakBackground(canvasColor).run()
    editor.view.dom.style.setProperty('--rm-page-gap-border-color', canvasColor)
  }, [editor, canvasColor])

  useEffect(() => {
    if (!editor) return
    editor
      .chain()
      .updateHeaderContent(pageHeaderLeftHtml(documentId ? title : undefined), '')
      .run()
  }, [editor, documentId, title])

  useEffect(() => {
    setTitle(getInitialTitle(documentId))
  }, [documentId])

  const handleDemoLimitReached = useCallback(() => {
    setAgentLocked(true)
    setShowDownloadModal(true)
  }, [])

  // The cached "limit reached" state above may be stale (e.g. the API server
  // restarted since the last visit, resetting its usage counter). Reconcile
  // with the server once on mount so a stale local cache can't lock the demo
  // out permanently.
  useEffect(() => {
    if (!isWebDemo) return
    syncDemoUsageWithServer().then(() => {
      const stillReached = isDemoLimitReached()
      setAgentLocked(stillReached)
      setShowDownloadModal(stillReached)
    })
  }, [isWebDemo])

  const handleKeepBrowsing = useCallback(() => {
    setShowDownloadModal(false)
  }, [])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!showDownloadModal)
  }, [editor, showDownloadModal])

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

  return (
    <div className="flex w-full">
      <div className={`editor-workspace flex-1 min-w-0${showDownloadModal ? ' editor-workspace--locked' : ''}`}>
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
          <div className="editor-document">
            <EditorContent editor={editor} className="editor-content" />
          </div>
        </div>
      </div>
      <AgentSidebar
        editor={editor}
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        isDemoMode={isWebDemo}
        agentLocked={agentLocked}
        onDemoLimitReached={handleDemoLimitReached}
      />
      {settingsOpen && <ProviderSettingsPanel onClose={() => setSettingsOpen(false)} />}
      {showDownloadModal && (
        <DownloadModal onClose={handleKeepBrowsing} />
      )}
    </div>
  )
}
