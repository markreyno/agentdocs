import { Editor } from '@tiptap/react'
import { CopyIcon, CutIcon, Icon, PasteIcon } from './icons'
import { ToolbarButton } from './ToolbarButton'

function getSelectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}

export function ClipboardGroup({ editor }: { editor: Editor }) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        editor.chain().focus().insertContent(text).run()
      }
    } catch {
      editor.chain().focus().run()
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
    <>
      <ToolbarButton label="Paste" onClick={() => void handlePaste()}>
        <Icon><PasteIcon /></Icon>
      </ToolbarButton>
      <ToolbarButton label="Cut" onClick={() => void handleCut()}>
        <Icon><CutIcon /></Icon>
      </ToolbarButton>
      <ToolbarButton label="Copy" onClick={() => void handleCopy()}>
        <Icon><CopyIcon /></Icon>
      </ToolbarButton>
    </>
  )
}
