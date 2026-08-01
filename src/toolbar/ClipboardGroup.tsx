import { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { CopyIcon, CutIcon, Icon, PasteIcon } from './icons'
import { ToolbarButton } from './ToolbarButton'

function getSelectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}

export function ClipboardGroup({ editor }: { editor: Editor }) {
  const [pasteBlocked, setPasteBlocked] = useState(false)

  useEffect(() => {
    if (!pasteBlocked) return
    const timer = setTimeout(() => setPasteBlocked(false), 4000)
    return () => clearTimeout(timer)
  }, [pasteBlocked])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setPasteBlocked(false)
      if (text) {
        editor.chain().focus().insertContent(text).run()
      }
    } catch {
      editor.chain().focus().run()
      setPasteBlocked(true)
    }
  }

  const handleCopy = async () => {
    const text = getSelectedText(editor)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard unavailable
    }
  }

  const handleCut = async () => {
    const text = getSelectedText(editor)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      editor.chain().focus().deleteSelection().run()
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="relative inline-flex items-center gap-[2px]">
      <ToolbarButton label="Paste" onClick={() => void handlePaste()}>
        <Icon><PasteIcon /></Icon>
      </ToolbarButton>
      <ToolbarButton label="Cut" onClick={() => void handleCut()}>
        <Icon><CutIcon /></Icon>
      </ToolbarButton>
      <ToolbarButton label="Copy" onClick={() => void handleCopy()}>
        <Icon><CopyIcon /></Icon>
      </ToolbarButton>
      {pasteBlocked && (
        <span role="status" className="outlook-paste-hint">
          Clipboard access blocked — use Ctrl+V instead
        </span>
      )}
    </div>
  )
}
