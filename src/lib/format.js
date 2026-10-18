import { CURRENCIES, COUNTRIES, DEMO_RATES_USD, DEMO_FEES } from '../data/demo'

export function money(value, currency = 'USD') {
  const c = CURRENCIES[currency] ?? { symbol: currency, decimals: 2 }
  const n = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(value ?? 0)
  return `${n} ${c.symbol}`
}

export function compact(value) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function date(iso, withTime = false) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: withTime ? undefined : 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso))
}

export const country = (code) => COUNTRIES.find((c) => c.code === code)

/** Pays associé à une devise (GHS → GH, XOF → 1er pays de la zone) — heuristique
 *  utilisée quand le backend ne renvoie que la devise cible d'un payout. */
export const countryOfCurrency = (currency) => COUNTRIES.find((c) => c.currency === currency)

/**
 * Statut Bitnob (SETTLED, QUOTE, PENDING…) ou forme libre → statut du front
 * (pending | processing | completed | failed). Tolère l'inconnu → `pending`.
 */
const STATUS_ALIASES = {
  settled: 'completed', completed: 'completed', success: 'completed', successful: 'completed',
  failed: 'failed', expired: 'failed', cancelled: 'failed', canceled: 'failed', reversed: 'failed',
  initiated: 'processing', processing: 'processing', in_progress: 'processing', pending: 'pending',
  quote: 'pending', created: 'pending',
}
export const frontStatus = (status) => STATUS_ALIASES[String(status ?? '').toLowerCase()] ?? 'pending'

/** Contre-valeur USD d'un montant (taux de démo ; stablecoins et USD ≈ 1). */
export const toUsd = (amount, currency = 'USD') => (Number(amount) || 0) / (DEMO_RATES_USD[currency] ?? 1)

/** Devis : montant envoyé → frais, taux, montant reçu. Reproduit ce que renverra l'API. */
export function quote({ amount, sendCurrency = 'USD', receiveCurrency = 'USD' }) {
  const a = Number(amount) || 0
  const sendRate = DEMO_RATES_USD[sendCurrency] ?? (['USD', 'USDC', 'USDT'].includes(sendCurrency) ? 1 : 1)
  const recvRate = DEMO_RATES_USD[receiveCurrency] ?? (['USD', 'USDC', 'USDT'].includes(receiveCurrency) ? 1 : 1)
  const toUsd = 1 / sendRate
  const rate = recvRate / sendRate
  const fee = a > 0 ? a * DEMO_FEES.percent + DEMO_FEES.fixedUsd / toUsd : 0
  const net = Math.max(a - fee, 0)
  return {
    amount: a,
    fee: round(fee, 2),
    rate,
    net: round(net, 2),
    received: round(net * rate, 2),
    total: a,
  }
}

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d

/** Initiales d'un nom ; tolère `null`/`undefined` (bénéficiaire inconnu). */
export const initials = (name) =>
  String(name ?? '').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '·'

export const cn = (...c) => c.filter(Boolean).join(' ')
