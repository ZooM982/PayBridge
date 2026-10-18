/**
 * PayInvoice — coller ou scanner un code BOLT11 / adresse crypto pour payer.
 * Intégré dans NewTransfer en mode "Payer une facture".
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'
import {
  QrCode, Camera, X, Zap, Bitcoin, CheckCircle2, Loader2, AlertTriangle,
  ClipboardPaste, ArrowRight,
} from 'lucide-react'
import { Button } from './Button'
import { api } from '../../services/api'
import { money, cn } from '../../lib/format'
import { DEMO_RATES_USD } from '../../data/demo'

/* ── Détection automatique du type de code ── */
function detectType(raw) {
  const s = (raw ?? '').trim().replace(/^bitcoin:/i, '').replace(/^lightning:/i, '')
  if (/^(lnbc|lntb|lnbcrt)/i.test(s)) return 'lightning'
  if (/^[13][a-zA-Z0-9]{25,34}$/.test(s) || /^bc1[a-z0-9]{39,59}$/.test(s)) return 'bitcoin'
  if (/^T[a-zA-Z0-9]{33}$/.test(s)) return 'usdt'
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return 'usdc'
  return null
}

const TYPE_META = {
  lightning: { label: 'Facture Lightning', icon: Zap,     color: 'text-amber-600 bg-amber-50' },
  bitcoin:   { label: 'Adresse Bitcoin',   icon: Bitcoin, color: 'text-orange-600 bg-orange-50' },
  usdt:      { label: 'Adresse USDT (Tron)', icon: Bitcoin, color: 'text-green-700 bg-green-50' },
  usdc:      { label: 'Adresse USDC (ETH)', icon: Bitcoin, color: 'text-blue-600 bg-blue-50'   },
}

/* ── Scanner caméra (overlay plein écran) ── */
function CameraScanner({ onResult, onClose }) {
  const videoRef = useRef()
  const canvasRef = useRef()
  const rafRef = useRef()
  const streamRef = useRef()
  const [error, setError] = useState(null)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  useEffect(() => {
    let alive = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        videoRef.current.play()

        const scan = () => {
          const v = videoRef.current
          const c = canvasRef.current
          if (!v || !c || v.readyState < 2) { rafRef.current = requestAnimationFrame(scan); return }
          c.width = v.videoWidth; c.height = v.videoHeight
          const ctx = c.getContext('2d')
          ctx.drawImage(v, 0, 0)
          const img = ctx.getImageData(0, 0, c.width, c.height)
          const found = jsQR(img.data, img.width, img.height)
          if (found?.data) { stop(); onResult(found.data) }
          else rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      })
      .catch(() => { if (alive) setError('Caméra inaccessible. Vérifiez les permissions.') })

    return () => { alive = false; stop() }
  }, [onResult, stop])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-night">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-[15px] font-semibold text-white">Scanner un QR code</p>
        <button onClick={() => { stop(); onClose() }} className="grid size-9 place-items-center rounded-xl text-white/60 hover:bg-white/10"><X className="size-5" /></button>
      </div>

      {error
        ? <div className="flex flex-1 items-center justify-center px-6 text-center text-white/70">{error}</div>
        : (
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {/* Viseur */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative size-60">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-volt" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-volt" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-volt" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-volt" />
              </div>
            </div>
          </div>
        )
      }
      <p className="py-5 text-center text-[13px] text-white/40">Pointez vers un QR code Lightning ou crypto</p>
    </div>,
    document.body,
  )
}

/* ── Composant principal ── */
export function PayInvoice({ selectedWallet, onSuccess }) {
  const [raw, setRaw] = useState('')
  const [scanning, setScanning] = useState(false)
  const [type, setType] = useState(null)
  const [decoded, setDecoded] = useState(null)
  const [decoding, setDecoding] = useState(false)
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const [customUsd, setCustomUsd] = useState('')

  const handleInput = async (value) => {
    const v = value.trim().replace(/^(bitcoin:|lightning:)/i, '')
    setRaw(value); setError(null); setDecoded(null); setDone(null); setCustomUsd('')
    const t = detectType(v)
    setType(t)
    if (t === 'lightning' && v.length > 20) {
      setDecoding(true)
      try {
        const res = await api.decodeLightning({ request: v })
        setDecoded(res)
      } catch { setError('Impossible de décoder cette facture.') }
      finally { setDecoding(false) }
    }
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      handleInput(text)
    } catch { setError('Impossible de lire le presse-papier.') }
  }

  const SATS_PER_USD = DEMO_RATES_USD.SATS ?? 95_000
  const freeAmount = decoded?.amountSat === 0
  const customSat = freeAmount ? Math.round(Number(customUsd) * SATS_PER_USD) : 0

  const pay = async () => {
    setError(null); setPaying(true)
    try {
      const params = { paymentRequest: raw.trim() }
      if (freeAmount && customSat > 0) params.amountSat = customSat
      const res = await api.payLightningInvoice(params)
      setDone(res)
      setTimeout(() => onSuccess?.(res), 2000)
    } catch (e) { setError(e.message) }
    finally { setPaying(false) }
  }

  const meta = type ? TYPE_META[type] : null
  const amountUsd = decoded?.amountSat ? decoded.amountSat / SATS_PER_USD : null

  if (done) return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-volt/10 text-volt"><CheckCircle2 className="size-8" /></span>
      <div>
        <p className="text-[17px] font-semibold">Paiement envoyé !</p>
        {done.amountSat > 0 && <p className="mt-1 text-[13px] text-ink-mute">{done.amountSat.toLocaleString('fr-FR')} sats · frais {done.feeSat} sats</p>}
      </div>
      <button onClick={() => { setRaw(''); setType(null); setDecoded(null); setDone(null); setCustomUsd('') }}
        className="text-[13px] font-semibold text-volt-600 hover:underline">Nouveau paiement</button>
    </div>
  )

  return (
    <>
      {scanning && (
        <CameraScanner
          onResult={(data) => { setScanning(false); handleInput(data) }}
          onClose={() => setScanning(false)}
        />
      )}

      <div className="flex flex-col gap-4">
        {/* Champ de saisie */}
        <div className="flex flex-col gap-2">
          <label className="label">Code BOLT11 ou adresse crypto</label>
          <div className="relative">
            <textarea
              value={raw}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Collez un code Lightning (lnbc…) ou une adresse Bitcoin / USDT / USDC…"
              rows={3}
              className="field w-full resize-none font-mono text-[12px] leading-relaxed pr-10"
            />
            {raw && (
              <button onClick={() => { setRaw(''); setType(null); setDecoded(null); setError(null); setCustomUsd('') }}
                className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-md text-ink-mute hover:bg-mist hover:text-ink">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={paste}
              className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-ink-mute/10 hover:text-ink transition-colors">
              <ClipboardPaste className="size-3.5" /> Coller
            </button>
            <button onClick={() => setScanning(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-ink-mute/10 hover:text-ink transition-colors">
              <Camera className="size-3.5" /> Scanner QR
            </button>
          </div>
        </div>

        {/* Type détecté */}
        {meta && !decoding && (
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium', meta.color)}>
            <meta.icon className="size-4 shrink-0" />
            {meta.label} détecté{decoded?.isExpired ? ' · ⚠ Facture expirée' : ''}
          </div>
        )}

        {decoding && (
          <div className="flex items-center gap-2 text-[13px] text-ink-mute">
            <Loader2 className="size-4 animate-spin" /> Décodage en cours…
          </div>
        )}

        {/* Détails décodés (Lightning) */}
        {decoded && !decoded.isExpired && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-line divide-y divide-line text-[14px]">
              {[
                ['Montant', decoded.amountSat > 0 ? `${decoded.amountSat.toLocaleString('fr-FR')} sats (≈ ${money(amountUsd, 'USD')})` : 'Libre — à saisir'],
                ['Description', decoded.description || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-ink-soft shrink-0">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
              {selectedWallet && (
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-ink-soft shrink-0">Débité de</dt>
                  <dd className="text-right font-medium">{selectedWallet.label} · {money(selectedWallet.balance, selectedWallet.currency)}</dd>
                </div>
              )}
            </div>

            {/* Saisie du montant pour les factures à montant libre */}
            {freeAmount && (
              <div>
                <label className="label mb-1.5 block">Montant à envoyer</label>
                <div className={`flex h-14 items-center rounded-xl border bg-white transition-colors focus-within:ring-4
                  ${!customUsd || customSat > 0 ? 'border-line focus-within:border-volt focus-within:ring-volt/15' : 'border-danger focus-within:ring-danger/15'}`}>
                  <input
                    inputMode="decimal"
                    value={customUsd}
                    onChange={(e) => setCustomUsd(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
                    placeholder="0"
                    className="tabular h-full min-w-0 flex-1 rounded-l-xl bg-transparent px-4 text-[22px] font-bold outline-none placeholder:text-ink-mute/40"
                  />
                  <span className="mr-4 text-[13px] font-semibold text-ink-soft">USD</span>
                </div>
                {customSat > 0 && (
                  <p className="mt-1.5 text-[12px] text-ink-mute">
                    ≈ {customSat.toLocaleString('fr-FR')} sats
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Adresse non-Lightning : message info */}
        {type && type !== 'lightning' && (
          <div className="flex items-start gap-2 rounded-xl bg-info-50 p-3 text-[12px] text-[#1E4FA8]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Les paiements on-chain (Bitcoin, USDT, USDC) passent par le flux de transfert standard. Le canal crypto sera présélectionné.</p>
          </div>
        )}

        {error && (
          <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">
            <AlertTriangle className="size-4 shrink-0" />{error}
          </p>
        )}

        {/* Bouton payer */}
        {type === 'lightning' && decoded && !decoded.isExpired && (
          <Button
            onClick={pay}
            loading={paying}
            icon={Zap}
            size="lg"
            className="w-full"
            disabled={freeAmount && !(customSat > 0)}
          >
            {paying
              ? 'Envoi en cours…'
              : freeAmount
                ? (customSat > 0 ? `Payer ${customSat.toLocaleString('fr-FR')} sats` : 'Saisissez un montant')
                : `Payer ${decoded.amountSat.toLocaleString('fr-FR')} sats`}
          </Button>
        )}
      </div>
    </>
  )
}
