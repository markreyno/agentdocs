import type { Editor } from '@tiptap/react'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { sendChatMessage } from './lib/agentChat'
import type { ChatMessage } from './lib/chatClient'
import { isDesktopApp } from './lib/isDesktop'
import { findSkill, parseSlashCommand, resolveSkillTemplate, useSkills } from './lib/skills'
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
}

function getSelectionAndDocument(editor: Editor | null): { selection: string; document: string } {
  if (!editor) return { selection: '', document: '' }
  const { from, to, empty } = editor.state.selection
  const selection = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
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

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const raw = input.trim()
    if (!raw || loading) return

    setErrorText(null)
    let apiContent = raw
    const command = parseSlashCommand(raw)
    if (command) {
      const skill = findSkill(skills, command.name)
      if (skill) {
        const { selection, document } = getSelectionAndDocument(editor)
        apiContent = resolveSkillTemplate(skill, { selection, document, args: command.args })
      }
    }

    const userMessage: DisplayMessage = { role: 'user', content: apiContent, display: raw }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    const apiMessages: ChatMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }))

    await sendChatMessage(apiMessages, {
      onDelta: (delta) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + delta }
          return updated
        })
      },
      onDone: () => setLoading(false),
      onError: (message) => {
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
    <div className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col h-screen sticky top-0 font-sans">
      {showProviderSettings && <ProviderSettingsPanel onClose={() => setShowProviderSettings(false)} />}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-semibold text-sm text-gray-800">Agent</span>
        <div className="flex items-center gap-2">
          {isDesktopApp() && (
            <button
              type="button"
              onClick={() => setShowProviderSettings(true)}
              className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              Providers
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowManageSkills((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
          >
            Skills
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close agent panel"
            className="text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {showManageSkills && (
        <div className="border-b border-gray-200 p-3 text-xs">
          <p className="font-medium text-gray-700 mb-2">Available commands</p>
          <ul className="mb-3 space-y-1">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-gray-600">
                <span>
                  <span className="font-mono text-indigo-600">/{s.name}</span> — {s.description}
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
              className="w-full border border-gray-200 rounded px-2 py-1"
            />
            <input
              value={newSkillDescription}
              onChange={(e) => setNewSkillDescription(e.target.value)}
              placeholder="description"
              className="w-full border border-gray-200 rounded px-2 py-1"
            />
            <textarea
              value={newSkillTemplate}
              onChange={(e) => setNewSkillTemplate(e.target.value)}
              placeholder="template, use {{selection}} {{document}} {{args}}"
              rows={2}
              className="w-full border border-gray-200 rounded px-2 py-1"
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
                m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.display ?? (m.content || (loading && i === messages.length - 1 ? '…' : ''))}
            </div>
            {m.role === 'assistant' && m.content && (!loading || i !== messages.length - 1) && (
              <div className="mt-1 flex gap-2 justify-start">
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

      <form onSubmit={handleSend} className="border-t border-gray-200 p-3 relative">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-md border border-gray-200 bg-white shadow-md py-1 max-h-40 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applySuggestion(s.name)}
                className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer"
              >
                <span className="font-mono text-indigo-600">/{s.name}</span>
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
          className="w-full resize-none border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
