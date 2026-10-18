import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useStore } from '../../context/AppStore'

const icons = { success: [CheckCircle2, 'text-volt'], error: [XCircle, 'text-danger'], info: [Info, 'text-info'] }

function Toast({ t, onClose }) {
  const ref = useRef()
  useGSAP(() => { gsap.from(ref.current, { y: 24, opacity: 0, scale: 0.96, duration: 0.45, ease: 'back.out(1.6)' }) })
  const [Icon, color] = icons[t.tone] ?? icons.info
  return (
    <div ref={ref} role="status" className="pointer-events-auto flex w-[min(92vw,380px)] items-start gap-3 rounded-2xl bg-night p-4 text-white shadow-[var(--shadow-pop)]">
      <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{t.title}</p>
        {t.text && <p className="mt-0.5 text-[13px] text-white/60">{t.text}</p>}
      </div>
      <button onClick={onClose} aria-label="Fermer" className="text-white/40 hover:text-white"><X className="size-4" /></button>
    </div>
  )
}

export function Toaster() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-24 right-1/2 z-[60] flex translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:right-6 lg:translate-x-0">
      {toasts.map((t) => <Toast key={t.id} t={t} onClose={() => dismissToast(t.id)} />)}
    </div>
  )
}
