import resumeContent from './content.json'

export interface SkillCategory {
  title: string
  skills: string[]
}

export const SKILLS_DATA: SkillCategory[] = resumeContent.skills

export function WidgetSkills({ title, skills }: SkillCategory) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <div className="font-aspekta font-[650] mb-3">{title}</div>
      <ul className="space-y-3">
        {skills.map((skill) => (
          <li key={skill} className="flex items-start text-sm">
            <span className="text-indigo-500 mr-2" aria-hidden="true">—</span>
            <span className="font-aspekta font-[650]">{skill}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
