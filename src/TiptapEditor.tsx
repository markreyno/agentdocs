import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { useEffect, useState } from 'react'
import Toolbar from './Toolbar'

const PAGE_HEIGHT_PX = 1056 // 11in at 96dpi
const PAGE_GAP_PX = 24

export default function TiptapEditor() {
  const [pageCount, setPageCount] = useState(1)

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color],
    content: '<p></p>',
  })

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

  const documentHeight =
    pageCount * PAGE_HEIGHT_PX + (pageCount - 1) * PAGE_GAP_PX

  return (
    <div className="editor-workspace">
      <Toolbar editor={editor} />
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
  )
}
