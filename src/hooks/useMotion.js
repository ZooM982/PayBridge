import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/** Apparition en cascade des éléments [data-reveal] d'un conteneur. */
export function useReveal(deps = []) {
  const scope = useRef()
  useGSAP(() => {
    // Le conteneur n'existe pas encore (ex. rendu « erreur » avant l'élément scopé) : on sort.
    if (!scope.current) return
    const targets = scope.current.querySelectorAll('[data-reveal]')
    if (!targets.length) return
    gsap.from(targets, { y: 18, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06, clearProps: 'all' })
  }, { scope, dependencies: deps })
  return scope
}

/**
 * Compteur animé pour les montants.
 * Passe par l'état React (et non textContent) : la valeur affichée converge
 * toujours exactement vers `value`, même si le composant se re-rend entre-temps.
 * Renvoie la chaîne déjà formatée.
 */
export function useCountUp(value, format, deps = []) {
  const [display, setDisplay] = useState(() => value ?? 0)
  useGSAP(() => {
    if (value == null) { setDisplay(0); return }
    const o = { v: display }
    const tween = gsap.to(o, { v: value, duration: 1.3, ease: 'power3.out', onUpdate: () => setDisplay(o.v) })
    return () => tween.kill()
  }, { dependencies: [value, ...deps] })
  return format(display)
}
