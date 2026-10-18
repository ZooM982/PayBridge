import { FlaskConical } from 'lucide-react'
import { cn, initials } from '../../lib/format'

export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-lg', className)} />
}

const tints = ['bg-[#E6FBF3] text-[#00875A]', 'bg-[#EBF2FE] text-[#2563EB]', 'bg-[#FEF6E7] text-[#B7770F]', 'bg-[#F3EEFE] text-[#7C3AED]', 'bg-[#FDECEE] text-[#D9364A]']
export function Avatar({ name, size = 'md', className }) {
  const t = tints[name.charCodeAt(0) % tints.length]
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold', t,
      size === 'sm' ? 'size-8 text-[11px]' : size === 'lg' ? 'size-12 text-[15px]' : 'size-10 text-[13px]', className)}>
      {initials(name)}
    </span>
  )
}

export function DemoTag({ className }) {
  return (
    <span title="Données fictives — aucune transaction réelle" className={cn('inline-flex items-center gap-1 rounded-md bg-warn-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#B7770F]', className)}>
      <FlaskConical className="size-3" /> Démo
    </span>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-mist text-ink-mute"><Icon className="size-6" /></div>
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[14px] text-ink-mute">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Flag({ code, className }) {
  // Emoji drapeau, fallback lisible : code ISO
  const flag = code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt()))
  return <span aria-hidden className={cn('text-[18px] leading-none', className)}>{flag}</span>
}

export function Logo({ light, compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-volt">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#0B1220" strokeWidth="2.6" strokeLinecap="round">
          <path d="M4 16c3.5-7 12.5-7 16 0" /><path d="M4 16v3M20 16v3M12 10.5V19" />
        </svg>
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className={cn('text-[15px] font-bold tracking-tight', light ? 'text-white' : 'text-ink')}>PayBridge</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Africa</p>
        </div>
      )}
    </div>
  )
}

/** Mention texte uniquement — pas de logo officiel Bitnob. */
export function PoweredBy({ className }) {
  return <p className={cn('text-[11px] font-medium text-ink-mute', className)}>Powered by Bitnob</p>
}
