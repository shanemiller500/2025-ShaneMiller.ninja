import { ReactNode } from 'react'
import TagList from '@/components/ui/tag-list'

export interface TimelineEntry {
  /** React node rendered inside the circular icon bubble */
  icon: ReactNode
  startDate: string
  endDate: string
  title: string
  /** Can include JSX for styled text (e.g. italic, spans) */
  org: ReactNode
  /** Can include JSX for emphasis within descriptions */
  description: ReactNode
  tags: string[]
}

interface TimelineItemProps {
  entry: TimelineEntry
  isLast: boolean
}

function TimelineItem({ entry, isLast }: TimelineItemProps) {
  const current = /present/i.test(entry.endDate)
  return (
    <li className="group relative pl-20">
      {/* Rail: glowing for the current role, fading out between entries */}
      {!isLast && (
        <span
          aria-hidden
          className={`absolute left-7 top-16 -bottom-8 w-px -translate-x-1/2 ${
            current ? 'bg-gradient-to-b from-indigo-500 via-indigo-500/40 to-slate-200 dark:to-white/10' : 'bg-slate-200 dark:bg-white/10'
          }`}
        />
      )}

      {/* Logo bubble */}
      <div
        className={`absolute left-0 top-0 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 transition-transform duration-300 group-hover:-translate-y-0.5 ${
          current ? 'ring-indigo-500/50 shadow-[0_0_24px_-4px_rgba(99,102,241,0.55)]' : 'ring-slate-200 dark:ring-white/10'
        }`}
      >
        {entry.icon}
      </div>

      {/* Card */}
      <div
        className={`rounded-2xl border p-5 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)] ${
          current
            ? 'border-indigo-500/30 bg-gradient-to-br from-indigo-500/[0.06] to-white/70 dark:to-white/[0.02]'
            : 'border-slate-200/70 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.02]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span>{entry.startDate}</span>
          <span aria-hidden>→</span>
          <span>{entry.endDate}</span>
          {current && (
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Now
            </span>
          )}
        </div>
        <h3 className="mt-2 font-aspekta text-lg font-[650] tracking-tight text-slate-900 dark:text-white">{entry.title}</h3>
        <div className="mt-0.5 text-sm font-medium text-indigo-500 dark:text-indigo-300">{entry.org}</div>
        <div className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{entry.description}</div>
        <div className="mt-4">
          <TagList tags={entry.tags} />
        </div>
      </div>
    </li>
  )
}

interface TimelineProps {
  entries: TimelineEntry[]
}

export function Timeline({ entries }: TimelineProps) {
  return (
    <ul className="space-y-8">
      {entries.map((entry, i) => (
        <TimelineItem key={i} entry={entry} isLast={i === entries.length - 1} />
      ))}
    </ul>
  )
}
