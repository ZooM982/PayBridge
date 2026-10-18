import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, Flag } from './ui/Misc'
import { StatusBadge } from './ui/StatusBadge'
import { money, date, country } from '../lib/format'

/** Ligne compacte d'un transfert (listes mobile / dashboard). Le clic ouvre la page détail. */
export function TxRow({ tx, onClick }) {
  const c = country(tx.toCountry)
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-mist sm:gap-4">
      <div className="relative">
        <Avatar name={tx.beneficiaryName} />
        <Flag code={tx.toCountry} className="absolute -bottom-1 -right-1 text-[14px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{tx.beneficiaryName}</p>
        <p className="truncate text-[12px] text-ink-mute">{c?.name} · {tx.provider} · {date(tx.createdAt, true)}</p>
      </div>
      <div className="text-right">
        <p className="tabular text-[14px] font-semibold text-ink">−{money(tx.amount, tx.sendCurrency)}</p>
        <div className="mt-1 flex justify-end"><StatusBadge status={tx.status} className="!px-2 !py-0.5 !text-[11px]" /></div>
      </div>
    </button>
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
