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
  return (
    <li className="relative group">
      <div
        className={[
          'flex items-start',
          !isLast
            ? 'before:absolute before:left-0 before:h-full before:w-px before:bg-slate-200 before:dark:bg-slate-800 before:self-start before:ml-[28px] before:-translate-x-1/2 before:translate-y-8'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Circular icon */}
        <div className="absolute left-0 h-14 w-14 flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white rounded-full overflow-hidden">
          {entry.icon}
        </div>

        {/* Content */}
        <div className="pl-20 space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            {entry.startDate}{' '}
            <span className="text-slate-400 dark:text-slate-600">·</span>{' '}
            {entry.endDate}
          </div>
          <div className="font-aspekta font-[650] text-slate-800 dark:text-slate-100">
            {entry.title}
          </div>
          <div className="text-sm font-medium text-indigo-500 dark:text-indigo-400">
            {entry.org}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {entry.description}
          </div>
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
