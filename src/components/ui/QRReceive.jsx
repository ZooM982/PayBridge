import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { gsap } from 'gsap'
import { Zap, Bitcoin, Copy, Check, RefreshCw, ChevronDown, Loader2, X } from 'lucide-react'
import { Button } from './Button'
import { api } from '../../services/api'
import { cn } from '../../lib/format'

const CHAINS = [
  { id: 'BTC',  label: 'Bitcoin (BTC)',     prefix: 'bitcoin:' },
  { id: 'USDT', label: 'USDT (Tron TRC20)', prefix: '' },
  { id: 'USDC', label: 'USDC (Ethereum)',    prefix: '' },
]

/* ── Modal centré (bottom-sheet sur mobile, centré sur desktop) ── */
function Modal({ open, onClose, title, children }) {
  const panel = useRef()
  const overlay = useRef()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const tl = gsap.timeline()
    tl.fromTo(overlay.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
      .fromTo(panel.current, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'expo.out' }, 0)
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => { tl.kill(); window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      {/* Overlay plein écran (couvre aussi la sidebar) */}
      <div ref={overlay} onClick={onClose} className="absolute inset-0 bg-night/50 backdrop-blur-[3px]" />
      {/* Centering — décalé de 260px sur lg pour tenir compte de la sidebar fixe */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6 lg:pl-[260px]">
        <div ref={panel} className="pointer-events-auto relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-5">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-xl text-ink-mute hover:bg-mist hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'min(85dvh, 560px)' }}>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Helpers ── */
function useQRUrl(text) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!text) { setUrl(null); return }
    QRCode.toDataURL(text, { width: 220, margin: 2, color: { dark: '#0B1220', light: '#ffffff' } })
      .then(setUrl).catch(() => setUrl(null))
  }, [text])
  return url
}

function CopyBtn({ text, className }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    })
  }
  return (
    <button onClick={copy} className={cn(
      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
      done ? 'bg-volt/15 text-volt' : 'bg-mist text-ink-soft hover:bg-volt/10 hover:text-volt',
      className,
    )}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? 'Copié !' : 'Copier'}
    </button>
  )
}

function QRDisplay({ text }) {
  const url = useQRUrl(text)
  if (!text) return null
  return url
    ? <img src={url} alt="QR code" className="mx-auto size-[220px] rounded-2xl border border-line shadow-sm" />
    : <div className="mx-auto flex size-[220px] items-center justify-center rounded-2xl border border-line bg-mist"><Loader2 className="size-6 animate-spin text-ink-mute" /></div>
}

function ExpiryBadge({ expiresAt }) {
  const [secs, setSecs] = useState(null)
  useEffect(() => {
    if (!expiresAt) return
    const target = new Date(expiresAt).getTime()
    const tick = () => setSecs(Math.max(0, Math.floor((target - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  if (secs === null) return null
  const expired = secs === 0
  const m = Math.floor(secs / 60), s = secs % 60
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', expired ? 'bg-danger/10 text-danger' : 'bg-volt/10 text-volt')}>
      {expired ? 'Expirée' : `Expire dans ${m}:${String(s).padStart(2, '0')}`}
    </span>
  )
}

/* ── Onglet Lightning ── */
function LightningTab() {
  const [amountUsd, setAmountUsd] = useState('')
  const [desc, setDesc] = useState('')
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generate = async () => {
    setError(null); setLoading(true)
    try {
      setInvoice(await api.createLightningInvoice({ amountUsd: Number(amountUsd) || 0, description: desc || 'PayBridge' }))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (invoice) return (
    <div className="flex flex-col items-center gap-4">
      <QRDisplay text={invoice.paymentRequest} />
      <div className="flex items-center gap-2">
        <ExpiryBadge expiresAt={invoice.expiresAt} />
        {invoice.amountSat > 0 && <span className="text-[12px] text-ink-mute">{invoice.amountSat.toLocaleString('fr-FR')} sats</span>}
      </div>
      <div className="w-full rounded-xl border border-line bg-mist px-3 py-2">
        <p className="break-all font-mono text-[10px] leading-relaxed text-ink-mute">{invoice.paymentRequest}</p>
      </div>
      <div className="flex w-full gap-2">
        <CopyBtn text={invoice.paymentRequest} className="flex-1 justify-center" />
        <button onClick={() => setInvoice(null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-mist/80 transition-colors">
          <RefreshCw className="size-3.5" /> Nouvelle
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
        <Zap className="mb-0.5 mr-1 inline size-3.5" />
        Paiements instantanés, frais quasi-nuls.
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Montant (USD)</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-ink-mute">$</span>
          <input type="number" min="0" step="0.01" value={amountUsd} onChange={e => setAmountUsd(e.target.value)} placeholder="0.00"
            className="h-11 w-full rounded-xl border border-line bg-white pl-8 pr-3 text-[14px] outline-none placeholder:text-ink-mute focus:border-volt focus:ring-4 focus:ring-volt/15" />
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Description <span className="font-normal text-ink-mute">(optionnel)</span></span>
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Facture #001, Commande…"
          className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none placeholder:text-ink-mute focus:border-volt focus:ring-4 focus:ring-volt/15" />
      </label>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
      <Button onClick={generate} loading={loading} icon={Zap} className="w-full">Générer la facture Lightning</Button>
    </div>
  )
}

/* ── Onglet On-chain ── */
function OnChainTab() {
  const [chain, setChain] = useState('BTC')
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (c) => {
    setError(null); setLoading(true)
    try { setData(await api.getDepositAddress({ chain: c })) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(chain) }, [chain, load])

  const selected = CHAINS.find(c => c.id === chain)
  const qrText = data?.address ? `${selected?.prefix ?? ''}${data.address}` : null

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
        <Bitcoin className="mb-0.5 mr-1 inline size-3.5" />
        Partagez cette adresse pour recevoir un paiement on-chain.
      </div>

      <div className="relative">
        <button onClick={() => setOpen(v => !v)}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-line bg-white px-3.5 text-[14px] text-ink hover:border-volt/60 focus:border-volt focus:outline-none focus:ring-4 focus:ring-volt/15">
          <span>{selected?.label}</span>
          <ChevronDown className={cn('size-4 text-ink-mute transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
            {CHAINS.map(c => (
              <button key={c.id} onClick={() => { setChain(c.id); setOpen(false) }}
                className={cn('flex w-full items-center px-4 py-3 text-[13px] text-left transition-colors hover:bg-mist', c.id === chain && 'bg-volt/5 font-semibold text-volt')}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}

      {loading
        ? <div className="flex h-[220px] items-center justify-center"><Loader2 className="size-6 animate-spin text-ink-mute" /></div>
        : data?.address && (
          <div className="flex flex-col items-center gap-4">
            <QRDisplay text={qrText} />
            <div className="w-full rounded-xl border border-line bg-mist px-3 py-2">
              <p className="break-all font-mono text-[11px] leading-relaxed text-ink-mute">{data.address}</p>
            </div>
            <div className="flex w-full gap-2">
              <CopyBtn text={data.address} className="flex-1 justify-center" />
              <button onClick={() => load(chain)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-mist/80 transition-colors">
                <RefreshCw className="size-3.5" /> Rafraîchir
              </button>
            </div>
          </div>
        )
      }
    </div>
  )
}

/* ── Composant principal ── */
const TABS = [
  { id: 'lightning', label: 'Lightning', icon: Zap },
  { id: 'onchain',   label: 'On-chain',  icon: Bitcoin },
]

export function QRReceive({ open, onClose }) {
  const [tab, setTab] = useState('lightning')
  return (
    <Modal open={open} onClose={onClose} title="Recevoir un paiement">
      <div className="flex flex-col gap-5">
        <div className="flex rounded-xl bg-mist p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-colors',
                tab === id ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink')}>
              <Icon className="size-3.5" />{label}
            </button>
          ))}
        </div>
        {tab === 'lightning' ? <LightningTab key="ln" /> : <OnChainTab key="oc" />}
      </div>
    </Modal>
  )
}
