import { ProgressBar } from '@/components/ui/progress-bar'

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
export interface Skill {
  name: string
  /** Proficiency percentage 0–100 */
  level: number
}

export interface SkillCategory {
  title: string
  skills: Skill[]
}

/* ------------------------------------------------------------------ */
/*  Skills Data                                                         */
/* ------------------------------------------------------------------ */
export const SKILLS_DATA: SkillCategory[] = [
  {
    title: 'Programming Skills',
    skills: [
      { name: 'JavaScript', level: 60 },
      { name: 'TypeScript', level: 60 },
      { name: 'C# / .NET', level: 65 },
      { name: 'Ruby on Rails', level: 40 },
    ],
  },
  {
    title: 'Frontend Skills',
    skills: [
      { name: 'HTML5', level: 74 },
      { name: 'CSS / Less / SASS', level: 70 },
      { name: 'Bootstrap', level: 70 },
      { name: 'Tailwind', level: 60 },
      { name: 'jQuery', level: 60 },
      { name: 'Vue.js', level: 50 },
      { name: 'React.js', level: 60 },
      { name: 'Next.js', level: 70 },
    ],
  },
  {
    title: 'DevOps & Productivity Tools',
    skills: [
      { name: 'TeamCity', level: 70 },
      { name: 'Jenkins', level: 50 },
      { name: 'Azure DevOps', level: 55 },
      { name: 'Oracle NetSuite', level: 45 },
      { name: 'Jira', level: 70 },
      { name: 'Confluence', level: 65 },
    ],
  },
  {
    title: 'Hosting & Cloud Services',
    skills: [
      { name: 'Vercel', level: 82 },
      { name: 'Render', level: 70 },
      { name: 'Firebase', level: 60 },
      { name: 'Google Cloud Services', level: 70 },
    ],
  },
  {
    title: 'Monitoring & Logging',
    skills: [
      { name: 'Elasticsearch', level: 63 },
      { name: 'Kibana', level: 70 },
      { name: 'Dotcom', level: 70 },
      { name: 'Grafana', level: 70 },
    ],
  },
  {
    title: 'Containerization & Analytics',
    skills: [
      { name: 'Docker', level: 60 },
      { name: 'Mixpanel', level: 70 },
      { name: 'Google Analytics', level: 70 },
    ],
  },
  {
    title: 'Backend Technologies & API Development',
    skills: [
      { name: 'Node.js / NPM', level: 71 },
      { name: 'Express', level: 56 },
      { name: 'RESTful APIs', level: 75 },
      { name: 'WebSocket Integration', level: 70 },
      { name: 'RSS Feeds', level: 79 },
    ],
  },
  {
    title: 'Databases & Data Management',
    skills: [
      { name: 'SQL / MySQL', level: 50 },
      { name: 'PostgreSQL', level: 50 },
    ],
  },
  {
    title: 'AI & Machine Learning',
    skills: [
      { name: 'AI & ML Integration', level: 70 },
      { name: 'Custom AI Models', level: 70 },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  WidgetSkills Component                                              */
/* ------------------------------------------------------------------ */
interface WidgetSkillsProps {
  title: string
  skills: Skill[]
}

export function WidgetSkills({ title, skills }: WidgetSkillsProps) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <div className="font-aspekta font-[650] mb-3">{title}</div>
      <ul className="space-y-3">
        {skills.map((skill) => (
          <li key={skill.name} className="flex justify-between items-center">
            <div className="grow inline-flex mr-1 truncate">
              <span className="text-indigo-500 mr-2">—</span>
              <span className="font-aspekta font-[650] text-sm truncate">{skill.name}</span>
            </div>
            <ProgressBar value={skill.level} />
          </li>
        ))}
      </ul>
    </div>
  )
}
