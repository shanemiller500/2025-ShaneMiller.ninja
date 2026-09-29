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
          <Chip key={t} label={t} />
        ))}

        {!expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-indigo-500 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/10 dark:text-indigo-300"
          > 
            +{hidden} more
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-indigo-500 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/10 dark:text-indigo-300"
          >
            show less
          </button>
        )}
      </div>

      {/* Desktop: show all */}
      <div className="hidden md:flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Chip key={t} label={t} />
        ))}
      </div>
    </div>
  )
}

// Mono tech chip, matching the dashboard captions.
function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
      {label}
    </span>
  )
}
