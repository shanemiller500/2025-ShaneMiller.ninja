'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'

interface TagListProps {
  tags: string[]
  initialCount?: number
}

export default function TagList({ tags, initialCount = 4 }: TagListProps) {
  const [expanded, setExpanded] = useState(false)
  const hidden = tags.length - initialCount
  const visibleTags = expanded ? tags : tags.slice(0, initialCount)

  return (
    <div className="pt-1">
      {/* Mobile: truncated with expand toggle */}
      <div className="flex md:hidden flex-wrap gap-1.5 items-center">
        {visibleTags.map((t) => (
          <Badge key={t} label={t} />
        ))}

        {!expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-400 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
          >
            +{hidden} more
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            show less
          </button>
        )}
      </div>

      {/* Desktop: show all */}
      <div className="hidden md:flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} label={t} />
        ))}
      </div>
    </div>
  )
}
