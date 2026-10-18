import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Copy, Plus, History, Printer, SearchX, Share2, FlaskConical } from 'lucide-react'
import { useStore } from '../context/AppStore'
import { api } from '../services/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Avatar, DemoTag, EmptyState, Flag, PoweredBy } from '../components/ui/Misc'
import { Timeline } from '../components/Timeline'
import { REASON_LABELS } from '../data/demo'
import { money, date, country, cn } from '../lib/format'

const HEAD = {
  pending: { title: 'Transfert créé', text: 'Votre demande est enregistrée et va être traitée.' },
  processing: { title: 'Transfert en cours', text: 'Le paiement est en route vers le bénéficiaire.' },
  completed: { title: 'Transfert confirmé', text: 'Les fonds sont disponibles pour le bénéficiaire.' },
  failed: { title: 'Transfert échoué', text: 'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité.' },
}

function StatusHero({ status }) {
  const ref = useRef()
  const done = status === 'completed', failed = status === 'failed'
  useGSAP(() => {
    gsap.fromTo('[data-disc]', { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(1.8)' })
    // `[data-mark]` n'existe qu'aux états terminaux — sinon GSAP râle sur une cible absente.
    if (done || failed) gsap.fromTo('[data-mark]', { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.5, delay: 0.3, ease: 'power2.out' })
    if (done) gsap.fromTo('[data-burst] span', { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, x: (i) => Math.cos(i) * 70, y: (i) => Math.sin(i) * 70, duration: 0.9, stagger: 0.01, ease: 'power3.out' })
  }, { scope: ref, dependencies: [status] })

  return (
    <div ref={ref} className="relative mx-auto grid size-24 place-items-center">
      <span data-burst aria-hidden className="absolute inset-0 grid place-items-center">
        {Array.from({ length: 12 }, (_, i) => <span key={i} className="absolute size-2 rounded-full bg-volt" />)}
      </span>
      {!done && !failed && <span className="absolute inset-0 animate-ping rounded-full bg-volt/20" />}
      <span data-disc className={cn('relative grid size-24 place-items-center rounded-full', failed ? 'bg-danger' : done ? 'bg-volt' : 'bg-night')}>
        <svg viewBox="0 0 24 24" className="size-11" fill="none" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" stroke={done ? '#0B1220' : failed ? '#fff' : '#00D68F'}>
          {failed ? <path data-mark d="M7 7l10 10M17 7L7 17" strokeDasharray="40" />
            : done ? <path data-mark d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="40" />
            : <path d="M12 4a8 8 0 1 1-8 8" className="origin-center animate-spin" />}
        </svg>
      </span>
    </div>
  )
}

export default function Confirmation() {
  const { id } = useParams()
  const nav = useNavigate()
  const { transfers, toast, loading, reload } = useStore()
  const [simulating, setSimulating] = useState(false)
  const tx = transfers.find((t) => t.id === id)
  const scope = useRef()
  useGSAP(() => { if (tx) gsap.from('[data-reveal]', { y: 20, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'all' }) }, { scope, dependencies: [!!tx] })

  if (loading) return <div className="skeleton mx-auto h-[520px] max-w-2xl rounded-3xl" />
  if (!tx) return (
    <Card className="mx-auto max-w-lg">
      <EmptyState icon={SearchX} title="Transfert introuvable" text="Cette référence n'existe pas ou n'est plus disponible."
        action={<Button variant="dark" icon={History} onClick={() => nav('/historique')}>Voir l'historique</Button>} />
    </Card>
  )

  const h = HEAD[tx.status]
  const reasonKey = tx.paymentReason
  const copy = () => { navigator.clipboard?.writeText(tx.reference); toast({ title: 'Référence copiée', text: tx.reference, tone: 'info' }) }
  const simulateDeposit = async () => {
    setSimulating(true)
    try {
      await api.simulateTransferDeposit(tx.id)
      await reload()
      toast({ title: 'Dépôt sandbox simulé', text: 'Le payout est maintenant en cours de traitement.' })
    } catch (e) { toast({ title: 'Simulation impossible', text: e.message, tone: 'error' }) } finally { setSimulating(false) }
  }
  return (
    <div ref={scope} className="mx-auto max-w-2xl">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-volt-50/70 to-white px-6 pb-6 pt-10 text-center sm:px-10">
          <div data-reveal><StatusHero status={tx.status} /></div>
          <h1 data-reveal className="mt-6 text-[24px] font-bold tracking-tight sm:text-[28px]">{h.title}</h1>
          <p data-reveal className="mt-1 text-[14px] text-ink-soft">{h.text}</p>
          <div data-reveal className="mt-4 flex items-center justify-center gap-2"><StatusBadge status={tx.status} />{tx.demo && <DemoTag />}</div>
        </div>

        <div className="px-6 py-7 sm:px-10" data-reveal>
          <Timeline status={tx.status} createdAt={tx.createdAt} stamps={tx} horizontal />
        </div>

        <div className="border-t border-line px-6 py-6 sm:px-10" data-reveal>
          <div className="flex items-center gap-3">
            <Avatar name={tx.beneficiaryName} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tx.beneficiaryName}</p>
              <p className="text-[13px] text-ink-mute"><Flag code={tx.toCountry} className="text-[14px]" /> {country(tx.toCountry).name} · {tx.provider}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Montant envoyé', money(tx.amount, tx.sendCurrency)],
              ['Frais', money(tx.fee, tx.sendCurrency)],
              ['Montant reçu', money(tx.received, tx.receiveCurrency), true],
              ['Taux appliqué', `1 ${tx.sendCurrency} = ${tx.rate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ${tx.receiveCurrency}`],
              ['Motif', REASON_LABELS[reasonKey] ?? reasonKey ?? '—'],
              ['Date', date(tx.createdAt, true)],
            ].map(([k, v, hi]) => (
              <div key={k} className={cn('rounded-2xl p-4', hi ? 'bg-night text-white' : 'bg-mist')}>
                <dt className={cn('text-[12px]', hi ? 'text-white/55' : 'text-ink-mute')}>{k}</dt>
                <dd className={cn('tabular mt-1 text-[15px] font-bold sm:text-[17px]', hi && 'text-volt')}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-mist p-4">
              <dt className="text-[12px] text-ink-mute">Débité de votre solde</dt>
              <dd className="tabular mt-1 text-[15px] font-bold">{money(tx.amount, tx.sendCurrency)}</dd>
            </div>
            <div className="rounded-2xl bg-mist p-4">
              <dt className="text-[12px] text-ink-mute">Canal de réception</dt>
              <dd className="mt-1 text-[15px] font-bold">{tx.provider} <span className="text-[12px] font-medium text-ink-mute">({{ mobile: 'Mobile Money', bank: 'Banque', crypto: 'Crypto', lightning: 'Lightning' }[tx.method] ?? tx.method})</span></dd>
            </div>
          </div>
          <button onClick={copy} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-left hover:border-ink-mute">
            <span><span className="block text-[12px] text-ink-mute">Référence</span><span className="font-mono text-[15px] font-semibold">{tx.reference}</span></span>
            <Copy className="size-4 text-ink-mute" />
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-line bg-mist/50 px-6 py-5 sm:flex-row sm:px-10" data-reveal>
          {tx.fundingMode === 'onchain' && tx.quoteId && tx.status === 'pending' && <Button icon={FlaskConical} loading={simulating} onClick={simulateDeposit} className="sm:flex-[1.4]">Simuler le dépôt sandbox</Button>}
          <Button variant="outline" icon={Printer} onClick={() => window.print()} className="sm:flex-1">Reçu</Button>
          <Button variant="outline" icon={Share2} onClick={copy} className="sm:flex-1">Partager</Button>
          <Button icon={Plus} onClick={() => nav('/transferts')} className="sm:flex-[1.4]">Nouveau transfert</Button>
        </div>
      </Card>
      <div className="mt-5 flex items-center justify-between px-1">
        <button onClick={() => nav('/historique')} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink"><History className="size-4" />Historique</button>
        <PoweredBy />
      </div>
    </div>
  )
}
