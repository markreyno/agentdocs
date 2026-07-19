import { getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'

const schema = getSchema([StarterKit])

/** Build a ProseMirror doc from TipTap JSON (no DOM required). */
export function docFromJSON(content: JSONContent): PMNode {
  return schema.nodeFromJSON(content)
}

export function paragraph(text: string): JSONContent {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : undefined,
  }
}

export function heading(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

export function simpleDoc(...blocks: JSONContent[]): PMNode {
  return docFromJSON({ type: 'doc', content: blocks })
}

export function editorStateFromDoc(doc: PMNode): EditorState {
  return EditorState.create({ doc, schema })
}
