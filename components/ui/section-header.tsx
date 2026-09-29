type HeadingLevel = 'h1' | 'h2' | 'h3'

interface SectionHeaderProps {
  title: string
  as?: HeadingLevel
  className?: string
  /** Small mono label above the title, e.g. "04 roles" */
  eyebrow?: string
}

export function SectionHeader({ title, as: Tag = 'h2', className = '', eyebrow }: SectionHeaderProps) {
  return (
    <div className={className}>
      {eyebrow && (
        <p className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          {eyebrow}
        </p>
      )}
      <Tag className="font-aspekta text-2xl font-[650] tracking-tight text-slate-900 dark:text-white">{title}</Tag>
    </div>
  )
}
