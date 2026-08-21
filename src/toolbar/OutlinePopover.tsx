import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { buildDocTree, type DocNode, type DocNodeType } from '../lib/docTree'
import { Icon, OutlineIcon } from './icons'
import { keepEditorSelection } from './keepEditorSelection'
import { ToolbarButton } from './ToolbarButton'
import { useClickOutside } from './useClickOutside'

const OUTLINE_TYPES = new Set<DocNodeType>(['book', 'act', 'chapter', 'scene'])

const OUTLINE_TYPE_LABEL: Record<'book' | 'act' | 'chapter' | 'scene', string> = {
  book: 'Book',
  act: 'Act',
  chapter: 'Chapter',
  scene: 'Scene',
}

function outlineLabel(node: DocNode): string {
  const title = sanitizeOutlineText(node.title).trim()
  if (title) return title
  if (node.type === 'book' || node.type === 'act' || node.type === 'chapter' || node.type === 'scene') {
    return `${OUTLINE_TYPE_LABEL[node.type]} ${node.order + 1}`
  }
  return node.type
}

function sanitizeOutlineText(value: string | undefined): string {
  if (!value) return ''
  let out = ''
  for (const ch of value) {
    const cp = ch.codePointAt(0)!
    if (cp === 0 || (cp >= 0xd800 && cp <= 0xdfff)) continue
    if (cp < 32) continue
    out += ch
  }
  return out
}

function toOutlineTree(node: DocNode): DocNode {
  return {
    id: node.id,
    type: node.type,
    order: node.order,
    title: sanitizeOutlineText(node.title) || undefined,
    pos: node.pos,
    children: (node.children ?? [])
      .filter((child) => OUTLINE_TYPES.has(child.type))
      .map(toOutlineTree),
  }
}

function jumpToOutlineNode(editor: Editor, node: DocNode) {
  if (node.type === 'book') {
    editor.chain().focus().setTextSelection(1).scrollIntoView().run()
    return
  }

  const title = node.title?.trim()
  if (title) {
    let foundPos: number | null = null
    editor.state.doc.descendants((pmNode, pos) => {
      if (foundPos != null || pmNode.type.name !== 'heading') return
      if (pmNode.textContent === title) {
        foundPos = pos + 1
        return false
      }
    })
    if (foundPos != null) {
      editor.chain().focus().setTextSelection(foundPos).scrollIntoView().run()
      return
    }
  }

  const max = editor.state.doc.content.size
  const from = Math.max(1, Math.min(node.pos.from || 1, max))
  editor.chain().focus().setTextSelection(from).scrollIntoView().run()
}

function OutlineTreeNode({
  node,
  depth,
  editor,
  onNavigate,
}: {
  node: DocNode
  depth: number
  editor: Editor
  onNavigate: () => void
}) {
  if (!OUTLINE_TYPES.has(node.type)) return null

  const children = (node.children ?? []).filter((child) => OUTLINE_TYPES.has(child.type))
  const typeKey = node.type as 'book' | 'act' | 'chapter' | 'scene'

  return (
    <li className="outlook-outline-item">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => {
          jumpToOutlineNode(editor, node)
          onNavigate()
        }}
        className="outlook-outline-row"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span className={`outlook-outline-type outlook-outline-type--${typeKey}`}>
          {OUTLINE_TYPE_LABEL[typeKey]}
        </span>
        <span className="outlook-outline-title">{outlineLabel(node)}</span>
      </button>
      {children.length > 0 && (
        <ul className="outlook-outline-list">
          {children.map((child) => (
            <OutlineTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              editor={editor}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OutlinePopover({ editor, documentTitle }: { editor: Editor; documentTitle?: string }) {
  const [open, setOpen] = useState(false)
  const [tree, setTree] = useState<DocNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, open, () => setOpen(false))

  useEffect(() => {
    if (!open) return

    const refresh = () => {
      try {
        const next = toOutlineTree(
          buildDocTree(editor.getJSON(), documentTitle?.trim() || 'Untitled document'),
        )
        setTree(next)
        setError(null)
      } catch (cause) {
        console.error('Failed to build document outline', cause)
        setTree(null)
        setError('Could not build the document outline for this file.')
      }
    }

    refresh()
    let timer = 0
    const onUpdate = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, 250)
    }
    editor.on('update', onUpdate)
    return () => {
      window.clearTimeout(timer)
      editor.off('update', onUpdate)
    }
  }, [open, editor, documentTitle])

  const sectionChildren = (tree?.children ?? []).filter((child) => OUTLINE_TYPES.has(child.type))
  const hasSections = sectionChildren.length > 0

  return (
    <div ref={containerRef} className="relative">
      <ToolbarButton label="Document outline" isActive={open} onClick={() => setOpen((prev) => !prev)}>
        <Icon><OutlineIcon /></Icon>
      </ToolbarButton>

      {open && (tree || error) && (
        <div className="outlook-outline-panel" role="dialog" aria-label="Document outline">
          <div className="outlook-outline-header">Document outline</div>
          {error ? (
            <p className="outlook-outline-empty">{error}</p>
          ) : tree ? (
            <>
              <ul className="outlook-outline-list">
                <OutlineTreeNode
                  node={tree}
                  depth={0}
                  editor={editor}
                  onNavigate={() => setOpen(false)}
                />
              </ul>
              {!hasSections && (
                <p className="outlook-outline-empty">
                  Add headings to build acts, chapters, and scenes.
                </p>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
