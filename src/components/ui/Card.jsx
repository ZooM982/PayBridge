import { cn } from '../../lib/format'

export function Card({ className, children, ...p }) {
  return <div className={cn('card', className)} {...p}>{children}</div>
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
