import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Toolbar from './Toolbar'

export default function TiptapEditor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<h1>Hello!</h1><p>Start typing, or use the toolbar above.</p>',
  })

  return (
    <div className="border border-gray-200 rounded-lg max-w-2xl shadow-sm">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="p-4 min-h-60 prose prose-sm max-w-none focus:outline-none"
      />
    </div>
  )
}
