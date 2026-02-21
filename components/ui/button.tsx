import { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant =
  | 'primary'    // dark bg, hover red — nav/search actions
  | 'secondary'  // bordered bg-white/70 — cancel, toolbar, list items
  | 'ghost'      // text + hover bg — modal close buttons
  | 'indigo'     // indigo-500/50 — form submit, AI enhance, primary page actions
  | 'pill'       // rounded-full — tab navigation (use active prop)
  | 'news-tab'   // newspaper bold — news section tabs (use active prop)
  | 'selection'  // indigo active / bordered inactive — mood/tone/style pickers

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /**
   * Pass `null` to skip size classes entirely and control sizing via `className`.
   * Useful for responsive-sized buttons (e.g. news tabs with sm:/md: breakpoints).
   */
  size?: ButtonSize | null
  fullWidth?: boolean
  /** Active state for pill, news-tab, and selection variants */
  active?: boolean
  children: ReactNode
}

function getVariantClass(variant: ButtonVariant, active?: boolean): string {
  switch (variant) {
    case 'primary':
      return 'rounded-xl font-bold uppercase tracking-wider bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-red-600 dark:hover:bg-red-400 hover:text-white'

    case 'secondary':
      return 'rounded-xl font-semibold border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/10'

    case 'ghost':
      return 'rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 focus:ring-2 focus:ring-indigo-500/60'

    case 'indigo':
      return 'rounded-2xl font-semibold shadow-sm bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white hover:opacity-95 focus:ring-2 focus:ring-indigo-500/60'

    case 'pill':
      return active
        ? 'rounded-full font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-gray-900 text-white border border-black/20 hover:bg-gray-900 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/10'
        : 'rounded-full font-extrabold ring-1 ring-black/10 dark:ring-white/10 border border-black/10 bg-white text-gray-800 hover:bg-black/[0.03] dark:border-white/10 dark:bg-brand-900 dark:text-white/80 dark:hover:bg-white/[0.06]'

    case 'news-tab':
      return [
        'relative shrink-0 whitespace-nowrap font-black uppercase tracking-wider sm:tracking-widest',
        active
          ? 'bg-red-600 dark:bg-red-400 text-white dark:text-neutral-900'
          : 'bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800',
      ].join(' ')

    case 'selection':
      return active
        ? 'rounded-xl font-semibold border border-transparent bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/60'
        : 'rounded-xl font-semibold border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 focus:ring-2 focus:ring-indigo-500/60'
  }
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-xs',
  lg: 'px-4 py-3 text-sm',
  icon: 'p-1',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  active,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        getVariantClass(variant, active),
        size !== null ? sizeStyles[size as ButtonSize] : '',
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
