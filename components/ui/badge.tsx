type BadgeVariant = 'default' | 'success' | 'info' | 'indigo' | 'warning'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'text-gray-700 bg-white/5 dark:text-white/70 dark:ring-white/10 ring-1 ring-black/10',   
  success:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-500/20',
  info: 'bg-white/5 text-gray-700 dark:text-white/70 ring-1 ring-black/10 dark:ring-white/10',
  indigo:
    'bg-indigo-50 dark:bg-indigo-950 text-indigo-400 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800',
  warning:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20',
}

export function Badge({ label, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  )
}
