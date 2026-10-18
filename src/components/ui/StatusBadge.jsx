import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { cn } from '../../lib/format'

export const STATUS = {
  completed: { label: 'Réussi', cls: 'bg-volt-50 text-volt-600', icon: CheckCircle2 },
  processing: { label: 'En traitement', cls: 'bg-info-50 text-info', icon: Loader2, spin: true },
  pending: { label: 'En attente', cls: 'bg-warn-50 text-[#B7770F]', icon: Clock },
  failed: { label: 'Échoué', cls: 'bg-danger-50 text-danger', icon: XCircle },
}

export function StatusBadge({ status, className }) {
  const s = STATUS[status] ?? STATUS.pending
  const Icon = s.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold', s.cls, className)}>
      <Icon className={cn('size-3.5', s.spin && 'animate-spin')} strokeWidth={2.4} />
      {s.label}
    </span>
  )
}
