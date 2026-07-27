import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { ReplaceTextResult } from '../../shared/editTools'
import {
  describeInsert,
  insertSpecsToJSON,
  resolveInsertBlocks,
  resolveStoryEdit,
  type EditableStoryBlock,
  type InsertBlocksInput,
  type InsertBlocksResult,
  type ReplaceStoryInput,
  type StoryBlockInfo,
} from '../../shared/storyEdit'
import { getActiveReview } from '../extensions/InlineReview'

export type {
  EditableStoryBlock,
  InsertBlockSpec,
  InsertBlocksInput,
  InsertBlocksResult,
  ReplaceStoryInput,
  ReplaceStoryUpdate,
  StoryBlockInfo,
  StoryBlockKind,
} from '../../shared/storyEdit'
export {
  describeInsert,
  getStoryBlocksFromTree,
  insertPosAfterIndex,
  insertSpecsToJSON,
  proposeInsertBlocksInTree,
  proposeReplaceStoryInTree,
  resolveInsertBlocks,
  resolveStoryEdit,
} from '../../shared/storyEdit'

function listEditableStoryBlocks(doc: PMNode): EditableStoryBlock[] {
  const blocks: EditableStoryBlock[] = []
  let index = 0

  doc.forEach((node, offset) => {
    const typeName = node.type.name
    if (typeName === 'horizontalRule') return

    if (typeName === 'heading') {
      const from = offset + 1
      const to = offset + node.nodeSize - 1
      blocks.push({
        index: index++,
        kind: 'heading',
        from,
        to,
        text: doc.textBetween(from, to, '\n'),
        level: (node.attrs?.level as number | undefined) ?? 1,
      })
      return
    }

    if (node.isTextblock) {
      const from = offset + 1
      const to = offset + node.nodeSize - 1
      blocks.push({
        index: index++,
        kind: 'paragraph',
        from,
        to,
        text: to > from ? doc.textBetween(from, to, '\n') : '',
      })
    }
  })

  return blocks
}

export function getStoryBlockInfos(doc: PMNode): StoryBlockInfo[] {
  return listEditableStoryBlocks(doc).map((block) => ({
    index: block.index,
    kind: block.kind,
    text: block.text,
    level: block.level,
  }))
}

export function resolveReplaceStoryInEditor(editor: Editor, input: ReplaceStoryInput): ReplaceTextResult {
  return resolveStoryEdit(listEditableStoryBlocks(editor.state.doc), input)
}

/** One non-overlapping review; clears any prior review first. */
export function applyReplaceStoryInEditor(editor: Editor, input: ReplaceStoryInput): ReplaceTextResult {
  const result = resolveReplaceStoryInEditor(editor, input)
  if (result.status !== 'proposed') return result

  const existing = getActiveReview(editor.state)
  if (
    existing &&
    !existing.streaming &&
    existing.hunks.length === result.hunks.length &&
    existing.hunks.every(
      (hunk, i) =>
        hunk.baseFrom === result.hunks[i]!.from &&
        hunk.baseTo === result.hunks[i]!.to &&
        hunk.proposedText === result.hunks[i]!.replace,
    )
  ) {
    return result
  }

  editor.commands.rejectReview()

  const hunkOptions = result.hunks.map((hunk) => ({
    from: hunk.from,
    to: hunk.to,
    baseText: hunk.matchedText,
    proposedText: hunk.replace,
  }))

  editor
    .chain()
    .startReview({ hunks: hunkOptions, streaming: false })
    .setTextSelection(result.hunks[result.hunks.length - 1]!.to)
    .scrollIntoView()
    .run()

  return result
}

/** @deprecated Use getStoryBlockInfos */
export function listEditableBlocks(doc: PMNode) {
  return listEditableStoryBlocks(doc)
    .filter((b) => b.kind === 'paragraph')
    .map((b) => ({
      index: b.index,
      from: b.from,
      to: b.to,
      text: b.text,
    }))
}

/** Insert new heading/paragraph nodes into the live editor (applies immediately). */
export function applyInsertBlocksInEditor(editor: Editor, input: InsertBlocksInput): InsertBlocksResult {
  const blocks = listEditableStoryBlocks(editor.state.doc)
  const resolved = resolveInsertBlocks(blocks, input)
  if ('error' in resolved) {
    return { status: 'error', message: resolved.error }
  }

  const { specs, afterIndex, pos } = resolved
  const content = insertSpecsToJSON(specs)

  editor.commands.rejectReview()

  const ok = editor
    .chain()
    .insertContentAt(pos, content)
    .setTextSelection(pos + 1)
    .scrollIntoView()
    .run()

  if (!ok) {
    return { status: 'error', message: 'Failed to insert blocks into the editor' }
  }

  // Approximate the end of the inserted region for status reporting.
  const insertedText = specs.map((s) => s.text).join('\n')
  return {
    status: 'applied',
    after_index: afterIndex,
    inserted: specs.length,
    from: pos,
    to: pos + insertedText.length + specs.length * 2,
    message: describeInsert(specs, afterIndex),
  }
}
