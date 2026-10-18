import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/** Apparition en cascade des éléments [data-reveal] d'un conteneur. */
export function useReveal(deps = []) {
  const scope = useRef()
  useGSAP(() => {
    gsap.from('[data-reveal]', { y: 18, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06, clearProps: 'all' })
  }, { scope, dependencies: deps })
  return scope
}

/** Compteur animé pour les montants. */
export function useCountUp(value, format, deps = []) {
  const ref = useRef()
  useGSAP(() => {
    if (!ref.current || value == null) return
    const o = { v: 0 }
    gsap.to(o, { v: value, duration: 1.3, ease: 'power3.out', onUpdate: () => { if (ref.current) ref.current.textContent = format(o.v) } })
  }, { dependencies: [value, ...deps] })
  return ref
}
