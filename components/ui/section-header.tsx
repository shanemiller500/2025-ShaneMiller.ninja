type HeadingLevel = 'h1' | 'h2' | 'h3'

interface SectionHeaderProps {
  title: string
  as?: HeadingLevel
  className?: string
}

export function SectionHeader({ title, as: Tag = 'h2', className = '' }: SectionHeaderProps) {
  return (
    <Tag className={`h3 font-aspekta text-slate-800 dark:text-slate-100 ${className}`}>
      {title}
    </Tag>
  )
}
