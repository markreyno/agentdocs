import type { Skill } from '../../lib/skills'

interface SkillsSectionProps {
  skills: Skill[]
  customSkills: Skill[]
  onRemoveSkill: (id: string) => void
}

export function SkillsSection({ skills, customSkills, onRemoveSkill }: SkillsSectionProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-sans font-semibold text-white mb-3">Built-in skills</h2>
        <ul className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/8">
          {skills
            .filter(s => !customSkills.some(c => c.id === s.id))
            .map(skill => (
              <li key={skill.id} className="px-4 py-3 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono text-indigo-300">/{skill.name}</code>
                  <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">
                    Built-in
                  </span>
                </div>
                <p className="text-sm font-sans text-gray-400">{skill.description}</p>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-sans font-semibold text-white mb-3">Custom skills</h2>
        {customSkills.length === 0 ? (
          <p className="text-sm font-sans text-gray-500 py-6 border border-dashed border-white/10 rounded-xl text-center">
            No custom skills yet. Create them from the agent sidebar in the editor.
          </p>
        ) : (
          <ul className="rounded-xl border border-white/8 overflow-hidden divide-y divide-white/8">
            {customSkills.map(skill => (
              <li key={skill.id} className="px-4 py-3 bg-white/[0.02] flex items-start justify-between gap-3">
                <div>
                  <code className="text-xs font-mono text-indigo-300">/{skill.name}</code>
                  <p className="text-sm font-sans text-gray-400 mt-1">{skill.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveSkill(skill.id)}
                  className="text-xs font-sans text-red-400/80 hover:text-red-300 cursor-pointer bg-none border-none shrink-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
