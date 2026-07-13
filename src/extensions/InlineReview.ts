import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { computeDiff, type DiffOp } from '../lib/diffEngine'

export type ReviewSessionState = {
  id: string
  baseFrom: number
  baseTo: number
  baseText: string
  proposedText: string
  ops: DiffOp[]
  streaming: boolean
}

export type StartReviewOptions = {
  from: number
  to: number
  baseText: string
  proposedText?: string
  streaming?: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineReview: {
      startReview: (options: StartReviewOptions) => ReturnType
      updateReviewProposed: (proposedText: string, streaming?: boolean) => ReturnType
      setReviewStreaming: (streaming: boolean) => ReturnType
      acceptReview: () => ReturnType
      rejectReview: () => ReturnType
    }
  }
}

type ReviewMeta =
  | { type: 'start'; session: ReviewSessionState }
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

function buildSession(
  id: string,
  baseFrom: number,
  baseTo: number,
  baseText: string,
  proposedText: string,
  streaming: boolean,
): ReviewSessionState {
  return {
    id,
    baseFrom,
    baseTo,
    baseText,
    proposedText,
    ops: computeDiff(baseText, proposedText),
    streaming,
  }
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
  accept.textContent = 'Accept'
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
  const { baseFrom, baseTo, baseText, proposedText } = session
  const decos: Decoration[] = []

  // Entire superseded span: red + strike-through (removed on Accept).
  if (baseTo > baseFrom && baseText) {
    decos.push(Decoration.inline(baseFrom, baseTo, { class: 'review-delete' }))
  }

  // Proposed replacement shown as green insert preview.
  if (proposedText) {
    decos.push(
      Decoration.widget(baseTo, () => createInsertWidget(proposedText), {
        side: 1,
        key: `ins-${session.id}-${proposedText.length}`,
      }),
    )
  }

  decos.push(
    Decoration.widget(baseTo, (view) => createBadgeWidget(view, session), {
      side: 1,
      key: `badge-${session.id}-${session.streaming}-${proposedText.length}`,
    }),
  )

  return DecorationSet.create(state.doc, decos)
}

function mapSession(tr: Transaction, session: ReviewSessionState): ReviewSessionState | null {
  const baseFrom = tr.mapping.map(session.baseFrom, 1)
  const baseTo = tr.mapping.map(session.baseTo, -1)
  if (baseTo < baseFrom) return null
  return { ...session, baseFrom, baseTo }
}

function transactionTouchesSession(tr: Transaction, session: ReviewSessionState): boolean {
  let touches = false
  tr.mapping.maps.forEach((map) => {
    map.forEach((oldStart, oldEnd) => {
      if (oldStart < session.baseTo && oldEnd > session.baseFrom) {
        touches = true
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
            options.from,
            options.to,
            options.baseText,
            options.proposedText ?? '',
            options.streaming ?? false,
          )
          if (dispatch) {
            dispatch(tr.setMeta(inlineReviewKey, { type: 'start', session } satisfies ReviewMeta))
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

            if (meta?.type === 'start') {
              return {
                session: meta.session,
                decorations: buildDecorations(newState, meta.session),
              }
            }

            if (meta?.type === 'accept') {
              // Keep session until appendTransaction commits + clears
              return value
            }

            let session = value.session

            if (meta?.type === 'update' && session) {
              session = buildSession(
                session.id,
                session.baseFrom,
                session.baseTo,
                session.baseText,
                meta.proposedText,
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
          if (session.proposedText) {
            tr.insertText(session.proposedText, session.baseFrom, session.baseTo)
          } else if (session.baseTo > session.baseFrom) {
            tr.delete(session.baseFrom, session.baseTo)
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
