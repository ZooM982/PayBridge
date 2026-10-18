/**
 * ⚠️ DONNÉES DE DÉMONSTRATION — AUCUNE TRANSACTION RÉELLE.
 * Toutes les références commencent par "DEMO-" et les taux sont indicatifs.
 * Ces données seront remplacées par les réponses du backend Express (API Bitnob).
 */

export const IS_DEMO = (import.meta.env.VITE_DATA_MODE ?? 'demo') === 'demo'

export const COUNTRIES = [
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', currency: 'XOF' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', currency: 'XOF' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', currency: 'XAF' },
  { code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦', currency: 'ZAR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', currency: 'USD' },
]

export const CURRENCIES = {
  USD: { symbol: '$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  XOF: { symbol: 'FCFA', decimals: 0 },
  XAF: { symbol: 'FCFA', decimals: 0 },
  NGN: { symbol: '₦', decimals: 0 },
  GHS: { symbol: 'GH₵', decimals: 2 },
  KES: { symbol: 'KSh', decimals: 0 },
  ZAR: { symbol: 'R', decimals: 2 },
  // Canaux crypto (Addresses / Stablecoins) et Lightning (sats)
  USDT: { symbol: 'USDT', decimals: 2 },
  BTC: { symbol: 'BTC', decimals: 8 },
  SATS: { symbol: 'sats', decimals: 0 },
}

/** Taux indicatifs de démonstration (1 USD = x). Non contractuels. */
export const DEMO_RATES_USD = {
  USD: 1, EUR: 0.92, XOF: 603.5, XAF: 603.5, NGN: 1548, GHS: 15.4, KES: 129.2, ZAR: 18.1,
  USDT: 1, BTC: 0.00001639, SATS: 1639,
}

/** Grille de frais de démonstration : 0,9 % + 0,50 USD équivalent. */
export const DEMO_FEES = { percent: 0.009, fixedUsd: 0.5 }

export const PAYOUT_METHODS = {
  mobile: { label: 'Mobile Money', providers: ['Wave', 'Orange Money', 'MTN MoMo', 'M-Pesa'] },
  bank: { label: 'Compte bancaire', providers: ['Virement local'] },
}

/** Motifs de paiement — reprend `payment_reason` attendu par Bitnob (Initialize Payout). */
export const REASONS = [
  { value: 'family_support', label: 'Soutien familial' },
  { value: 'salary', label: 'Salaire' },
  { value: 'vendor_payment', label: 'Paiement fournisseur' },
  { value: 'school_fees', label: 'Frais de scolarité' },
  { value: 'freelance', label: 'Travail freelance' },
  { value: 'other', label: 'Autre' },
]
export const REASON_LABELS = Object.fromEntries(REASONS.map((r) => [r.value, r.label]))

/** Extraits des listes de banques (miroir de GET /api/payouts/banks/:countryCode). */
export const DEMO_BANKS = {
  GH: [{ code: 'GCB', name: 'GCB Bank' }, { code: 'ECB', name: 'Ecobank Ghana' }, { code: 'GTB', name: 'GTBank Ghana' }],
  NG: [{ code: '058', name: 'GTBank Nigeria' }, { code: '011', name: 'First Bank NG' }, { code: '050', name: 'Access Bank' }],
  SN: [{ code: 'BSIC', name: 'BSIC Sénégal' }, { code: 'BOA', name: 'BOA Sénégal' }, { code: 'ECOBANK', name: 'Ecobank Sénégal' }],
  KE: [{ code: 'KCB', name: 'KCB Bank' }, { code: 'EQTY', name: 'Equity Bank' }, { code: 'COOP', name: 'Co-op Bank' }],
  CI: [{ code: 'SGCI', name: 'SGBCI' }, { code: 'BOACI', name: 'BOA CI' }, { code: 'ECOBANK', name: 'Ecobank CI' }],
  CM: [{ code: 'AFRILAND', name: 'Afriland First Bank' }, { code: 'SGBC', name: 'Société Générale CM' }],
  ZA: [{ code: 'FNB', name: 'FNB' }, { code: 'STD', name: 'Standard Bank' }, { code: 'NED', name: 'Nedbank' }],
}
export const DEMO_BANKS_FALLBACK = [{ code: 'LOCAL', name: 'Banque locale' }]

/** Titulaire "vérifié" en démo (Account Lookup simulé, déterministe par numéro). */
export function demoHolder(accountNumber = '') {
  const names = ['Fatou Sow', 'Kofi Boateng', 'Chinedu Okafor', 'Mariama Camara', 'Amina Kimani', 'Emmanuel Ekané', 'Lerato Dlamini']
  let sum = 0
  for (const c of String(accountNumber)) sum += c.charCodeAt(0)
  return names[sum % names.length].toUpperCase()
}

export const DEMO_USER = {
  name: 'Awa Diallo',
  business: 'Studio Diallo (démo)',
  email: 'awa@demo.paybridge.africa',
  country: 'SN',
}

export const DEMO_WALLET = { balanceUsd: 12480.35, currency: 'USD' }

export const DEMO_BENEFICIARIES = [
  {
    id: 'b1', name: 'Kwame Mensah', country: 'GH', method: 'mobile', provider: 'MTN MoMo', account: '+233 24 ••• 4412',
    channels: [
      { id: 'c11', kind: 'mobile', isDefault: true, label: 'MTN MoMo', account: '2332441234412' },
      { id: 'c12', kind: 'crypto', asset: 'USDT', chain: 'TRON', account: 'TNn9Y2BMF7kZ1p5V4rd4KkzXQmE8UXpVvT' },
    ],
  },
  {
    id: 'b2', name: 'Chiamaka Obi', country: 'NG', method: 'bank', provider: 'GTBank Nigeria', account: '0123456789',
    channels: [
      { id: 'c21', kind: 'bank', isDefault: true, label: 'GTBank Nigeria', bankCode: '058', account: '0123456789' },
      { id: 'c22', kind: 'lightning', label: 'Facture BOLT11', account: 'lnbc1639s1p3jnwpnp59d3x2v8wqyr2f2z4x6mth0uhzuzv9kr7h30qcf2k7a37hs8dtqa2' },
    ],
  },
  {
    id: 'b3', name: 'Moussa Ndiaye', country: 'SN', method: 'mobile', provider: 'Wave', account: '+221 77 ••• 2208',
    channels: [
      { id: 'c31', kind: 'mobile', isDefault: true, label: 'Wave', account: '221771234208' },
    ],
  },
  {
    id: 'b4', name: 'Wanjiku Kamau', country: 'KE', method: 'mobile', provider: 'M-Pesa', account: '+254 7•• ••• 118',
    channels: [
      { id: 'c41', kind: 'mobile', isDefault: true, label: 'M-Pesa', account: '254712345118' },
      { id: 'c42', kind: 'bank', label: 'Equity Bank', bankCode: 'EQTY', account: '07801234567' },
      { id: 'c43', kind: 'crypto', asset: 'USDT', chain: 'TRON', account: 'TWd4Wr6vZGVq9bjXrWQsZAm7mJZKJB3fPT' },
    ],
  },
  {
    id: 'b5', name: 'Aïcha Koné', country: 'CI', method: 'mobile', provider: 'Orange Money', account: '+225 07 ••• 5560',
    channels: [
      { id: 'c51', kind: 'mobile', isDefault: true, label: 'Orange Money', account: '2250712345560' },
    ],
  },
  {
    id: 'b6', name: 'Jean-Paul Ekané', country: 'CM', method: 'bank', provider: 'Afriland', account: '1234567890',
    channels: [
      { id: 'c61', kind: 'bank', isDefault: true, label: 'Afriland First Bank', bankCode: 'AFRILAND', account: '1234567890' },
    ],
  },
  {
    id: 'b7', name: 'Thandi Nkosi', country: 'ZA', method: 'bank', provider: 'FNB', account: 'FNB •••• 3304',
    channels: [
      { id: 'c71', kind: 'bank', isDefault: true, label: 'FNB', bankCode: 'FNB', account: '62834123456' },
      { id: 'c72', kind: 'lightning', label: 'Facture BOLT11', account: 'lnbc819s1p3jnwpnme5s7v8wqyr2f2z4x6mth0uhzuzv9kr7h30qcf2k7a37hs9aa9410' },
    ],
  },
]

// Générateur pseudo-aléatoire déterministe → la démo est identique à chaque chargement
function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function buildTransactions() {
  const r = rng(42)
  const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'pending', 'processing', 'failed']
  const now = new Date('2026-10-17T12:00:00Z').getTime()
  let t = now
  return Array.from({ length: 110 }, (_, i) => {
    const b = DEMO_BENEFICIARIES[Math.floor(r() * DEMO_BENEFICIARIES.length)]
    const country = COUNTRIES.find((c) => c.code === b.country)
    const amountUsd = Math.round((40 + r() * r() * 1600) * 100) / 100
    const fee = Math.round((amountUsd * DEMO_FEES.percent + DEMO_FEES.fixedUsd) * 100) / 100
    const rate = DEMO_RATES_USD[country.currency]
    // Seules les opérations très récentes peuvent être encore en cours
    const pool = i < 6 ? statuses : ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'failed']
    const status = i < 2 ? (i === 0 ? 'processing' : 'pending') : pool[Math.floor(r() * pool.length)]
    // Horodatage de chaque étape : pendingAt (création), processingAt, completedAt/failedAt.
    const at = new Date((t -= (i ? 1000 * 60 * 60 * (3 + r() * 7) : 0))).getTime()
    const procAt = at + (45 + r() * 120) * 1000
    const doneAt = procAt + (60 + r() * 300) * 1000
    const failAt = at + (50 + r() * 90) * 1000
    const stamps = status === 'pending' ? { pendingAt: new Date(at).toISOString() }
      : status === 'processing' ? { pendingAt: new Date(at).toISOString(), processingAt: new Date(procAt).toISOString() }
      : status === 'completed' ? { pendingAt: new Date(at).toISOString(), processingAt: new Date(procAt).toISOString(), completedAt: new Date(doneAt).toISOString() }
      : { pendingAt: new Date(at).toISOString(), processingAt: new Date(procAt).toISOString(), failedAt: new Date(failAt).toISOString() }
    return {
      id: `t${i + 1}`,
      reference: `DEMO-${(1482190 - i * 1379).toString(36).toUpperCase()}`,
      createdAt: new Date(at).toISOString(),
      ...stamps,
      beneficiaryId: b.id,
      beneficiaryName: b.name,
      fromCountry: 'SN',
      toCountry: b.country,
      sendCurrency: 'USD',
      amount: amountUsd,
      fee,
      rate,
      receiveCurrency: country.currency,
      received: Math.round(amountUsd * rate * 100) / 100,
      method: b.method,
      provider: b.provider,
      status,
      demo: true,
    }
  })
}

export const DEMO_TRANSACTIONS = buildTransactions()
