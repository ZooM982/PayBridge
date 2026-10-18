import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { money } from '../../lib/format'

/**
 * Graphique en aires SVG, sans dépendance. Ligne dessinée avec GSAP, tooltip au survol / toucher.
 * data: [{ label: string, value: number }]
 */
export function AreaChart({ data, height = 240, currency = 'USD' }) {
  const box = useRef()
  const [W, setW] = useState(720)
  const H = W < 480 ? Math.round(height * 0.75) : height, P = { t: 16, r: 8, b: 28, l: 8 }
  const [hover, setHover] = useState(null)
  const svg = useRef(), line = useRef(), area = useRef()
  // Largeur réelle → les libellés restent lisibles sur mobile
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(box.current); return () => ro.disconnect()
  }, [])

  const { pts, path, fill, max, ticks } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1) * 1.15
    const sx = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(data.length - 1, 1)
    const sy = (v) => P.t + (1 - v / max) * (H - P.t - P.b)
    const pts = data.map((d, i) => [sx(i), sy(d.value)])
    // Courbe lissée (Catmull-Rom → Bézier)
    const path = pts.reduce((acc, p, i, a) => {
      if (!i) return `M${p[0]},${p[1]}`
      const p0 = a[i - 2] ?? a[i - 1], p1 = a[i - 1], p3 = a[i + 1] ?? p
      const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6]
      const c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6]
      return `${acc} C${c1},${c2},${p}`
    }, '')
    const fill = `${path} L${pts.at(-1)[0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`
    const ticks = [0.25, 0.5, 0.75, 1].map((f) => P.t + (1 - f / 1.15) * (H - P.t - P.b))
    return { pts, path, fill, max, ticks }
  }, [data, H, W])

  useGSAP(() => {
    const len = line.current.getTotalLength()
    gsap.fromTo(line.current, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' })
    gsap.fromTo(area.current, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.5 })
  }, { scope: svg, dependencies: [path] })

  const onMove = (e) => {
    const r = svg.current.getBoundingClientRect()
    const x = ((e.touches?.[0]?.clientX ?? e.clientX) - r.left) * (W / r.width)
    let best = 0
    pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i })
    setHover(best)
  }

  const step = Math.ceil(data.length / (W < 480 ? 4 : 7))
  return (
    <div ref={box} className="relative">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img"
        aria-label="Volume des transferts par jour" onMouseMove={onMove} onTouchMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="pb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D68F" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#00D68F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((y, i) => <line key={i} x1={P.l} x2={W - P.r} y1={y} y2={y} stroke="#E4E8EE" strokeDasharray="3 5" />)}
        <path ref={area} d={fill} fill="url(#pb-area)" />
        <path ref={line} d={path} fill="none" stroke="#00D68F" strokeWidth="2.5" strokeLinecap="round" />
        {data.map((d, i) => i % step === 0 && (
          <text key={i} x={pts[i][0]} y={H - 6} textAnchor={i === 0 ? 'start' : 'middle'} className="fill-ink-mute text-[11px]">{d.label}</text>
        ))}
        {hover != null && (
          <g>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={P.t} y2={H - P.b} stroke="#0B1220" strokeOpacity="0.12" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="6" fill="#fff" stroke="#00D68F" strokeWidth="3" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-night px-3 py-2 text-white shadow-[var(--shadow-pop)]"
          style={{ left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%`, marginTop: -12 }}>
          <p className="text-[11px] text-white/55">{data[hover].label}</p>
          <p className="tabular text-[13px] font-semibold">{money(data[hover].value, currency)}</p>
        </div>
      )}
      <span className="sr-only">Maximum : {money(max / 1.15, currency)}</span>
    </div>
  )
}
