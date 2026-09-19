import type { LucideIcon } from 'lucide-react'

type IconBadgeTone =
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'sky'
  | 'violet'
  | 'neutral'

type IconBadgeSize = 'xs' | 'sm' | 'md' | 'lg'

interface IconBadgeProps {
  /** Any lucide-react icon component */
  icon: LucideIcon
  tone?: IconBadgeTone
  size?: IconBadgeSize
  /** Soft pulsing halo — use for live / streaming states */
  pulse?: boolean
  /** Accessible name. Omit for purely decorative icons. */
  label?: string
  className?: string
}

const toneStyles: Record<IconBadgeTone, string> = {
  indigo:
    'bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 text-indigo-600 dark:text-indigo-300 ring-indigo-500/20',
  emerald:
    'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20',
  rose:
    'bg-gradient-to-br from-rose-500/15 to-orange-500/10 text-rose-600 dark:text-rose-300 ring-rose-500/20',
  amber:
    'bg-gradient-to-br from-amber-500/15 to-yellow-500/10 text-amber-600 dark:text-amber-300 ring-amber-500/20',
  sky:
    'bg-gradient-to-br from-sky-500/15 to-cyan-500/10 text-sky-600 dark:text-sky-300 ring-sky-500/20',
  violet:
    'bg-gradient-to-br from-violet-500/15 to-purple-500/10 text-violet-600 dark:text-violet-300 ring-violet-500/20',
  neutral:
    'bg-black/[0.04] dark:bg-white/[0.08] text-gray-500 dark:text-white/50 ring-black/10 dark:ring-white/10',
}

const haloStyles: Record<IconBadgeTone, string> = {
  indigo:  'bg-indigo-400/25',
  emerald: 'bg-emerald-400/30',
  rose:    'bg-rose-400/25',
  amber:   'bg-amber-400/25',
  sky:     'bg-sky-400/25',
  violet:  'bg-violet-400/25',
  neutral: 'bg-gray-400/20',
}

const sizeStyles: Record<IconBadgeSize, { box: string; icon: string }> = {
  xs: { box: 'h-5 w-5  rounded-md',  icon: 'h-2.5 w-2.5' },
  sm: { box: 'h-6 w-6  rounded-lg',  icon: 'h-3 w-3' },
  md: { box: 'h-8 w-8  rounded-xl',  icon: 'h-4 w-4' },
  lg: { box: 'h-11 w-11 rounded-2xl', icon: 'h-5 w-5' },
}

export function IconBadge({
  icon: Icon,
  tone = 'indigo',
  size = 'md',
  pulse = false,
  label,
  className = '',
}: IconBadgeProps) {
  const s = sizeStyles[size]

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ring-1 shadow-sm ${s.box} ${toneStyles[tone]} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {pulse && (
        <span
          className={`pointer-events-none absolute inset-0 animate-ping rounded-[inherit] ${haloStyles[tone]}`}
        />
      )}
      <Icon className={`relative ${s.icon}`} strokeWidth={2.25} />
    </span>
  )
}
