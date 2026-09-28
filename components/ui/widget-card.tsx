import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

interface WidgetCardProps {
  title: string
  subtitle?: string
  /** Optional element rendered right of the title (status pill, refresh button, …) */
  action?: ReactNode
  /** Adds a subtle "View all" link in the footer */
  href?: string
  hrefLabel?: string
  /** Remove body padding — for edge-to-edge content like marquees */
  flush?: boolean
  className?: string
  children: ReactNode
}

/** Shared light shell for home-page widgets — one border, one radius, one header style. */
export function WidgetCard({
  title,
  subtitle,
  action,
  href,
  hrefLabel = 'View all',
  flush = false,
  className = '',
  children,
}: WidgetCardProps) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.03] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className={flush ? '' : 'px-4 pb-4'}>{children}</div>

      {href && (
        <div className="border-t border-slate-100 dark:border-white/[0.06]">
          <Link
            href={href}
            className="group flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
          >
            {hrefLabel}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </section>
  )
}
