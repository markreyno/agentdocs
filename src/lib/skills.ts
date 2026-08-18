import { useCallback, useEffect, useState } from 'react'

export interface Skill {
  id: string
  name: string
  description: string
  /** Prompt template. Supports {{selection}}, {{document}}, and {{args}} placeholders. */
  template: string
}

export const CREATE_SKILL_COMMAND = 'create-skill'
export const CLEAR_COMMAND = 'clear'

export const META_COMMANDS = [
  {
    name: CLEAR_COMMAND,
    description: 'Clear the agent chat and start a fresh conversation',
  },
  {
    name: CREATE_SKILL_COMMAND,
    description: 'Create a skill from a plain-language description',
  },
] as const

export const BUILT_IN_SKILLS: Skill[] = [
  {
    id: 'summarize',
    name: 'summarize',
    description: 'Summarize the selected text (or whole document if nothing is selected).',
    template: 'Summarize the following text concisely:\n\n{{selection}}',
  },
  {
    id: 'changetone',
    name: 'changetone',
    description: 'Rewrite the selected text in a different tone, e.g. "/changetone formal".',
    template: 'Rewrite the following text in a {{args}} tone. Only return the rewritten text:\n\n{{selection}}',
  },
]

const STORAGE_KEY = 'agentdocs.customSkills'

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'could',
  'current',
  'do',
  'does',
  'for',
  'from',
  'give',
  'her',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'like',
  'me',
  'my',
  'of',
  'on',
  'or',
  'please',
  'should',
  'so',
  'that',
  'the',
  'then',
  'this',
  'to',
  'want',
  'when',
  'where',
  'will',
  'with',
  'would',
  'you',
  'your',
])

/** Strip legacy full-document embedding from saved custom skill templates. */
export function stripEmbeddedDocumentFromTemplate(template: string): string {
  if (!template.includes('{{document}}')) return template

  const withoutDoc = template
    .replace(/\n*Full document for context:\n\{\{document\}\}\s*/g, '\n')
    .replaceAll('{{document}}', '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()

  if (withoutDoc.includes('Do not assume the full manuscript')) return withoutDoc

  return `${withoutDoc}\n\nDo not assume the full manuscript is in this message. Use doc_status, search_outline, search_sentences, get_node, or get_story_blocks when you need document context. Do not re-fetch unchanged loaded nodes.`
}

function loadCustomSkills(): Skill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((skill: Skill) => ({
      ...skill,
      template: stripEmbeddedDocumentFromTemplate(skill.template ?? ''),
    }))
  } catch {
    return []
  }
}

export function useSkills() {
  const [customSkills, setCustomSkills] = useState<Skill[]>(() => loadCustomSkills())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customSkills))
  }, [customSkills])

  const addSkill = useCallback((skill: Omit<Skill, 'id'>) => {
    setCustomSkills((prev) => [
      ...prev,
      { ...skill, id: `${skill.name}-${Date.now()}` },
    ])
  }, [])

  const removeSkill = useCallback((id: string) => {
    setCustomSkills((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const skills = [...BUILT_IN_SKILLS, ...customSkills]

  return { skills, customSkills, addSkill, removeSkill }
}

export function findSkill(skills: Skill[], name: string): Skill | undefined {
  return skills.find((s) => s.name.toLowerCase() === name.toLowerCase())
}

/** Parses "/skillname rest of the args" into { name, args }, or null if input isn't a slash-command. */
export function parseSlashCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const match = trimmed.match(/^\/(\S+)\s*(.*)$/s)
  if (!match) return null
  return { name: match[1], args: match[2] }
}

export function resolveSkillTemplate(
  skill: Skill,
  vars: { selection: string; document: string; args: string },
): string {
  return skill.template
    .replaceAll('{{selection}}', vars.selection || vars.document)
    .replaceAll('{{document}}', vars.document)
    .replaceAll('{{args}}', vars.args)
}

/**
 * Optional explicit name: `/create-skill character-arch I want…` or `/create-skill character-arch: I want…`
 * Name must be lowercase command-style so sentence starters like "I want…" stay in the definition.
 */
export function parseCreateSkillInput(args: string): { name?: string; definition: string } {
  const trimmed = args.trim()
  if (!trimmed) return { definition: '' }

  const match = trimmed.match(/^([a-z][\w-]{1,31})(?:\s+|:\s*)(.+)$/s)
  if (match) {
    const candidate = match[1]
    if (
      candidate !== CREATE_SKILL_COMMAND &&
      candidate !== CLEAR_COMMAND &&
      !STOP_WORDS.has(candidate)
    ) {
      return { name: candidate, definition: match[2].trim() }
    }
  }

  return { definition: trimmed }
}

export function suggestSkillName(definition: string, takenNames: string[] = []): string {
  const words = definition
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

  const picked = (words.length >= 2 ? words.slice(-2) : words.slice(0, 3)).slice(0, 3)
  let base = (picked.join('-') || 'custom-skill').slice(0, 32)

  const taken = new Set(takenNames.map((n) => n.toLowerCase()))
  taken.add(CREATE_SKILL_COMMAND)
  taken.add(CLEAR_COMMAND)

  if (!taken.has(base)) return base

  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`.slice(0, 32)
}

export function buildSkillFromDefinition(
  definition: string,
  options: { name?: string; takenNames?: string[] } = {},
): Omit<Skill, 'id'> {
  const name = options.name ?? suggestSkillName(definition, options.takenNames)
  const description =
    definition.length > 120 ? `${definition.slice(0, 117).trimEnd()}…` : definition

  const template = [
    'Follow this custom skill defined by the author:',
    '',
    definition.trim(),
    '',
    'Use any extra input from the user as the subject or arguments for this skill:',
    '{{args}}',
    '',
    'Selected text (if any):',
    '{{selection}}',
    '',
    'Do not assume the full manuscript is in this message. Use doc_status, search_outline, search_sentences, get_node, or get_story_blocks when you need document context. Do not re-fetch unchanged loaded nodes.',
  ].join('\n')

  return { name, description, template }
}
