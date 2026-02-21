interface ProgressBarProps {
  /** Percentage 0–100 */
  value: number
  className?: string
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div
      className={`shrink-0 relative w-20 h-1.5 bg-slate-200 dark:bg-slate-700 ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
