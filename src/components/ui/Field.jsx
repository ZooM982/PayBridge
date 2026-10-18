import { ChevronDown, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/format'

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={htmlFor} className="label block">{label}</label>}
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[12px] font-medium text-danger"><AlertCircle className="size-3.5" />{error}</p>
      ) : hint ? <p className="text-[12px] text-ink-mute">{hint}</p> : null}
    </div>
  )
}

export function Select({ className, children, error, ...p }) {
  return (
    <div className="relative">
      <select className={cn('field appearance-none pr-10 cursor-pointer', error && 'field-error', className)} {...p}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
    </div>
  )
}

export function Input({ className, error, ...p }) {
  return <input className={cn('field', error && 'field-error', className)} {...p} />
}
