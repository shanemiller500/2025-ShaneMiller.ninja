import resumeContent from './content.json'

export interface SkillCategory {
  title: string
  skills: string[]
}

export const SKILLS_DATA: SkillCategory[] = resumeContent.skills

// Skill card: keeps the playful alternating tilt, in the dashboard card style.
export function WidgetSkills({ title, skills }: SkillCategory) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur transition-transform duration-700 ease-in-out odd:-rotate-1 even:rotate-1 hover:rotate-0 hover:duration-100 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-aspekta font-[650] text-slate-900 dark:text-white">{title}</div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{String(skills.length).padStart(2, '0')}</span>
      </div>
      <ul className="space-y-2.5">
        {skills.map((skill) => (
          <li key={skill} className="flex items-start text-sm text-slate-700 dark:text-slate-300">
            <span className="mr-2 text-indigo-500" aria-hidden="true">—</span>
            <span className="font-aspekta font-[650]">{skill}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
