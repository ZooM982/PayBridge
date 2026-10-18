import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, Loader2, X, FilePlus2, Cog, BadgeCheck } from 'lucide-react'
import { cn, date } from '../lib/format'

const STEPS = [
  { key: 'created', label: 'Créé', desc: 'Demande enregistrée et montants verrouillés', icon: FilePlus2, at: (t) => t?.createdAt ?? t?.pendingAt },
  { key: 'processing', label: 'En traitement', desc: 'Transmis au réseau de paiement', icon: Cog, at: (t) => t?.processingAt },
  { key: 'confirmed', label: 'Confirmé', desc: 'Fonds disponibles pour le bénéficiaire', icon: BadgeCheck, at: (t) => t?.completedAt },
]

/** Index de l'étape active selon le statut. */
const progressOf = (status) => ({ pending: 0, processing: 1, completed: 2, failed: 1 }[status] ?? 0)

/** Horodatage affiché pour une étape : la frappe `*At` du transfert s'il existe, sinon un indice d'attente. */
function StampFor({ i, status, stamps }) {
  const failed = status === 'failed'
  // En cas d'échec, l'étape « En traitement » affiche la date de l'échec.
  const key = i === 0 ? 'createdAt' : i === 1 ? (failed ? 'failedAt' : 'processingAt') : 'completedAt'
  const ts = stamps?.[key] ?? (i === 0 ? stamps?.pendingAt : undefined)
  if (ts) return <p className="tabular text-[12px] font-medium text-ink-soft">{date(ts, true)}</p>
  if (i > progressOf(status)) return <p className="text-[12px] text-ink-mute">—</p>
  return <p className="text-[12px] text-ink-mute">En attente…</p>
}

export function Timeline({ status, createdAt, stamps, horizontal }) {
  const ref = useRef()
  const active = progressOf(status)
  const failed = status === 'failed'
  const detail = stamps ?? { createdAt }

  useGSAP(() => {
    gsap.to('[data-fill]', { [horizontal ? 'scaleX' : 'scaleY']: active / 2, duration: 0.8, ease: 'power3.inOut' })
    gsap.fromTo(`[data-step="${active}"]`, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' })
  }, { scope: ref, dependencies: [active, horizontal] })

  return (
    <ol ref={ref} className={cn('relative', horizontal ? 'grid grid-cols-3' : 'space-y-6')}>
      {/* rail */}
      <span aria-hidden className={cn('absolute bg-line', horizontal ? 'left-[16.6%] right-[16.6%] top-5 h-[3px]' : 'bottom-5 left-5 top-5 w-[3px] -translate-x-1/2')} />
      <span aria-hidden data-fill className={cn('absolute', failed ? 'bg-danger' : 'bg-volt',
        horizontal ? 'left-[16.6%] right-[16.6%] top-5 h-[3px] origin-left scale-x-0' : 'bottom-5 left-5 top-5 w-[3px] -translate-x-1/2 origin-top scale-y-0')} />

      {STEPS.map((s, i) => {
        const done = i < active || (i === active && status === 'completed')
        const current = i === active && !done
        const isFail = failed && i === active
        const Icon = isFail ? X : done ? Check : current ? Loader2 : s.icon
        return (
          <li key={s.key} className={cn('relative flex gap-4', horizontal && 'flex-col items-center gap-2.5 text-center')}>
            <span data-step={i} className={cn('relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-white transition-colors',
              isFail ? 'bg-danger text-white' : done ? 'bg-volt text-night' : current ? 'bg-night text-volt' : 'bg-mist text-ink-mute')}>
              <Icon className={cn('size-4', current && !isFail && 'animate-spin')} strokeWidth={2.6} />
              {current && !isFail && <span className="absolute inset-0 animate-ping rounded-full bg-volt/30" />}
            </span>
            <div className={cn(!horizontal && 'pt-1.5')}>
              <p className={cn('text-[14px] font-semibold', i > active ? 'text-ink-mute' : 'text-ink', isFail && 'text-danger')}>
                {isFail ? 'Échec du traitement' : s.label}
              </p>
              <StampFor i={i} status={status} stamps={detail} />
              {i === active && !failed && status !== 'completed' && (
                <p className="text-[12px] text-ink-mute">{s.desc}</p>
              )}
              {isFail && <p className="text-[12px] text-ink-mute">Aucun débit — fonds restitués</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
