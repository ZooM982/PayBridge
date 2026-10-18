import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { X } from 'lucide-react'

/** Panneau latéral (desktop) / feuille du bas (mobile), animé avec GSAP. */
export function Drawer({ open, onClose, title, children, footer }) {
  const panel = useRef(), overlay = useRef(), close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const mobile = window.innerWidth < 640
    const tl = gsap.timeline()
    tl.fromTo(overlay.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
      .fromTo(panel.current, mobile ? { y: '100%' } : { x: '100%' }, { x: 0, y: 0, duration: 0.45, ease: 'expo.out' }, 0)
    const onKey = (e) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => { tl.kill(); window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={overlay} onClick={onClose} className="absolute inset-0 bg-night/40 backdrop-blur-[2px]" />
      <aside ref={panel} className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-white sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-xl text-ink-mute hover:bg-mist hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  )
}
