interface WidgetHeaderProps {
  title: string
  subtitle?: string
  /** Wraps the title in an anchor tag */
  href?: string
}

export function WidgetHeader({ title, subtitle, href }: WidgetHeaderProps) {
  const titleText = (
    <div
      className="text-xs font-black uppercase tracking-wide text-neutral-900 dark:text-neutral-100"
      style={{ fontFamily: '"Playfair Display", serif' }}
    >
      {title}
    </div>
  )

  return (
    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
      <div className="w-1.5 h-1.5 bg-red-600 dark:bg-red-400 rounded-full shrink-0" />
      <div>
        {href ? <a href={href}>{titleText}</a> : titleText}
        {subtitle && (
          <div className="text-[9px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
