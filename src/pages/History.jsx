import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Download, SearchX, ChevronLeft, ChevronRight, ArrowDownLeft, X } from 'lucide-react'
import { useStore } from '../context/AppStore'
import { useReveal } from '../hooks/useMotion'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Field'
import { StatusBadge, STATUS } from '../components/ui/StatusBadge'
import { Avatar, EmptyState, Flag, Skeleton, DemoTag } from '../components/ui/Misc'
import { TxRow } from '../components/TxParts'
import { PageHeader } from '../components/layout/PageHeader'
import { COUNTRIES } from '../data/demo'
import { money, date, country, cn } from '../lib/format'

const PAGE = 10
const PERIODS = { all: 'Toutes dates', 7: '7 jours', 30: '30 jours', 90: '90 jours' }
const NOW = new Date('2026-10-17T23:59:59Z').getTime()

const chainLabel = (chain) => (chain ? chain.charAt(0).toUpperCase() + chain.slice(1) : null)
const shortAddress = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
const DIRECTIONS = [['all', 'Tous'], ['out', 'Envoyés'], ['in', 'Reçus']]

export default function History() {
  const { transfers, deposits, loading } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [dir, setDir] = useState('all')
  const [status, setStatus] = useState('all')
  const [ctry, setCtry] = useState('all')
  const [period, setPeriod] = useState('all')
  const [page, setPage] = useState(1)
  const scope = useReveal([loading])

  /** Envois + réceptions fusionnés, du plus récent au plus ancien. */
  const ops = useMemo(() => {
    const out = transfers.map((t) => ({ ...t, direction: t.direction ?? 'out' }))
    const inbound = deposits.map((d) => ({ ...d, direction: 'in' }))
    return [...out, ...inbound].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
  }, [transfers, deposits])

  const filtered = useMemo(() => ops.filter((t) => {
    const s = q.trim().toLowerCase()
    if (s) {
      const hay = `${t.reference ?? ''} ${t.beneficiaryName ?? ''} ${t.provider ?? ''} ${t.chain ?? ''} ${t.address ?? ''} ${t.currency ?? ''}`.toLowerCase()
      if (!hay.includes(s)) return false
    }
    if (dir !== 'all' && t.direction !== dir) return false
    if (status !== 'all' && (status === 'pending' ? !['pending', 'processing'].includes(t.status) : t.status !== status)) return false
    if (ctry !== 'all' && t.toCountry !== ctry) return false
    if (period !== 'all' && NOW - new Date(t.createdAt).getTime() > Number(period) * 864e5) return false
    return true
  }), [ops, q, dir, status, ctry, period])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE)
  const count = (s) => {
    const base = dir === 'all' ? ops : ops.filter((t) => t.direction === dir)
    return s === 'all' ? base.length : base.filter((t) => s === 'pending' ? ['pending', 'processing'].includes(t.status) : t.status === s).length
  }
  const active = q || dir !== 'all' || status !== 'all' || ctry !== 'all' || period !== 'all'
  const reset = () => { setQ(''); setDir('all'); setStatus('all'); setCtry('all'); setPeriod('all'); setPage(1); setParams({}) }
  const upd = (fn) => (v) => { fn(v); setPage(1) }

  const exportCsv = () => {
    const head = 'sens,reference,date,contrepartie,pays,montant,devise,frais,montant_recu,devise_recue,statut,demo'
    const body = filtered.map((t) => {
      const inbound = t.direction === 'in'
      const contre = inbound ? (t.chain ?? 'compte virtuel') : `"${t.beneficiaryName ?? ''}"`
      return [inbound ? 'recu' : 'envoye', t.reference, t.createdAt, contre, t.toCountry ?? '', t.amount,
        inbound ? t.currency : t.sendCurrency, t.fee ?? '', t.received ?? '', t.receiveCurrency ?? '', t.status, t.demo ?? ''].join(',')
    })
    const url = URL.createObjectURL(new Blob([[head, ...body].join('\n')], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'paybridge-historique-demo.csv' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div ref={scope}>
      <PageHeader eyebrow="Historique" title="Toutes vos transactions" subtitle="Recherchez, filtrez et consultez vos envois comme vos paiements reçus."
        action={<Button variant="outline" icon={Download} onClick={exportCsv} disabled={!filtered.length}>Exporter CSV</Button>} />

      <Card data-reveal className="mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input value={q} onChange={(e) => upd(setQ)(e.target.value)} aria-label="Rechercher"
              placeholder="Référence, bénéficiaire, adresse…" className="field pl-11" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[420px]">
            <Select aria-label="Période" value={period} onChange={(e) => upd(setPeriod)(e.target.value)}>
              {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select aria-label="Pays" value={ctry} onChange={(e) => upd(setCtry)(e.target.value)}>
              <option value="all">Tous les pays</option>
              {COUNTRIES.filter((c) => transfers.some((t) => t.toCountry === c.code)).map((c) => <option key={c.code} value={c.code}>{c.flag}  {c.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-line bg-white p-0.5" role="group" aria-label="Sens de l'opération">
            {DIRECTIONS.map(([k, label]) => (
              <button key={k} onClick={() => upd(setDir)(k)} aria-pressed={dir === k}
                className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                  dir === k ? 'bg-night text-white' : 'text-ink-soft hover:text-ink')}>
                {label}
              </button>
            ))}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          {['all', 'completed', 'pending', 'failed'].map((s) => (
            <button key={s} onClick={() => upd(setStatus)(s)} aria-pressed={status === s}
              className={cn('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                status === s ? 'border-night bg-night text-white' : 'border-line bg-white text-ink-soft hover:border-ink-mute')}>
              {s === 'all' ? 'Tous' : STATUS[s].label}
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', status === s ? 'bg-white/15' : 'bg-mist')}>{loading ? '·' : count(s)}</span>
            </button>
          ))}
          {active && <button onClick={reset} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink"><X className="size-3.5" />Réinitialiser</button>}
        </div>
      </Card>

      <Card data-reveal className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !filtered.length ? (
          <EmptyState icon={SearchX} title="Aucune transaction trouvée" text="Essayez d'élargir la période ou de modifier vos filtres."
            action={<Button variant="outline" onClick={reset}>Réinitialiser les filtres</Button>} />
        ) : (<>
          {/* Desktop : tableau */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[14px]">
              <thead className="border-b border-line bg-mist/60 text-[12px] font-semibold uppercase tracking-wider text-ink-mute">
                <tr>{['Référence', 'Date', 'Contrepartie', 'Montant', 'Devise', 'Statut'].map((h, i) =>
                  <th key={h} className={cn('px-5 py-3.5 font-semibold', i === 3 && 'text-right')}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => {
                  const inbound = t.direction === 'in'
                  const open = () => { if (!inbound) nav(`/transferts/${t.id}`) }
                  return (
                    <tr key={t.id} tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}
                      className={cn('transition-colors focus:outline-none',
                        inbound ? 'hover:bg-emerald-50/40 focus:bg-emerald-50/40' : 'cursor-pointer hover:bg-mist/70 focus:bg-mist/70')}>
                      <td className="px-5 py-4"><span className="font-mono text-[13px] font-semibold">{t.reference ?? '—'}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 text-ink-soft">{date(t.createdAt, true)}</td>
                      <td className="px-5 py-4">
                        {inbound ? (
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><ArrowDownLeft className="size-4" /></span>
                            <div>
                              <p className="font-semibold">Reçu · {t.currency}</p>
                              <p className="text-[12px] text-ink-mute">{chainLabel(t.chain) ?? 'Compte virtuel'}{t.address ? ` · ${shortAddress(t.address)}` : ''}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3"><Avatar name={t.beneficiaryName ?? t.beneficiary?.name} size="sm" />
                            <div><p className="font-semibold">{t.beneficiaryName ?? t.beneficiary?.name ?? 'Transfert'}</p><p className="text-[12px] text-ink-mute"><Flag code={t.toCountry} className="text-[13px]" /> {country(t.toCountry)?.name ?? t.toCountry ?? '—'}</p></div>
                          </div>
                        )}
                      </td>
                      <td className="tabular px-5 py-4 text-right">
                        {inbound ? (
                          <p className="font-semibold text-emerald-600">+{money(t.amount, t.currency)}</p>
                        ) : (<>
                          <p className="font-semibold">{money(t.amount, t.sendCurrency)}</p>
                          {t.received != null && <p className="text-[12px] text-ink-mute">→ {money(t.received, t.receiveCurrency)}</p>}
                        </>)}
                      </td>
                      <td className="px-5 py-4">
                        {inbound
                          ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-700">{t.currency}{t.chain ? ` · ${chainLabel(t.chain)}` : ''}</span>
                          : <span className="rounded-md bg-mist px-2 py-1 text-[12px] font-semibold">{t.sendCurrency}{t.receiveCurrency ? ` → ${t.receiveCurrency}` : ''}</span>}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile : liste */}
          <div className="p-2 md:hidden">{rows.map((t) => <TxRow key={t.id} tx={t} onClick={() => nav(`/transferts/${t.id}`)} />)}</div>

          <div className="flex items-center justify-between border-t border-line px-5 py-3.5 text-[13px]">
            <span className="text-ink-mute">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} sur {filtered.length} <DemoTag className="ml-1 align-middle" /></span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button>
              <span className="tabular px-2 font-semibold">{page} / {pages}</span>
              <Button variant="ghost" size="icon" aria-label="Page suivante" disabled={page === pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </>)}
      </Card>
    </div>
  )
}
