import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ArrowDownLeft, TrendingUp, CheckCircle2, Clock, XCircle, Wallet, Eye, EyeOff, AlertTriangle, RefreshCw, Send,
} from 'lucide-react'
import { useStore } from '../context/AppStore'
import { useReveal, useCountUp } from '../hooks/useMotion'
import { api } from '../services/api'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton, Avatar, DemoTag, Flag, EmptyState } from '../components/ui/Misc'
import { QRReceive } from '../components/ui/QRReceive'
import { AreaChart } from '../components/charts/AreaChart'
import { TxRow, SeeAll } from '../components/TxParts'
import { PageHeader } from '../components/layout/PageHeader'
import { money, compact, toUsd, cn } from '../lib/format'
import { COUNTRIES, DEMO_USER } from '../data/demo'

const RANGES = { '7j': 7, '14j': 14, '30j': 30 }

function BalanceCard({ wallet, loading, onReceive }) {
  const nav = useNavigate()
  const [hidden, setHidden] = useState(false)
  const balanceText = useCountUp(wallet?.balance, (v) => money(v, 'USD'), [hidden])
  return (
    <div data-reveal className="relative overflow-hidden rounded-[var(--radius-card)] bg-night p-6 text-white sm:p-7 lg:col-span-2">
      <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-volt/20 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[13px] font-medium text-white/60"><Wallet className="size-4" /> Solde disponible</p>
          <button onClick={() => setHidden((h) => !h)} aria-label={hidden ? 'Afficher le solde' : 'Masquer le solde'} className="grid size-9 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white">
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {loading ? <Skeleton className="mt-3 h-11 w-60 !bg-white/10" /> : (
          <p className="tabular mt-2 text-[38px] font-bold tracking-tight sm:text-[44px]">
            {hidden ? '•••••• $' : balanceText}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-white/50">{DEMO_USER.business}</p>
          {wallet?.wallets?.map((w) => (
            <span key={w.currency} className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', w.balance > 0 ? 'bg-volt/20 text-volt' : 'bg-white/10 text-white/60')}>
              {w.balance.toLocaleString('fr-FR', { minimumFractionDigits: w.currency === 'BTC' ? 4 : 2 })} {w.currency}
            </span>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Button size="lg" icon={Plus} onClick={() => nav('/transferts')}>Nouveau transfert</Button>
          <Button size="lg" variant="ghost" icon={ArrowDownLeft} onClick={onReceive} className="!text-white/80 hover:!bg-white/10 hover:!text-white">Recevoir</Button>
        </div>
      </div>
    </div>
  )
}

/** Montant animé (compteur) isolé : ses re-rendus ne touchent pas le reste du Dashboard. */
function AnimatedAmount({ value, loading }) {
  const text = useCountUp(loading ? null : value, (v) => money(v, 'USD'))
  if (loading) return <Skeleton className="mt-3 h-10 w-44" />
  return <p className="tabular mt-2 text-[32px] font-bold tracking-tight">{text}</p>
}

function KPI({ icon: Icon, label, value, tone, loading, sub }) {
  const tones = { volt: 'bg-volt-50 text-volt-600', warn: 'bg-warn-50 text-[#B7770F]', danger: 'bg-danger-50 text-danger' }
  return (
    <Card data-reveal className="flex items-center gap-4 p-5">
      <span className={cn('grid size-11 place-items-center rounded-xl', tones[tone])}><Icon className="size-5" /></span>
      <div>
        <p className="text-[13px] text-ink-soft">{label}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className="tabular text-[24px] font-bold leading-tight">{value}</p>}
      </div>
      {sub && <span className="ml-auto self-start text-[11px] font-medium text-ink-mute">{sub}</span>}
    </Card>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const { wallet, transfers, deposits, beneficiaries, stats, loading, error, reload } = useStore()
  const [range, setRange] = useState('14j')
  const [receiveOpen, setReceiveOpen] = useState(false)
  const scope = useReveal([loading])

  // Taux du jour — endpoint Bitnob « List Exchange Rates » (GET /api/rates en mode API).
  const [rates, setRates] = useState(null)
  useEffect(() => { api.getRates().then((r) => setRates(r.rates ?? null)).catch(() => setRates(null)) }, [])

  // Corridors réels calculés sur les transferts (au lieu des barres statiques).
  const corridors = useMemo(() => {
    if (!transfers.length) return []
    const counts = new Map()
    for (const t of transfers) {
      const key = `${t.fromCountry}-${t.toCountry}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const total = transfers.length
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, n]) => {
        const [a, b] = key.split('-')
        return { a, b, p: Math.max(1, Math.round((n / total) * 100)) }
      })
  }, [transfers])

  /** Courbe « Volume des transactions » : envois + reçus (USD), sur les 7/14/30 derniers jours. */
  const series = useMemo(() => {
    const days = RANGES[range]
    const end = new Date()
    const ops = [
      ...transfers.map((t) => ({ status: t.status, createdAt: t.createdAt, amount: t.amount, currency: t.sendCurrency })),
      ...deposits.map((d) => ({ status: d.status, createdAt: d.createdAt, amount: d.amount, currency: d.currency })),
    ]
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(end); d.setUTCDate(end.getUTCDate() - (days - 1 - i))
      const key = d.toISOString().slice(0, 10)
      const value = ops
        .filter((o) => o.status !== 'failed' && String(o.createdAt ?? '').slice(0, 10) === key)
        .reduce((a, o) => a + toUsd(o.amount, o.currency), 0)
      return { label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), value: Math.round(value * 100) / 100 }
    })
  }, [transfers, deposits, range])

  /** Envois + réceptions fusionnés, du plus récent au plus ancien (activité réelle). */
  const recent = useMemo(() => {
    const out = transfers.map((t) => ({ ...t, direction: 'out' }))
    const inbound = deposits.map((d) => ({ ...d, direction: 'in' }))
    return [...out, ...inbound].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
  }, [transfers, deposits])

  if (error) return (
    <Card className="mx-auto max-w-lg">
      <EmptyState icon={AlertTriangle} title="Impossible de charger vos données" text={error}
        action={<Button variant="dark" icon={RefreshCw} onClick={reload}>Réessayer</Button>} />
    </Card>
  )

  const firstName = DEMO_USER.name.split(' ')[0]
  return (
    <div ref={scope}>
      <PageHeader eyebrow="Samedi 17 octobre" title={`Bonjour, ${firstName} 👋`} subtitle="Voici l'activité de vos paiements transfrontaliers." />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <BalanceCard wallet={wallet} loading={loading} onReceive={() => setReceiveOpen(true)} />
        <Card data-reveal className="flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink-soft"><TrendingUp className="size-4" /> Volume total échangé</p>
            <DemoTag />
          </div>
          <AnimatedAmount value={stats.volume} loading={loading} />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-mute">
            <span className="tabular font-semibold text-ink-soft">{money(stats.sent, 'USD')}</span> envoyés
            <span aria-hidden>·</span>
            <span className="tabular font-semibold text-emerald-600">+{money(stats.received, 'USD')}</span> reçus
          </div>
          <div className="mt-4 flex items-center gap-2 text-[13px]">
            <span className="rounded-md bg-volt-50 px-1.5 py-0.5 font-semibold text-volt-600">+18,4 %</span>
            <span className="text-ink-mute">vs. 30 jours précédents</span>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
            {[['Transferts', transfers.length], ['Reçus', deposits.length], ['Corridors', new Set(transfers.map((t) => t.toCountry)).size], ['Bénéf.', beneficiaries.length]].map(([l, v]) => (
              <div key={l}><p className="tabular text-[17px] font-bold">{loading ? '–' : v}</p><p className="text-[11px] text-ink-mute">{l}</p></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:mt-5 lg:gap-5">
        <KPI icon={CheckCircle2} label="Réussis" value={stats.completed} tone="volt" loading={loading} />
        <KPI icon={Clock} label="En attente" value={stats.pending} tone="warn" loading={loading} sub={stats.pending ? 'en cours' : null} />
        <KPI icon={XCircle} label="Échoués" value={stats.failed} tone="danger" loading={loading} />
      </div>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-5 lg:gap-5">
        <Card data-reveal className="lg:col-span-3">
          <CardHeader title="Volume des transactions" subtitle={`Montants envoyés et reçus (USD) · ${range}`}
            action={
              <div className="flex rounded-xl bg-mist p-1" role="tablist" aria-label="Période">
                {Object.keys(RANGES).map((r) => (
                  <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)}
                    className={cn('rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all', range === r ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink')}>{r}</button>
                ))}
              </div>
            } />
          <div className="px-3 pb-4 pt-2 sm:px-5">
            {loading ? <Skeleton className="m-2 h-[220px]" /> : <AreaChart data={series} key={range} height={280} />}
          </div>
        </Card>

        <Card data-reveal className="lg:col-span-2">
          <CardHeader title="Envoi rapide" subtitle="Vos bénéficiaires fréquents" action={<SeeAll to="/beneficiaires" />} />
          <div className="grid grid-cols-4 gap-2 px-4 pb-2 pt-4 sm:px-5">
            {(loading ? Array(4).fill(null) : beneficiaries.slice(0, 4)).map((b, i) => b ? (
              <button key={b.id} onClick={() => nav(`/transferts?beneficiary=${b.id}`)} className="group flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-mist">
                <div className="relative transition-transform group-hover:-translate-y-0.5">
                  <Avatar name={b.name} size="lg" /><Flag code={b.country} className="absolute -bottom-1 -right-1 text-[15px]" />
                </div>
                <span className="w-full truncate text-center text-[12px] font-medium">{b.name.split(' ')[0]}</span>
              </button>
            ) : <Skeleton key={i} className="mx-auto size-12 rounded-full" />)}
          </div>
          <div className="mx-5 mb-5 mt-2 rounded-2xl bg-mist p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-mute">Corridors principaux</p>
            <div className="mt-3 space-y-2.5">
              {loading ? ['·', '·', '·'].map((_, i) => <Skeleton key={i} className="h-4 rounded-full" />) : corridors.length ? corridors.map(({ a, b, p }) => (
                <div key={b} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[72px] shrink-0 whitespace-nowrap"><Flag code={a} className="text-[15px]" /> → <Flag code={b} className="text-[15px]" /></span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-volt" style={{ width: `${p}%` }} /></div>
                  <span className="tabular w-9 text-right font-semibold">{p}%</span>
                </div>
              )) : <p className="text-[12px] text-ink-mute">Aucun corridor pour l'instant.</p>}
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-mute">Taux en direct · 1 USD =</p>
              {loading || !rates ? (
                <div className="mt-2 flex gap-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-24" /></div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
                  {['NGN', 'GHS', 'KES', 'XOF'].filter((c) => rates[c] != null).map((c) => {
                    const flag = COUNTRIES.find((x) => x.currency === c)?.flag ?? ''
                    return (
                      <span key={c} className="tabular flex items-center gap-1.5 text-ink-soft">
                        <span aria-hidden className="text-[14px]">{flag}</span>
                        <span className="font-semibold text-ink">{rates[c].toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</span>
                        <span className="text-ink-mute">{c}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card data-reveal className="mt-4 lg:mt-5">
        <CardHeader title="Opérations récentes" subtitle="Envoyés et reçus — cliquez sur un envoi pour voir le détail" action={<SeeAll to="/historique" />} />
        <div className="p-2 sm:p-3">
          {loading ? Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3"><Skeleton className="size-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></div><Skeleton className="h-5 w-20" /></div>
          )) : recent.length === 0 ? (
            <EmptyState icon={Send} title="Aucune opération pour l'instant" text="Votre premier envoi apparaîtra ici." action={<Button icon={Plus} onClick={() => nav('/transferts')}>Nouveau transfert</Button>} />
          ) : recent.slice(0, 6).map((t) => <TxRow key={t.id} tx={t} onClick={() => nav(`/transferts/${t.id}`)} />)}
        </div>
      </Card>

      <p className="mt-6 text-center text-[12px] text-ink-mute">
        {compact(recent.length)} opérations affichées · données de démonstration, aucune transaction réelle.
      </p>
      <QRReceive open={receiveOpen} onClose={() => setReceiveOpen(false)} />
    </div>
  )
}
