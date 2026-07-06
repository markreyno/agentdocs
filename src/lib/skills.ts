import { useCallback, useEffect, useState } from 'react'

export interface Skill {
  id: string
  name: string
  description: string
  /** Prompt template. Supports {{selection}}, {{document}}, and {{args}} placeholders. */
  template: string
}

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

function loadCustomSkills(): Skill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
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
