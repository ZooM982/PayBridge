import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/format'

const variants = {
  primary: 'bg-volt text-night hover:bg-volt-600 shadow-[var(--shadow-volt)] hover:shadow-none',
  dark: 'bg-night text-white hover:bg-night-700',
  outline: 'bg-white text-ink border border-line hover:border-ink-mute',
  ghost: 'text-ink-soft hover:bg-mist hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95',
}
const sizes = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-[14px] gap-2 rounded-xl',
  lg: 'h-13 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, iconRight: IconRight, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98]',
        'disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap cursor-pointer',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" strokeWidth={2.2} />}
      {children}
      {!loading && IconRight && <IconRight className="size-4" strokeWidth={2.2} />}
    </button>
  )
})
