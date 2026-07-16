import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { computeDiff, type DiffOp } from '../lib/diffEngine'
import { applyReviewHunkToTransaction } from '../lib/applyReviewHunk'

export type ReviewHunk = {
  baseFrom: number
  baseTo: number
  baseText: string
  proposedText: string
  ops: DiffOp[]
}

export type ReviewSessionState = {
  id: string
  hunks: ReviewHunk[]
  streaming: boolean
}

export type ReviewHunkOptions = {
  from: number
  to: number
  baseText: string
  proposedText: string
}

export type StartReviewOptions = {
  from?: number
  to?: number
  baseText?: string
  proposedText?: string
  streaming?: boolean
  hunks?: ReviewHunkOptions[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineReview: {
      startReview: (options: StartReviewOptions) => ReturnType
      appendReviewHunks: (hunks: ReviewHunkOptions[]) => ReturnType
      updateReviewProposed: (proposedText: string, streaming?: boolean) => ReturnType
      setReviewStreaming: (streaming: boolean) => ReturnType
      acceptReview: () => ReturnType
      rejectReview: () => ReturnType
    }
  }
}

type ReviewMeta =
  | { type: 'start'; session: ReviewSessionState }
  | { type: 'append'; session: ReviewSessionState }
  | { type: 'update'; proposedText: string; streaming: boolean }
  | { type: 'streaming'; streaming: boolean }
  | { type: 'accept'; session: ReviewSessionState }
  | { type: 'reject' }
  | { type: 'clear' }

type ReviewPluginState = {
  session: ReviewSessionState | null
  decorations: DecorationSet
}

export const inlineReviewKey = new PluginKey<ReviewPluginState>('inlineReview')

function newSessionId() {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildHunk(
  baseFrom: number,
  baseTo: number,
  baseText: string,
  proposedText: string,
): ReviewHunk {
  return {
    baseFrom,
    baseTo,
    baseText,
    proposedText,
    ops: computeDiff(baseText, proposedText),
  }
}

function normalizeStartOptions(options: StartReviewOptions): ReviewHunk[] {
  if (options.hunks?.length) {
    return options.hunks.map((hunk) =>
      buildHunk(hunk.from, hunk.to, hunk.baseText, hunk.proposedText),
    )
  }

  const from = options.from ?? 0
  const to = options.to ?? from
  const baseText = options.baseText ?? ''
  const proposedText = options.proposedText ?? ''
  return [buildHunk(from, to, baseText, proposedText)]
}

function buildSession(id: string, hunks: ReviewHunk[], streaming: boolean): ReviewSessionState {
  return { id, hunks, streaming }
}

function dedupeHunks(hunks: ReviewHunk[]): ReviewHunk[] {
  const seen = new Set<string>()
  const out: ReviewHunk[] = []
  for (const hunk of hunks) {
    const key = `${hunk.baseFrom}:${hunk.baseTo}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hunk)
  }
  return out
}

function createInsertWidget(text: string): HTMLElement {
  const span = document.createElement('span')
  span.className = 'review-insert'
  span.textContent = text
  span.contentEditable = 'false'
  return span
}

function createBadgeWidget(view: EditorView, session: ReviewSessionState): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = 'review-badge'
  wrap.contentEditable = 'false'

  if (session.streaming) {
    const status = document.createElement('span')
    status.className = 'review-badge-status'
    status.textContent = 'Updating…'
    wrap.appendChild(status)
  }

  const accept = document.createElement('button')
  accept.type = 'button'
  accept.className = 'review-badge-btn review-badge-accept'
  accept.textContent = session.hunks.length > 1 ? `Accept all (${session.hunks.length})` : 'Accept'
  accept.disabled = session.streaming
  accept.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  accept.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const current = inlineReviewKey.getState(view.state)?.session
    if (!current || current.streaming) return
    view.dispatch(view.state.tr.setMeta(inlineReviewKey, { type: 'accept', session: current } satisfies ReviewMeta))
  })

  const reject = document.createElement('button')
  reject.type = 'button'
  reject.className = 'review-badge-btn review-badge-reject'
  reject.textContent = 'Reject'
  reject.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  reject.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    view.dispatch(view.state.tr.setMeta(inlineReviewKey, { type: 'reject' } satisfies ReviewMeta))
  })

  wrap.appendChild(accept)
  wrap.appendChild(reject)
  return wrap
}

function buildDecorations(state: EditorState, session: ReviewSessionState): DecorationSet {
  const decos: Decoration[] = []
  const lastHunk = session.hunks[session.hunks.length - 1]

  for (const [index, hunk] of session.hunks.entries()) {
    const { baseFrom, baseTo, baseText, proposedText } = hunk

    if (baseTo > baseFrom && baseText) {
      decos.push(
        Decoration.inline(baseFrom, baseTo, {
          class: 'review-delete',
        }),
      )
    }

    if (proposedText) {
      decos.push(
        Decoration.widget(baseTo, () => createInsertWidget(proposedText), {
          side: 1,
          key: `ins-${session.id}-${index}-${proposedText.length}`,
        }),
      )
    }
  }

  if (lastHunk) {
    decos.push(
      Decoration.widget(lastHunk.baseTo, (view) => createBadgeWidget(view, session), {
        side: 1,
        key: `badge-${session.id}-${session.streaming}-${session.hunks.length}`,
      }),
    )
  }

  return DecorationSet.create(state.doc, decos)
}

function mapSession(tr: Transaction, session: ReviewSessionState): ReviewSessionState | null {
  const hunks = session.hunks
    .map((hunk) => {
      const baseFrom = tr.mapping.map(hunk.baseFrom, 1)
      const baseTo = tr.mapping.map(hunk.baseTo, -1)
      if (baseTo < baseFrom) return null
      return { ...hunk, baseFrom, baseTo }
    })
    .filter((hunk): hunk is ReviewHunk => hunk !== null)

  if (hunks.length === 0) return null
  return { ...session, hunks }
}

function transactionTouchesSession(tr: Transaction, session: ReviewSessionState): boolean {
  let touches = false
  tr.mapping.maps.forEach((map) => {
    map.forEach((oldStart, oldEnd) => {
      for (const hunk of session.hunks) {
        if (oldStart < hunk.baseTo && oldEnd > hunk.baseFrom) {
          touches = true
        }
      }
    })
  })
  return touches
}

export const InlineReview = Extension.create({
  name: 'inlineReview',

  addCommands() {
    return {
      startReview:
        (options: StartReviewOptions) =>
        ({ tr, dispatch }) => {
          const session = buildSession(
            newSessionId(),
            normalizeStartOptions(options),
            options.streaming ?? false,
          )
          if (dispatch) {
            dispatch(tr.setMeta(inlineReviewKey, { type: 'start', session } satisfies ReviewMeta))
          }
          return true
        },

      appendReviewHunks:
        (hunks: ReviewHunkOptions[]) =>
        ({ state, tr, dispatch }) => {
          const existing = inlineReviewKey.getState(state)?.session
          if (!existing || existing.streaming || hunks.length === 0) return false

          const appended = hunks.map((hunk) =>
            buildHunk(hunk.from, hunk.to, hunk.baseText, hunk.proposedText),
          )
          const merged = dedupeHunks([...existing.hunks, ...appended])
          const session = buildSession(existing.id, merged, false)
          if (dispatch) {
            dispatch(tr.setMeta(inlineReviewKey, { type: 'append', session } satisfies ReviewMeta))
          }
          return true
        },

      updateReviewProposed:
        (proposedText: string, streaming = true) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(
              tr.setMeta(inlineReviewKey, {
                type: 'update',
                proposedText,
                streaming,
              } satisfies ReviewMeta),
            )
          }
          return true
        },

      setReviewStreaming:
        (streaming: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(inlineReviewKey, { type: 'streaming', streaming } satisfies ReviewMeta))
          }
          return true
        },

      acceptReview:
        () =>
        ({ state, dispatch }) => {
          const session = inlineReviewKey.getState(state)?.session
          if (!session || session.streaming) return false
          if (dispatch) {
            dispatch(state.tr.setMeta(inlineReviewKey, { type: 'accept', session } satisfies ReviewMeta))
          }
          return true
        },

      rejectReview:
        () =>
        ({ tr, dispatch, state }) => {
          if (!inlineReviewKey.getState(state)?.session) return false
          if (dispatch) {
            dispatch(tr.setMeta(inlineReviewKey, { type: 'reject' } satisfies ReviewMeta))
          }
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': ({ editor }) => {
        const session = inlineReviewKey.getState(editor.state)?.session
        if (!session || session.streaming) return false
        return editor.commands.acceptReview()
      },
      Escape: ({ editor }) => {
        if (!inlineReviewKey.getState(editor.state)?.session) return false
        return editor.commands.rejectReview()
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<ReviewPluginState>({
        key: inlineReviewKey,

        state: {
          init(): ReviewPluginState {
            return { session: null, decorations: DecorationSet.empty }
          },

          apply(tr, value, _oldState, newState): ReviewPluginState {
            const meta = tr.getMeta(inlineReviewKey) as ReviewMeta | undefined

            if (meta?.type === 'clear' || meta?.type === 'reject') {
              return { session: null, decorations: DecorationSet.empty }
            }

            if (meta?.type === 'start' || meta?.type === 'append') {
              return {
                session: meta.session,
                decorations: buildDecorations(newState, meta.session),
              }
            }

            if (meta?.type === 'accept') {
              return value
            }

            let session = value.session

            if (meta?.type === 'update' && session?.hunks.length === 1) {
              const hunk = session.hunks[0]!
              session = buildSession(
                session.id,
                [buildHunk(hunk.baseFrom, hunk.baseTo, hunk.baseText, meta.proposedText)],
                meta.streaming,
              )
            } else if (meta?.type === 'streaming' && session) {
              session = { ...session, streaming: meta.streaming }
            } else if (session && tr.docChanged) {
              if (transactionTouchesSession(tr, session)) {
                return { session: null, decorations: DecorationSet.empty }
              }
              const mapped = mapSession(tr, session)
              if (!mapped) {
                return { session: null, decorations: DecorationSet.empty }
              }
              session = mapped
            }

            if (!session) {
              return { session: null, decorations: DecorationSet.empty }
            }

            if (meta || tr.docChanged || tr.selectionSet) {
              return { session, decorations: buildDecorations(newState, session) }
            }

            return { session, decorations: value.decorations }
          },
        },

        props: {
          decorations(state) {
            return inlineReviewKey.getState(state)?.decorations ?? DecorationSet.empty
          },
        },

        appendTransaction(transactions, _oldState, newState) {
          const acceptTr = transactions.find((tr) => {
            const meta = tr.getMeta(inlineReviewKey) as ReviewMeta | undefined
            return meta?.type === 'accept'
          })
          if (!acceptTr) return null

          const meta = acceptTr.getMeta(inlineReviewKey) as Extract<ReviewMeta, { type: 'accept' }>
          const session = meta.session
          if (!session) return null

          const tr = newState.tr
          const sorted = [...session.hunks].sort((a, b) => b.baseFrom - a.baseFrom)
          for (const hunk of sorted) {
            const from = tr.mapping.map(hunk.baseFrom, 1)
            const to = tr.mapping.map(hunk.baseTo, -1)
            if (to < from && !hunk.proposedText) continue
            applyReviewHunkToTransaction(tr, from, to, hunk.baseText, hunk.proposedText)
          }
          tr.setMeta(inlineReviewKey, { type: 'clear' } satisfies ReviewMeta)
          tr.setMeta('addToHistory', true)
          return tr
        },
      }),
    ]
  },
})

export function getActiveReview(state: EditorState): ReviewSessionState | null {
  return inlineReviewKey.getState(state)?.session ?? null
}
