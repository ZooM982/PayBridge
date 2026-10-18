import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Avatar, Flag } from './ui/Misc'
import { StatusBadge } from './ui/StatusBadge'
import { money, date, country, cn } from '../lib/format'

const chainLabel = (chain) => (chain ? chain.charAt(0).toUpperCase() + chain.slice(1) : null)

/**
 * Ligne compacte d'une opération (listes mobile / dashboard).
 * - envoi (`direction` absent ou « out ») : le clic ouvre la page détail ;
 * - réception (`direction: 'in'`) : montant en vert, pas de page détail.
 */
export function TxRow({ tx, onClick }) {
  const inbound = tx.direction === 'in'
  const c = country(tx.toCountry)
  const who = tx.beneficiaryName ?? tx.beneficiary?.name ?? null
  const clickable = Boolean(onClick) && !inbound
  const Wrapper = clickable ? 'button' : 'div'

  return (
    <Wrapper
      onClick={clickable ? onClick : undefined}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors sm:gap-4',
        clickable && 'hover:bg-mist',
      )}
    >
      <div className="relative">
        {inbound ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <ArrowDownLeft className="size-5" />
          </span>
        ) : (
          <>
            <Avatar name={who} />
            <Flag code={tx.toCountry} className="absolute -bottom-1 -right-1 text-[14px]" />
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">
          {inbound ? `Reçu · ${tx.currency || 'Dépôt'}` : (who ?? 'Transfert')}
        </p>
        <p className="truncate text-[12px] text-ink-mute">
          {inbound
            ? `${chainLabel(tx.chain) ?? 'Compte virtuel'} · ${date(tx.createdAt, true)}`
            : [c?.name ?? tx.toCountry, tx.provider].filter(Boolean).join(' · ') + ` · ${date(tx.createdAt, true)}`}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('tabular text-[14px] font-semibold', inbound ? 'text-emerald-600' : 'text-ink')}>
          {inbound ? '+' : '−'}{money(tx.amount, inbound ? tx.currency : tx.sendCurrency)}
        </p>
        <div className="mt-1 flex justify-end"><StatusBadge status={tx.status} className="!px-2 !py-0.5 !text-[11px]" /></div>
      </div>
    </Wrapper>
  )
}

export function SeeAll({ to, children = 'Tout voir' }) {
  const nav = useNavigate()
  return (
    <button onClick={() => nav(to)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink">
      {children}<ArrowUpRight className="size-3.5" />
    </button>
  )
}
