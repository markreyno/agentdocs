import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { sendChatMessage } from './lib/agentChat'
import type { ChatMessage } from './lib/chatClient'
import { withDocumentContext } from './lib/documentContext'
import { isDesktopApp } from './lib/isDesktop'
import { findSkill, parseSlashCommand, resolveSkillTemplate, useSkills } from './lib/skills'
import {
  locateBestRewriteTarget,
  locateTextInDoc,
  parseFindReplace,
  proposedFromAssistant,
} from './lib/textLocate'
import ProviderSettingsPanel from './ProviderSettingsPanel'

const REVIEW_THROTTLE_MS = 120

interface DisplayMessage {
  role: 'user' | 'assistant'
  /** Text sent to / received from the API. */
  content: string
  /** Text shown in the bubble, if different from content (e.g. the raw "/summarize" the user typed). */
  display?: string
}

interface AgentSidebarProps {
  editor: Editor | null
  open: boolean
  onClose: () => void
}

function getSelectionAndDocument(editor: Editor | null): { selection: string; document: string } {
  if (!editor) return { selection: '', document: '' }
  const { from, to, empty } = editor.state.selection
  const selection = empty ? '' : editor.state.doc.textBetween(from, to, '\n')
  return { selection, document: editor.getText() }
}

export default function AgentSidebar({ editor, open, onClose }: AgentSidebarProps) {
  const { skills, customSkills, addSkill, removeSkill } = useSkills()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [showManageSkills, setShowManageSkills] = useState(false)
  const [showProviderSettings, setShowProviderSettings] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillDescription, setNewSkillDescription] = useState('')
  const [newSkillTemplate, setNewSkillTemplate] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const reviewTargetRef = useRef<{ from: number; to: number; baseText: string } | null>(null)
  const reviewBufferRef = useRef('')
  const reviewThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reviewLocateModeRef = useRef(false)

  useEffect(() => {
    return () => {
      if (reviewThrottleRef.current) clearTimeout(reviewThrottleRef.current)
    }
  }, [])

  if (!open) return null

  const slashCommand = parseSlashCommand(input)
  const isTypingCommandName = slashCommand !== null && !input.includes(' ')
  const suggestions = isTypingCommandName
    ? skills.filter((s) => s.name.toLowerCase().startsWith(slashCommand!.name.toLowerCase()))
    : []

  function applySuggestion(name: string) {
    setInput(`/${name} `)
    inputRef.current?.focus()
  }

  function beginReviewAt(
    from: number,
    to: number,
    baseText: string,
    proposedText: string,
    streaming: boolean,
  ) {
    if (!editor) return
    reviewTargetRef.current = { from, to, baseText }
    editor
      .chain()
      .startReview({ from, to, baseText, proposedText, streaming })
      .setTextSelection(to)
      .scrollIntoView()
      .run()
  }

  /** Attach or refresh an inline review from the latest assistant buffer. */
  function syncAutoLocatedReview(buffer: string, streaming: boolean) {
    if (!editor) return

    const parsed = parseFindReplace(buffer)
    if (parsed?.findComplete && parsed.find.trim()) {
      const range = locateTextInDoc(editor.state.doc, parsed.find)
      if (range) {
        const proposed = parsed.replace
        if (!reviewTargetRef.current) {
          beginReviewAt(range.from, range.to, range.text, proposed, streaming)
        } else {
          reviewBufferRef.current = proposed
          editor.commands.updateReviewProposed(proposed, streaming)
        }
        return
      }
    }

    // Unstructured rewrite: once finished (or late in stream), fuzzy-match a paragraph.
    if (!streaming && !reviewTargetRef.current) {
      const proposed = proposedFromAssistant(buffer).trim()
      if (!proposed) return
      const range = locateBestRewriteTarget(editor.state.doc, proposed)
      if (range) {
        beginReviewAt(range.from, range.to, range.text, proposed, false)
      }
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const raw = input.trim()
    if (!raw || loading) return

    setErrorText(null)
    const { selection, document } = getSelectionAndDocument(editor)
    let apiContent = raw
    const command = parseSlashCommand(raw)
    if (command) {
      const skill = findSkill(skills, command.name)
      if (skill) {
        apiContent = resolveSkillTemplate(skill, { selection, document, args: command.args })
      } else {
        apiContent = withDocumentContext(raw, { selection, document })
      }
    } else {
      apiContent = withDocumentContext(raw, { selection, document })
    }

    const userMessage: DisplayMessage = { role: 'user', content: apiContent, display: raw }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    reviewBufferRef.current = ''
    if (reviewThrottleRef.current) {
      clearTimeout(reviewThrottleRef.current)
      reviewThrottleRef.current = null
    }

    // Selection → review that span immediately. Otherwise locate the passage from the model reply.
    if (editor) {
      const { from, to, empty } = editor.state.selection
      if (!empty) {
        reviewLocateModeRef.current = false
        const baseText = editor.state.doc.textBetween(from, to, '\n')
        beginReviewAt(from, to, baseText, '', true)
      } else {
        reviewLocateModeRef.current = true
        reviewTargetRef.current = null
        editor.commands.rejectReview()
      }
    } else {
      reviewLocateModeRef.current = false
      reviewTargetRef.current = null
    }

    const apiMessages: ChatMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }))

    const flushReviewUpdate = (streaming: boolean) => {
      if (!editor) return
      if (reviewLocateModeRef.current) {
        syncAutoLocatedReview(reviewBufferRef.current, streaming)
        return
      }
      if (!reviewTargetRef.current) return
      editor.commands.updateReviewProposed(reviewBufferRef.current, streaming)
    }

    const scheduleReviewUpdate = () => {
      if (reviewThrottleRef.current) return
      reviewThrottleRef.current = setTimeout(() => {
        reviewThrottleRef.current = null
        flushReviewUpdate(true)
      }, REVIEW_THROTTLE_MS)
    }

    await sendChatMessage(apiMessages, {
      onDelta: (delta) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + delta }
          return updated
        })
        reviewBufferRef.current += delta
        scheduleReviewUpdate()
      },
      onDone: () => {
        if (reviewThrottleRef.current) {
          clearTimeout(reviewThrottleRef.current)
          reviewThrottleRef.current = null
        }
        flushReviewUpdate(false)
        editor?.commands.setReviewStreaming(false)
        reviewTargetRef.current = null
        reviewLocateModeRef.current = false
        setLoading(false)
      },
      onError: (message) => {
        if (reviewThrottleRef.current) {
          clearTimeout(reviewThrottleRef.current)
          reviewThrottleRef.current = null
        }
        editor?.commands.rejectReview()
        reviewTargetRef.current = null
        reviewLocateModeRef.current = false
        setErrorText(message)
        setLoading(false)
      },
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  function insertAtCursor(text: string) {
    editor?.chain().focus().insertContent(text).run()
  }

  function replaceSelection(text: string) {
    if (!editor) return
    const { from, to } = editor.state.selection
    editor.chain().focus().insertContentAt({ from, to }, text).run()
  }

  /** Preview AI text as an inline review — uses selection, or auto-locates the passage in the doc. */
  function reviewInDocument(text: string) {
    if (!editor) return
    const { from, to, empty } = editor.state.selection

    if (!empty) {
      const baseText = editor.state.doc.textBetween(from, to, '\n')
      beginReviewAt(from, to, baseText, proposedFromAssistant(text), false)
      return
    }

    const parsed = parseFindReplace(text)
    if (parsed?.find.trim()) {
      const range = locateTextInDoc(editor.state.doc, parsed.find)
      if (range) {
        beginReviewAt(range.from, range.to, range.text, parsed.replace || proposedFromAssistant(text), false)
        return
      }
    }

    const proposed = proposedFromAssistant(text).trim() || text.trim()
    const range = locateBestRewriteTarget(editor.state.doc, proposed)
    if (range) {
      beginReviewAt(range.from, range.to, range.text, proposed, false)
      return
    }

    // Last resort: insert preview at cursor
    beginReviewAt(from, from, '', proposed, false)
  }

  function handleAddSkill(e: FormEvent) {
    e.preventDefault()
    if (!newSkillName.trim() || !newSkillTemplate.trim()) return
    addSkill({
      name: newSkillName.trim().replace(/^\//, ''),
      description: newSkillDescription.trim(),
      template: newSkillTemplate,
    })
    setNewSkillName('')
    setNewSkillDescription('')
    setNewSkillTemplate('')
  }

  return (
    <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2028] flex flex-col h-screen sticky top-0 font-sans text-gray-900 dark:text-gray-100">
      {showProviderSettings && <ProviderSettingsPanel onClose={() => setShowProviderSettings(false)} />}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Agent</span>
        <div className="flex items-center gap-2">
          {isDesktopApp() && (
            <button
              type="button"
              onClick={() => setShowProviderSettings(true)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
            >
              Providers
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowManageSkills((v) => !v)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            Skills
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close agent panel"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {showManageSkills && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-3 text-xs">
          <p className="font-medium text-gray-700 dark:text-gray-200 mb-2">Available commands</p>
          <ul className="mb-3 space-y-1">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">/{s.name}</span> — {s.description}
                </span>
                {customSkills.some((c) => c.id === s.id) && (
                  <button
                    type="button"
                    onClick={() => removeSkill(s.id)}
                    className="text-gray-400 hover:text-red-600 cursor-pointer ml-2"
                  >
                    remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={handleAddSkill} className="space-y-1.5">
            <input
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="name (e.g. shorten)"
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-[#23242c] rounded px-2 py-1"
            />
            <input
              value={newSkillDescription}
              onChange={(e) => setNewSkillDescription(e.target.value)}
              placeholder="description"
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-[#23242c] rounded px-2 py-1"
            />
            <textarea
              value={newSkillTemplate}
              onChange={(e) => setNewSkillTemplate(e.target.value)}
              placeholder="template, use {{selection}} {{document}} {{args}}"
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-[#23242c] rounded px-2 py-1"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white rounded py-1 cursor-pointer hover:bg-indigo-700"
            >
              Add skill
            </button>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400">
            Ask a question, or use a command like <span className="font-mono">/summarize</span>.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-left ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
              }`}
            >
              {m.display ?? (m.content || (loading && i === messages.length - 1 ? '…' : ''))}
            </div>
            {m.role === 'assistant' && m.content && (!loading || i !== messages.length - 1) && (
              <div className="mt-1 flex flex-wrap gap-2 justify-start">
                <button
                  type="button"
                  onClick={() => reviewInDocument(m.content)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer font-medium"
                >
                  Review in document
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor(m.content)}
                  className="text-xs text-gray-500 hover:text-indigo-600 cursor-pointer"
                >
                  Insert at cursor
                </button>
                <button
                  type="button"
                  onClick={() => replaceSelection(m.content)}
                  className="text-xs text-gray-500 hover:text-indigo-600 cursor-pointer"
                >
                  Replace selection
                </button>
              </div>
            )}
          </div>
        ))}
        {errorText && <p className="text-xs text-red-600">{errorText}</p>}
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-200 dark:border-gray-700 p-3 relative">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#23242c] shadow-md py-1 max-h-40 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applySuggestion(s.name)}
                className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <span className="font-mono text-indigo-600 dark:text-indigo-400">/{s.name}</span>
                <span className="text-gray-500"> — {s.description}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Message the agent, or type / for commands"
          className="w-full resize-none border border-gray-200 dark:border-gray-600 dark:bg-[#23242c] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="mt-2 w-full bg-indigo-600 text-white text-sm rounded-md py-1.5 cursor-pointer hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
