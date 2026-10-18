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

/** Devis : montant envoyé → frais, taux, montant reçu. Reproduit ce que renverra l'API. */
export function quote({ amount, sendCurrency, receiveCurrency }) {
  const a = Number(amount) || 0
  const toUsd = 1 / DEMO_RATES_USD[sendCurrency]
  const rate = DEMO_RATES_USD[receiveCurrency] / DEMO_RATES_USD[sendCurrency]
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

export const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export const cn = (...c) => c.filter(Boolean).join(' ')
