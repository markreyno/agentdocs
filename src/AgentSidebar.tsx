import type { Editor } from '@tiptap/react'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { sendChatMessage } from './lib/agentChat'
import type { ChatMessage } from './lib/chatClient'
import { withDocumentContext } from './lib/documentContext'
import { applyReplaceInEditor, executeRendererDocTool, type ReplaceTextInput } from './lib/editTools'
import {
  applyInsertBlocksInEditor,
  applyReplaceStoryInEditor,
  type InsertBlocksInput,
  type ReplaceStoryInput,
} from './lib/storyEdit'
import { parseDumpedToolCall } from './lib/parseDumpedToolCall'
import {
  DEMO_USAGE_LIMIT,
  getRemainingDemoUses,
  incrementDemoUseCount,
  isDemoLimitReached,
  setDemoUseCountToLimit,
} from './lib/demoUsage'
import { isDesktopApp } from './lib/isDesktop'
import { useRequestDesktopDownload } from './lib/downloadAgreement'
import {
  CLEAR_COMMAND,
  CREATE_SKILL_COMMAND,
  META_COMMANDS,
  buildSkillFromDefinition,
  findSkill,
  parseCreateSkillInput,
  parseSlashCommand,
  resolveSkillTemplate,
  useSkills,
} from './lib/skills'
import ProviderSettingsPanel from './ProviderSettingsPanel'

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
  isDemoMode?: boolean
  agentLocked?: boolean
  onDemoLimitReached?: () => void
}

function getSelectionAndDocument(editor: Editor | null): { selection: string; document: string } {
  if (!editor) return { selection: '', document: '' }
  const { from, to, empty } = editor.state.selection
  const selection = empty ? '' : editor.state.doc.textBetween(from, to, '\n')
  return { selection, document: editor.getText() }
}

function getSelectionRange(editor: Editor | null) {
  if (!editor) return undefined
  const { from, to, empty } = editor.state.selection
  if (empty) return undefined
  return { from, to, text: editor.state.doc.textBetween(from, to, '\n') }
}

function truncateToolLabel(text: string, max = 40): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

function formatToolStatus(name: string, input: unknown): string {
  if (name === 'replace_story') {
    const count =
      (input as { blocks?: unknown[] })?.blocks?.length ??
      (input as { paragraphs?: unknown[] })?.paragraphs?.length ??
      0
    return `Proposing consolidated story edit (${count} block${count === 1 ? '' : 's'})…`
  }
  if (name === 'insert_blocks') {
    const count = (input as { blocks?: unknown[] })?.blocks?.length ?? 0
    return `Inserting ${count} new block${count === 1 ? '' : 's'}…`
  }
  if (name === 'get_story_blocks') {
    return 'Reading story structure…'
  }
  if (name === 'replace_text') {
    const find = (input as { find?: string })?.find?.trim()
    const replaceAll = (input as { replace_all?: boolean })?.replace_all
    if (replaceAll) {
      return find
        ? `Proposing edits everywhere (replace_text: "${truncateToolLabel(find)}")…`
        : 'Proposing edits for all matches…'
    }
    return find
      ? `Proposing edit (replace_text: "${truncateToolLabel(find)}")…`
      : 'Proposing edit for selection…'
  }
  const query = (input as { query?: string; id?: string })?.query ?? (input as { id?: string })?.id ?? ''
  return `Searching the manuscript (${name}${query ? `: "${query}"` : ''})…`
}

export default function AgentSidebar({
  editor,
  open,
  onClose,
  isDemoMode = false,
  agentLocked = false,
  onDemoLimitReached,
}: AgentSidebarProps) {
  const requestDesktopDownload = useRequestDesktopDownload()
  const { skills, customSkills, addSkill, removeSkill } = useSkills()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [showManageSkills, setShowManageSkills] = useState(false)
  const [showProviderSettings, setShowProviderSettings] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const assistantDraftRef = useRef('')
  const chatSessionRef = useRef(0)
  const cancelChatRef = useRef<(() => void) | null>(null)

  if (!open) return null

  const slashCommand = parseSlashCommand(input)
  const isTypingCommandName = slashCommand !== null && !input.includes(' ')
  const suggestions = isTypingCommandName
    ? [
        ...META_COMMANDS.filter((c) =>
          c.name.toLowerCase().startsWith(slashCommand!.name.toLowerCase()),
        ),
        ...skills.filter((s) => s.name.toLowerCase().startsWith(slashCommand!.name.toLowerCase())),
      ]
    : []

  function applySuggestion(name: string) {
    setInput(`/${name} `)
    inputRef.current?.focus()
  }

  function trackReplaceTextReview(input: unknown) {
    if (!editor) {
      setErrorText('Could not open edit review: editor is not available.')
      return
    }
    const result = applyReplaceInEditor(
      editor,
      input as ReplaceTextInput,
      getSelectionRange(editor),
      false,
    )
    if (result.status !== 'proposed') {
      setErrorText(result.message)
    }
  }

  function trackReplaceStoryReview(input: unknown) {
    if (!editor) {
      setErrorText('Could not open edit review: editor is not available.')
      return
    }
    const result = applyReplaceStoryInEditor(editor, input as ReplaceStoryInput)
    if (result.status !== 'proposed') {
      setErrorText(result.message)
    }
  }

  function trackInsertBlocks(input: unknown) {
    if (!editor) {
      setErrorText('Could not insert blocks: editor is not available.')
      return
    }
    const result = applyInsertBlocksInEditor(editor, input as InsertBlocksInput)
    if (result.status !== 'applied') {
      setErrorText(result.message)
    }
  }

  function handleCreateSkill(raw: string, args: string) {
    const { name: explicitName, definition } = parseCreateSkillInput(args)
    if (!definition) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: raw, display: raw },
        {
          role: 'assistant',
          content:
            'To create a skill, describe what it should do after the command.\n\nExample:\n/create-skill I want to give you a character name and you explain his current character arc to me\n\nOptional name:\n/create-skill character-arc I want to give you a character name…',
        },
      ])
      setInput('')
      return
    }

    const takenNames = [
      CLEAR_COMMAND,
      CREATE_SKILL_COMMAND,
      ...skills.map((s) => s.name),
    ]
    const skill = buildSkillFromDefinition(definition, {
      name: explicitName,
      takenNames,
    })

    if (explicitName && takenNames.some((n) => n.toLowerCase() === explicitName.toLowerCase())) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: raw, display: raw },
        {
          role: 'assistant',
          content: `A skill named /${explicitName} already exists. Pick another name or omit the name to auto-generate one.`,
        },
      ])
      setInput('')
      return
    }

    addSkill(skill)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: raw, display: raw },
      {
        role: 'assistant',
        content: `Created /${skill.name}.\n\n${skill.description}\n\nTry it with extra input, e.g. /${skill.name} Gandalf`,
      },
    ])
    setInput('')
    setShowManageSkills(true)
  }

  function handleClearChat() {
    cancelChatRef.current?.()
    cancelChatRef.current = null
    chatSessionRef.current += 1
    setMessages([])
    setInput('')
    setErrorText(null)
    setToolStatus(null)
    setLoading(false)
    assistantDraftRef.current = ''
    inputRef.current?.focus()
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const raw = input.trim()
    if (!raw) return

    const command = parseSlashCommand(raw)
    if (command?.name.toLowerCase() === CLEAR_COMMAND) {
      handleClearChat()
      return
    }

    if (loading) return

    if (command?.name.toLowerCase() === CREATE_SKILL_COMMAND) {
      handleCreateSkill(raw, command.args)
      return
    }

    if (isDemoMode) {
      if (agentLocked || isDemoLimitReached()) {
        onDemoLimitReached?.()
        return
      }
      incrementDemoUseCount()
    }

    setErrorText(null)
    const { selection, document } = getSelectionAndDocument(editor)
    let apiContent = raw
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
    assistantDraftRef.current = ''
    editor?.commands.rejectReview()

    // Prior turns use display text so old sessions don't re-send full manuscripts.
    // The latest user turn keeps the expanded prompt (tools / skill template).
    const lastIdx = nextMessages.length - 1
    const apiMessages: ChatMessage[] = nextMessages.map((m, i) => ({
      role: m.role,
      content: i < lastIdx && m.role === 'user' && m.display ? m.display : m.content,
    }))

    const session = chatSessionRef.current

    cancelChatRef.current?.()
    cancelChatRef.current = sendChatMessage(
      apiMessages,
      {
        onDelta: (delta) => {
          if (session !== chatSessionRef.current) return
          setToolStatus(null)
          assistantDraftRef.current += delta
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            updated[updated.length - 1] = { ...last, content: last.content + delta }
            return updated
          })
        },
        onToolUse: (name, input) => {
          if (session !== chatSessionRef.current) return
          setToolStatus(formatToolStatus(name, input))
          // Open the inline review as soon as the model calls an edit tool.
          // Desktop also applies via executeRendererTool; applyReplaceInEditor is idempotent.
          // insert_blocks is not idempotent — apply on web here; desktop uses executeRendererTool only.
          if (name === 'replace_text') {
            trackReplaceTextReview(input)
          }
          if (name === 'replace_story') {
            trackReplaceStoryReview(input)
          }
          if (name === 'insert_blocks' && !isDesktopApp()) {
            trackInsertBlocks(input)
          }
        },
        onDone: () => {
          if (session !== chatSessionRef.current) return
          cancelChatRef.current = null
          const dumped = parseDumpedToolCall(assistantDraftRef.current)
          if (dumped?.name === 'replace_text') {
            trackReplaceTextReview(dumped.arguments)
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: 'Proposed an edit for review in the document.',
                }
              }
              return updated
            })
          } else if (dumped?.name === 'replace_story') {
            trackReplaceStoryReview(dumped.arguments)
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: 'Proposed an edit for review in the document.',
                }
              }
              return updated
            })
          } else if (dumped?.name === 'insert_blocks') {
            trackInsertBlocks(dumped.arguments)
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: 'Inserted new content into the document.',
                }
              }
              return updated
            })
          }
          editor?.commands.setReviewStreaming(false)
          setToolStatus(null)
          setLoading(false)
          if (isDemoMode && isDemoLimitReached()) {
            onDemoLimitReached?.()
          }
        },
        onError: (message) => {
          if (session !== chatSessionRef.current) return
          cancelChatRef.current = null
          editor?.commands.rejectReview()
          setToolStatus(null)
          setErrorText(message)
          setLoading(false)
        },
        onRateLimited: () => {
          if (session !== chatSessionRef.current) return
          if (isDemoMode) {
            setDemoUseCountToLimit()
            onDemoLimitReached?.()
          }
        },
      },
      editor?.getJSON(),
      {
        executeRendererTool: async (name, input) => {
          if (session !== chatSessionRef.current) {
            return { status: 'error', message: 'Chat was cleared' }
          }
          return executeRendererDocTool(editor, name, input, getSelectionRange(editor))
        },
      },
    )
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
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
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Create one with{' '}
            <span className="font-mono text-indigo-600 dark:text-indigo-400">/create-skill</span> followed by
            what it should do.
          </p>
          <ul className="space-y-1">
            {META_COMMANDS.map((c) => (
              <li key={c.name} className="text-gray-600 dark:text-gray-400">
                <span className="font-mono text-indigo-600 dark:text-indigo-400">/{c.name}</span> —{' '}
                {c.description}
              </li>
            ))}
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
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400">
            Ask a question, use <span className="font-mono">/summarize</span>,{' '}
            <span className="font-mono">/clear</span> to start fresh, or create a skill with{' '}
            <span className="font-mono">/create-skill</span>.
            {isDemoMode && !agentLocked && (
              <>
                {' '}
                <span className="text-gray-500">
                  ({getRemainingDemoUses()} of {DEMO_USAGE_LIMIT} demo requests left)
                </span>
              </>
            )}
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
          </div>
        ))}
        {toolStatus && <p className="text-xs italic text-gray-400">{toolStatus}</p>}
        {errorText && <p className="text-xs text-red-600">{errorText}</p>}
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-200 dark:border-gray-700 p-3 relative">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#23242c] shadow-md py-1 max-h-40 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={'id' in s ? s.id : s.name}
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
          placeholder={
            agentLocked
              ? 'Demo limit reached — download the desktop app to use the agent'
              : 'Message the agent, or type / for commands'
          }
          disabled={agentLocked}
          className="w-full resize-none border border-gray-200 dark:border-gray-600 dark:bg-[#23242c] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type={agentLocked ? 'button' : 'submit'}
          onClick={agentLocked ? requestDesktopDownload : undefined}
          disabled={!agentLocked && (loading || !input.trim())}
          className="mt-2 w-full bg-indigo-600 text-white text-sm rounded-md py-1.5 cursor-pointer hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {agentLocked ? 'Download app' : loading ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
