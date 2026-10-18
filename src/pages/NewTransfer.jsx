import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  ArrowRight, ArrowLeft, ArrowDown, Info, Lock, ShieldCheck, UserPlus, Pencil, AlertTriangle, Smartphone, Landmark, Zap, Bitcoin, QrCode, Users, FlaskConical,
} from 'lucide-react'
import { useStore } from '../context/AppStore'
import { api } from '../services/api'
import { useReveal } from '../hooks/useMotion'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Select, Input } from '../components/ui/Field'
import { Avatar, DemoTag, Flag, PoweredBy } from '../components/ui/Misc'
import { PayInvoice } from '../components/ui/PayInvoice'
import { PageHeader } from '../components/layout/PageHeader'
import { COUNTRIES, DEMO_RATES_USD, DEMO_FEES, REASONS, REASON_LABELS } from '../data/demo'
import { money, quote, country, cn } from '../lib/format'
import { channelsOf, channelTitle, channelAccount, CHANNEL_KINDS } from '../lib/channels'
import { channelSupport, effectiveCryptoAsset } from '../lib/corridors'

const SENDERS = COUNTRIES
const RECEIVERS = COUNTRIES.filter((c) => !['FR', 'US'].includes(c.code))
const QUICK = [1, 5, 10, 25, 50]
const KIND_ICON = { mobile: Smartphone, bank: Landmark, crypto: Bitcoin, lightning: Zap }
const DEC = { SATS: 0, USDT: 2, USDC: 2, BTC: 8 }
const RAIL_ICON = { mobile: Smartphone, bank: Landmark, crypto: Bitcoin, lightning: Zap }
const fiatOf = (ch) => !ch ? true : !['crypto', 'lightning'].includes(ch.kind)
const recvOf = (ch, toCountry) => fiatOf(ch) ? country(toCountry)?.currency : (ch?.kind === 'lightning' ? 'SATS' : (ch?.asset ?? 'USDT'))
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d

function Stepper({ step }) {
  const steps = ['Détails', 'Vérification', 'Confirmation']
  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3" aria-label="Étapes du transfert" data-reveal>
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 sm:gap-3">
          <span className={cn('grid size-7 place-items-center rounded-full text-[12px] font-bold transition-colors',
            i < step ? 'bg-volt text-night' : i === step ? 'bg-night text-white' : 'bg-white text-ink-mute border border-line')}
            aria-current={i === step ? 'step' : undefined}>{i + 1}</span>
          <span className={cn('text-[13px] font-semibold', i === step ? 'text-ink' : 'text-ink-mute', i !== step && 'hidden sm:inline')}>{s}</span>
          {i < steps.length - 1 && <span className={cn('h-px w-6 sm:w-10', i < step ? 'bg-volt' : 'bg-line')} />}
        </li>
      ))}
    </ol>
  )
}

/** Compte à rebours de garantie du taux (60 s), anneau animé avec GSAP. */
function RateLock({ seed }) {
  const [left, setLeft] = useState(60)
  const ring = useRef()
  useEffect(() => {
    setLeft(60)
    const id = setInterval(() => setLeft((l) => (l <= 1 ? 60 : l - 1)), 1000)
    return () => clearInterval(id)
  }, [seed])
  useGSAP(() => { gsap.fromTo(ring.current, { strokeDashoffset: 0 }, { strokeDashoffset: 75.4, duration: 60, ease: 'none', repeat: -1 }) }, { dependencies: [seed] })
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/60">
      <svg viewBox="0 0 28 28" className="size-4 -rotate-90"><circle cx="14" cy="14" r="12" fill="none" stroke="rgb(255 255 255 / .15)" strokeWidth="4" />
        <circle ref={ring} cx="14" cy="14" r="12" fill="none" stroke="#00D68F" strokeWidth="4" strokeDasharray="75.4" /></svg>
      Taux garanti {left}s
    </span>
  )
}

function SummaryPanel({ q, form, beneficiary, ch, step }) {
  const ref = useRef()
  const recv = q.receiveCurrency ?? country(form.toCountry)?.currency
  const recvRef = useRef()
  useGSAP(() => {
    if (!recvRef.current) return
    const o = { v: Number(recvRef.current.dataset.prev || 0) }
    gsap.to(o, { v: q.received, duration: 0.5, ease: 'power2.out', onUpdate: () => { recvRef.current.textContent = money(o.v, recv) } })
    recvRef.current.dataset.prev = q.received
  }, { dependencies: [q.received, recv] })

  const Icon = ch?.kind ? KIND_ICON[ch.kind] : ArrowDown
  return (
    <div ref={ref} className="relative overflow-hidden rounded-[var(--radius-card)] bg-night p-6 text-white lg:sticky lg:top-24" data-reveal>
      <div aria-hidden className="absolute -bottom-24 -right-16 size-64 rounded-full bg-volt/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-white/80">Calcul du transfert</p>
          <RateLock seed={`${form.sendCurrency}-${form.toCountry}-${ch?.kind ?? ''}`} />
        </div>

        <div className="mt-5 rounded-2xl bg-white/[0.06] p-4">
          <p className="text-[12px] text-white/50">Vous envoyez</p>
          <p className="tabular mt-0.5 text-[24px] font-bold">{money(q.amount, form.sendCurrency)}</p>
        </div>

        <div className="relative my-1 ml-6 border-l border-dashed border-white/20 py-3 pl-6 text-[13px]">
          <div className="flex justify-between py-1"><span className="text-white/55">Frais PayBridge</span><span className="tabular font-medium">− {money(q.fee, form.sendCurrency)}</span></div>
          <div className="flex justify-between py-1"><span className="text-white/55">Montant converti</span><span className="tabular font-medium">{money(q.net, fiatOf(ch) ? form.sendCurrency : recv)}</span></div>
          <div className="flex justify-between py-1"><span className="text-white/55">Taux de change</span>
            <span className="tabular font-medium">{fiatOf(ch) ? `1 ${form.sendCurrency} = ${q.rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${recv}`
              : ch.kind === 'lightning' ? `1 ${form.sendCurrency} = ${q.rate.toLocaleString('fr-FR')} sats` : `1 ${form.sendCurrency} = 1 ${recv}`}</span></div>
          <div className="flex justify-between py-1"><span className="text-white/55">Délai estimé</span>
            <span className="font-medium text-volt">{ch?.kind === 'lightning' ? '~ 10 secondes' : ch?.kind === 'crypto' ? '~ 5 minutes' : '~ 2 minutes'}</span></div>
          <span className="absolute -left-[13px] top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-volt text-night"><ArrowDown className="size-3.5" strokeWidth={3} /></span>
        </div>

        <div className="rounded-2xl bg-volt p-4 text-night">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-night/60"><Icon className="size-3.5" />{beneficiary?.name ? `${beneficiary.name.split(' ')[0]} reçoit` : 'Le bénéficiaire reçoit'}</p>
          <p ref={recvRef} className="tabular mt-0.5 text-[26px] font-bold tracking-tight">{money(q.received, recv)}</p>
        </div>

        <div className="mt-5 space-y-2 text-[12px] text-white/50">
          <p className="flex items-center gap-2"><Lock className="size-3.5" /> Montants verrouillés avant votre confirmation</p>
          <p className="flex items-center gap-2"><ShieldCheck className="size-3.5" /> Rail : {ch
            ? `${CHANNEL_KINDS[ch.kind]?.label ?? ch.kind} (${ch.kind === 'crypto' ? `${recv} · ${ch.chain ?? 'ETHEREUM'}` : channelTitle(ch)})`
            : '—'}</p>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <PoweredBy className="!text-white/35" /><DemoTag />
        </div>
      </div>
    </div>
  )
}

export default function NewTransfer() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { beneficiaries, wallet, createTransfer, toast, loading } = useStore()
  const [payMode, setPayMode] = useState('beneficiary') // 'beneficiary' | 'invoice'
  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [sandboxFunding, setSandboxFunding] = useState(false)
  const [form, setForm] = useState({
    fromCountry: 'SN', toCountry: 'GH', sendCurrency: 'USD', amount: params.get('amount') ?? '250', beneficiaryId: '', channelId: '', reason: 'family_support',
  })
  const scope = useReveal([step])
  const stepRef = useRef()

  const beneficiary = beneficiaries.find((b) => b.id === form.beneficiaryId)
  const chs = useMemo(() => channelsOf(beneficiary), [beneficiary])
  // Aucun canal par défaut : l'utilisateur doit choisir explicitement le rail de réception.
  const channel = chs.find((c) => c.id === form.channelId) ?? null
  // Le canal choisi est-il accepté par Bitnob pour ce corridor ? (sinon on bloque.)
  const support = useMemo(() => channelSupport(channel, form.toCountry, form.sendCurrency), [channel, form.toCountry, form.sendCurrency])

  // Le pays de réception suit le bénéficiaire choisi (le canal reste à choisir explicitement).
  useEffect(() => {
    const b = beneficiaries.find((x) => x.id === form.beneficiaryId)
    if (!b) return
    setForm((f) => (f.toCountry === b.country ? f : { ...f, toCountry: b.country }))
  }, [beneficiaries, form.beneficiaryId])

  // Facture Lightning : le montant impose le sien — décodage BOLT11 (mode démo simulé).
  const [invoice, setInvoice] = useState(null)
  useEffect(() => {
    if (channel?.kind !== 'lightning') { setInvoice(null); return }
    let alive = true
    api.decodeLightning({ request: channel.account }).then((r) => { if (alive) setInvoice(r) }).catch(() => {})
    return () => { alive = false }
  }, [channel?.id, channel?.kind, channel?.account])
  useEffect(() => {
    if (invoice && channel?.kind === 'lightning') {
      setForm((f) => ({ ...f, amount: round(invoice.amountSat / DEMO_RATES_USD.SATS, 2).toFixed(2) }))
    }
  }, [invoice, channel?.id, channel?.kind])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'toCountry' ? { beneficiaryId: '', channelId: '' } : {}) }))
  const fiat = fiatOf(channel)
  // Pour un canal crypto, l'actif reçu = la devise du portefeuille débité
  // (USDC envoyé sur un canal ETH part en USDC, pas en USDT).
  const recvCurrency = channel?.kind === 'crypto'
    ? effectiveCryptoAsset(channel, form.sendCurrency)
    : recvOf(channel, form.toCountry)
  // Actif envoyé ≠ actif déclaré par le canal : valide pour un wallet self-custody,
  // risqué sur une adresse de dépôt d'exchange spécifique à un token → on avertit.
  const declaredAsset = channel ? String(channel.asset ?? '').toUpperCase() : ''
  const assetMismatch = channel?.kind === 'crypto' && !!declaredAsset && declaredAsset !== recvCurrency

  const qLocal = useMemo(() => quote({ amount: form.amount, sendCurrency: form.sendCurrency, receiveCurrency: fiat ? recvCurrency : 'USD' }), [form.amount, form.sendCurrency, recvCurrency, fiat])
  const [qApi, setQApi] = useState(null)
  useEffect(() => {
    if (!fiat) return
    if (!(Number(form.amount) > 0)) { setQApi(null); return }
    let alive = true
    const t = setTimeout(() => {
      api.getQuote({ amount: Number(form.amount), sendCurrency: form.sendCurrency, toCountry: form.toCountry, receiveCurrency: recvCurrency })
        .then((r) => { if (alive) setQApi(r) }).catch(() => {})
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [form.amount, form.sendCurrency, form.toCountry, recvCurrency, fiat])

  /** Quote donneur d'ordre : devise de réception adaptée au canal choisi. */
  const q = useMemo(() => {
    if (fiat) return { ...qLocal, ...(qApi ?? {}), receiveCurrency: recvCurrency }
    const rate = channel?.kind === 'lightning' ? DEMO_RATES_USD.SATS : 1
    const dec = DEC[recvCurrency] ?? 8
    // qLocal.fee/net sont arrondis à 2 dp par quote() — insuffisant pour BTC (8 dp).
    // On recalcule avec la précision requise par la devise envoyée.
    const a = qLocal.amount
    const sendRate = DEMO_RATES_USD[form.sendCurrency] ?? 1
    const fee = a > 0 ? a * DEMO_FEES.percent + DEMO_FEES.fixedUsd * sendRate : 0
    const net = Math.max(a - fee, 0)
    return {
      ...qLocal,
      fee: round(fee, dec),
      net: round(net, dec),
      rate,
      received: round(net * rate, dec),
      receiveCurrency: recvCurrency,
    }
  }, [fiat, qLocal, qApi, recvCurrency, channel?.kind, form.sendCurrency])

  const wallets = wallet?.wallets ?? (wallet ? [{ currency: 'USD', balance: wallet.balance, label: 'Portefeuille USD' }] : [])
  const selectedWallet = wallets.find((w) => w.currency === form.sendCurrency) ?? wallets[0] ?? null
  const sendRate = DEMO_RATES_USD[form.sendCurrency] ?? 1
  const amountUsd = (Number(form.amount) || 0) / sendRate
  const MIN_SATS = 5000
  const errors = {
    amount: !(Number(form.amount) > 0) ? 'Saisissez un montant.'
      : amountUsd < 1 ? `Montant minimum : ${money(1 * sendRate, form.sendCurrency)}`
      : channel?.kind === 'lightning' && q.received < MIN_SATS ? `Montant minimum Lightning : ${MIN_SATS.toLocaleString('fr-FR')} sats (≈ ${money(MIN_SATS / (DEMO_RATES_USD.SATS ?? 1639), form.sendCurrency)})`
      : !sandboxFunding && selectedWallet && Number(form.amount) > selectedWallet.balance ? `Solde insuffisant — ${money(selectedWallet.balance, selectedWallet.currency)} disponibles.` : null,
    beneficiaryId: !form.beneficiaryId ? 'Choisissez un bénéficiaire.' : null,
    channelId: form.beneficiaryId && !channel ? 'Choisissez un canal de réception.'
      : channel && !support.ok ? support.reason : null,
  }
  const valid = !errors.amount && !errors.beneficiaryId && !errors.channelId

  const goStep = (n) => {
    gsap.to(stepRef.current, { opacity: 0, x: n > step ? -20 : 20, duration: 0.18, onComplete: () => {
      setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' })
      gsap.fromTo(stepRef.current, { opacity: 0, x: n > step ? 20 : -20 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' })
    } })
  }

  const next = () => {
    setTouched(true)
    if (!valid) { gsap.fromTo('[data-invalid="true"]', { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }); return }
    goStep(1)
  }

  const confirm = async () => {
    setSubmitting(true); setSubmitError(null)
    try {
      const tx = await createTransfer({ ...form, amount: Number(form.amount), paymentReason: form.reason, fundingMode: sandboxFunding ? 'onchain' : 'offchain', channel, beneficiary })
      toast({ title: 'Transfert créé', text: `${money(tx.amount, tx.sendCurrency)} vers ${tx.beneficiaryName}` })
      nav(`/transferts/${tx.id}`)
    } catch (e) {
      setSubmitError(e.message)
      toast({ title: 'Le transfert a échoué', text: e.message, tone: 'error' })
    } finally { setSubmitting(false) }
  }

  const amountLocked = channel?.kind === 'lightning' && !!invoice

  return (
    <div ref={scope}>
      <PageHeader eyebrow="Transferts" title="Nouveau transfert" subtitle="Choisissez le rail : Mobile Money, banque, crypto ou Lightning — frais et taux affichés avant confirmation." />
      <Stepper step={step} />

      <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:gap-6">
        <div ref={stepRef} className="min-w-0">
          {step === 0 ? (
            <Card className="p-5 sm:p-7" data-reveal>
              {/* ── Sélecteur de mode ── */}
              <div className="flex rounded-xl bg-mist p-1">
                {[
                  { id: 'beneficiary', label: 'Vers un bénéficiaire', icon: Users },
                  { id: 'invoice',     label: 'Scanner / Coller un code', icon: QrCode },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setPayMode(id)}
                    className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium transition-colors',
                      payMode === id ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink')}>
                    <Icon className="size-3.5" /><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{id === 'beneficiary' ? 'Bénéficiaire' : 'Code / QR'}</span>
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => setSandboxFunding((v) => !v)}
                className={cn('mt-4 flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors', sandboxFunding ? 'border-volt bg-volt-50/60' : 'border-line bg-white')}>
                <span className="flex items-center gap-2"><FlaskConical className="size-4 text-volt-600" /><span><strong className="block text-[13px]">Mode sandbox Bitnob</strong><span className="text-[12px] text-ink-mute">Payout on-chain puis dépôt fictif, sans solde réel.</span></span></span>
                <span className={cn('relative h-6 w-11 rounded-full', sandboxFunding ? 'bg-volt' : 'bg-line')}><span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', sandboxFunding ? 'left-5' : 'left-0.5')} /></span>
              </button>

              {payMode === 'invoice' ? (
                <div className="mt-5">
                  <PayInvoice selectedWallet={selectedWallet} onSuccess={(tx) => nav(`/historique`)} />
                </div>
              ) : (
              <>
              <h2 className="mt-5 text-[16px] font-semibold">À qui souhaitez-vous envoyer ?</h2>

              {/* ── 0. Compte à débiter ── */}
              {wallets.length > 0 && (
                <div className="mt-5">
                  <span className="label mb-1.5 block">Compte à débiter</span>
                  <div className={cn('grid gap-2', wallets.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
                    {wallets.map((w) => {
                      const on = form.sendCurrency === w.currency
                      return (
                        <button key={w.currency} onClick={() => setForm((f) => ({ ...f, sendCurrency: w.currency, amount: '' }))}
                          className={cn('flex flex-col rounded-xl border p-3 text-left transition-all',
                            on ? 'border-volt bg-volt-50/60 ring-4 ring-volt/10' : 'border-line hover:border-ink-mute')}>
                          <span className="truncate text-[11px] text-ink-mute">{w.label}</span>
                          <span className="tabular mt-1 text-[15px] font-bold leading-tight">{money(w.balance, w.currency)}</span>
                          {on && <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-volt">Sélectionné</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── 1. Bénéficiaire (en premier) ── */}
              <div className="mt-5" data-invalid={touched && !!errors.beneficiaryId}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="label">Destinataire</span>
                  <button onClick={() => nav('/beneficiaires?new=1')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-volt-600 hover:underline">
                    <UserPlus className="size-3.5" /> Nouveau
                  </button>
                </div>
                {loading
                  ? <div className="skeleton h-11 rounded-xl" />
                  : beneficiaries.length === 0
                    ? (
                      <div className="rounded-xl border border-dashed border-line p-4 text-[13px] text-ink-mute">
                        Aucun bénéficiaire enregistré.{' '}
                        <button className="font-semibold text-volt-600 hover:underline" onClick={() => nav('/beneficiaires?new=1')}>En ajouter un</button>
                      </div>
                    )
                    : (
                      <Select
                        id="beneficiary"
                        value={form.beneficiaryId}
                        error={touched && !!errors.beneficiaryId}
                        onChange={(e) => {
                          const id = e.target.value
                          const b = beneficiaries.find((x) => x.id === id)
                          setForm((f) => ({ ...f, beneficiaryId: id, channelId: '', toCountry: b?.country ?? f.toCountry }))
                        }}
                      >
                        <option value="">— Choisir un destinataire —</option>
                        {beneficiaries.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} · {channelsOf(b).map(channelTitle).join(', ')}
                          </option>
                        ))}
                      </Select>
                    )
                }
                {touched && errors.beneficiaryId && <p className="mt-1.5 text-[12px] font-medium text-danger">{errors.beneficiaryId}</p>}
              </div>

              {/* ── 2. Canal de réception (apparaît après sélection du bénéficiaire) ── */}
              {beneficiary && (
                <div className="mt-5" data-invalid={touched && !!errors.channelId}>
                  <span className="label mb-1.5 block">Canal de réception</span>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Canal de réception">
                    {chs.map((c) => {
                      const on = c.id === channel?.id
                      const Icon = KIND_ICON[c.kind]
                      const sup = channelSupport(c, form.toCountry, form.sendCurrency)
                      const title = c.kind === 'crypto'
                        ? `${effectiveCryptoAsset(c, form.sendCurrency)} · ${c.chain ?? 'ETHEREUM'}`
                        : channelTitle(c)
                      return (
                        <button key={c.id} role="radio" aria-checked={on} disabled={!sup.ok}
                          title={sup.ok ? undefined : sup.reason}
                          onClick={() => sup.ok && setForm((f) => ({ ...f, channelId: c.id }))}
                          className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                            !sup.ok ? 'cursor-not-allowed border-line bg-mist/50 opacity-70'
                              : on ? 'border-volt bg-volt-50/60 ring-4 ring-volt/10'
                              : touched && errors.channelId ? 'border-danger/50' : 'border-line hover:border-ink-mute')}>
                          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', on ? 'bg-volt-50 text-volt-600' : 'bg-mist text-ink-soft')}><Icon className="size-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{title}{c.isDefault && <span className="ml-1.5 rounded-md bg-night px-1 py-0.5 text-[9px] font-bold uppercase text-white">défaut</span>}</p>
                            <p className="truncate font-mono text-[11px] text-ink-mute">{channelAccount(c)}</p>
                            {!sup.ok && <p className="mt-0.5 text-[11px] font-semibold text-warn">Indisponible pour ce pays</p>}
                          </div>
                          <span className={cn('grid size-5 place-items-center rounded-full border-2', on ? 'border-volt bg-volt' : 'border-line')}>
                            {on && <span className="size-1.5 rounded-full bg-night" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {touched && errors.channelId && <p className="mt-1.5 text-[12px] font-medium text-danger">{errors.channelId}</p>}
                  {channel && !support.ok && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-warn">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {support.reason}
                    </p>
                  )}
                  {channel?.kind === 'crypto' && (
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-mute">
                      <Bitcoin className="size-3.5" /> Envoi de <b className="text-ink">{recvCurrency}</b> sur <b className="text-ink">{channel.chain ?? 'ETHEREUM'}</b> · adresse validée par le rail de paiement.
                    </p>
                  )}
                  {assetMismatch && (
                    <p className="mt-1.5 flex items-start gap-2 rounded-lg bg-warn/10 p-2.5 text-[12px] font-medium text-warn">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>Ce canal annonce <b>{declaredAsset}</b> mais vous envoyez <b>{recvCurrency}</b>. Valide vers un wallet personnel (même adresse sur ce réseau) ; sur une <b>adresse de dépôt d'exchange spécifique au {declaredAsset}</b>, les fonds pourraient ne pas être crédités.</span>
                    </p>
                  )}
                </div>
              )}

              {/* ── 3. Pays d'envoi + montant ── */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Pays d'envoi" htmlFor="from">
                  <Select id="from" value={form.fromCountry} onChange={set('fromCountry')}>
                    {SENDERS.map((c) => <option key={c.code} value={c.code}>{c.flag}  {c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Pays de réception" htmlFor="to">
                  <Select id="to" value={form.toCountry} onChange={set('toCountry')} disabled={!!beneficiary}>
                    {RECEIVERS.map((c) => <option key={c.code} value={c.code}>{c.flag}  {c.name} · {c.currency}</option>)}
                  </Select>
                </Field>
              </div>

              <div className="mt-4" data-invalid={touched && !!errors.amount}>
                <Field label="Montant à envoyer" htmlFor="amount" error={touched && errors.amount}
                  hint={amountLocked ? `Facture BOLT11 : montant imposé (${invoice?.amountSat.toLocaleString('fr-FR')} sats)`
                    : selectedWallet ? `Solde disponible : ${money(selectedWallet.balance, selectedWallet.currency)}` : null}>
                  <div className={cn('flex h-16 items-center rounded-2xl border bg-white transition-colors focus-within:ring-4',
                    touched && errors.amount ? 'border-danger focus-within:ring-danger/15' : 'border-line focus-within:border-volt focus-within:ring-volt/15')}>
                    <input id="amount" inputMode="decimal" value={form.amount} readOnly={amountLocked}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
                      className="tabular h-full min-w-0 flex-1 rounded-l-2xl bg-transparent px-5 text-[26px] font-bold outline-none read-only:text-ink-soft" placeholder="0" />
                    <span className="mr-4 text-[14px] font-bold text-ink-soft">{form.sendCurrency}</span>
                  </div>
                </Field>
                {!amountLocked && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {QUICK.map((v) => (
                      <button key={v} onClick={() => setForm((f) => ({ ...f, amount: String(v) }))}
                        className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                          Number(form.amount) === v ? 'border-night bg-night text-white' : 'border-line bg-white text-ink-soft hover:border-ink-mute')}>
                        {v.toLocaleString('fr-FR')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 4. Motif ── */}
              <div className="mt-4">
                <Field label="Motif du paiement" htmlFor="reason" hint="Requis par le rail de paiement (payment_reason)">
                  <Select id="reason" value={form.reason} onChange={set('reason')}>
                    {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                </Field>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-info-50 p-3 text-[12px] text-[#1E4FA8]">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>Mode démo : saisissez un montant se terminant par <b>.13</b> (ex. 120.13) pour simuler un refus sur le canal choisi.</p>
              </div>

              <div className="mt-6 flex justify-end">
                <Button size="lg" iconRight={ArrowRight} onClick={next} className="w-full sm:w-auto">Continuer</Button>
              </div>
              </>
              )}
            </Card>
          ) : (
            <Card className="p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">Vérifiez votre transfert</h2>
                <button onClick={() => goStep(0)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink"><Pencil className="size-3.5" />Modifier</button>
              </div>

              <div className="mt-5 flex items-center gap-4 rounded-2xl bg-mist p-4">
                <Avatar name={beneficiary.name} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold">{beneficiary.name}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-mute">
                    <Flag code={beneficiary.country} className="text-[14px]" /> {country(beneficiary.country)?.name} ·
                    {(() => { const Ri = RAIL_ICON[channel.kind]; return <Ri className="size-3.5" /> })()} {channelTitle(channel)} · {channelAccount(channel)}
                  </p>
                </div>
              </div>

              <dl className="mt-5 divide-y divide-line rounded-2xl border border-line px-4 text-[14px]">
                {[
                  ['Rail', channel.kind === 'crypto'
                    ? `Crypto — ${recvCurrency} · ${channel.chain ?? 'ETHEREUM'}`
                    : `${CHANNEL_KINDS[channel.kind]?.label} — ${channel.rail ?? CHANNEL_KINDS[channel.kind]?.rail}`],
                  ['Trajet', <span key="r"><Flag code={form.fromCountry} className="text-[14px]" /> {country(form.fromCountry)?.name}
                    {fiat && <> → <Flag code={form.toCountry} className="text-[14px]" /> {country(form.toCountry)?.name}</>}</span>],
                  ['Montant envoyé', money(q.amount, form.sendCurrency)],
                  ['Frais', money(q.fee, form.sendCurrency)],
                  ['Taux de change', fiat ? `1 ${form.sendCurrency} = ${q.rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${recvCurrency}`
                    : channel.kind === 'lightning' ? `1 ${form.sendCurrency} = ${q.rate.toLocaleString('fr-FR')} sats` : `1 ${form.sendCurrency} = 1 ${recvCurrency}`],
                  ['Motif', REASON_LABELS[form.reason] ?? form.reason],
                  ['Débité de votre solde', money(q.total, form.sendCurrency)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-3"><dt className="text-ink-soft">{k}</dt><dd className="tabular text-right font-medium">{v}</dd></div>
                ))}
                <div className="flex items-center justify-between gap-4 py-4"><dt className="font-semibold">Montant reçu</dt><dd className="tabular text-[20px] font-bold text-volt-600">{money(q.received, recvCurrency)}</dd></div>
              </dl>

              {assetMismatch && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-warn/20 bg-warn/10 p-4 text-[13px] text-warn">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Actif différent de celui annoncé par le destinataire</p>
                    <p className="mt-0.5 text-warn/80">Le canal de {beneficiary.name} déclare <b>{declaredAsset}</b> mais vous envoyez <b>{recvCurrency}</b>. Valide vers un wallet personnel (même adresse sur ce réseau). Sur une adresse de dépôt d'exchange spécifique au {declaredAsset}, vérifiez que {recvCurrency} est accepté.</p>
                  </div>
                </div>
              )}

              {submitError && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-50 p-4 text-[13px] text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div><p className="font-semibold">Transfert non effectué</p><p className="mt-0.5 text-danger/80">{submitError} Aucun montant n'a été débité. Modifiez le montant et réessayez.</p></div>
                </div>
              )}

              <p className="mt-5 text-[12px] text-ink-mute">En confirmant, vous autorisez l'envoi de ce paiement aux conditions affichées. <DemoTag className="ml-1 align-middle" /></p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="lg" icon={ArrowLeft} onClick={() => goStep(0)} disabled={submitting}>Retour</Button>
                <Button size="lg" icon={Lock} loading={submitting} onClick={confirm}>
                  {submitting ? 'Envoi en cours…' : `Confirmer l'envoi de ${money(q.amount, form.sendCurrency)}`}
                </Button>
              </div>
            </Card>
          )}
        </div>
        <div className="min-w-0"><SummaryPanel q={q} form={form} beneficiary={beneficiary} ch={channel} step={step} /></div>
      </div>
    </div>
  )
}
