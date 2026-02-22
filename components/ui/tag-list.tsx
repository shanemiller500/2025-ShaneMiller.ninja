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
            className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-extrabold text-gray-700 ring-1 ring-black/10 dark:text-white/70 dark:ring-white/10"
          > 
            +{hidden} more
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-extrabold text-gray-700 ring-1 ring-black/10 dark:text-white/70 dark:ring-white/10"
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
