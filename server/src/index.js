/**
 * PayBridge Africa — backend Express + Bitnob.
 *
 * Deux modes :
 *   - LIVE    : BITNOB_CLIENT_ID + BITNOB_CLIENT_SECRET configurés → appels réels
 *               signés HMAC (cf. https://bitnob.dev).
 *   - SIMULATION : sans clés → même contrat d'API, statuts/taux simulés.
 *
 * Flux payout Bitnob implémenté (doc : docs/payouts/full-payout-flow) :
 *   1. POST /api/payouts/quotes            → quote { quote_id, fees, rate, expires_at }
 *   2. POST /api/payouts/:quoteId/initialize → attache le bénéficiaire (INITIATED)
 *   3. POST /api/payouts/:quoteId/finalize   → déclenche le paiement (PENDING → …)
 *   4. Webhooks + polling GET /api/payouts/:id → statuts pour le front (SSE).
 *
 * Routes exposées (contrat consommé par src/services/api.js) :
 *   GET  /api/health                     → { ok, mode }
 *   GET  /api/wallet                     → { balance, currency }
 *   GET  /api/rates                      → { updatedAt, rates }   (rates : 1 USD = X devise)
 *   GET  /api/banks/:country             → { banks: [{ code, name }] }
 *   GET  /api/account-lookup?…           → vérification du titulaire de compte
 *   POST /api/quotes                     → { amount, fee, rate, received, expiresAt, quoteId }
 *   POST /api/transfers                  → Transfer (quote + initialize + finalize)
 *   GET  /api/transfers | /:id           → Transfer(s)
 *   GET|POST /api/beneficiaries          → Beneficiary(s)
 *   GET  /api/events                     → flux SSE { id, status }
 *   POST /api/webhooks/bitnob            → webhooks lifecycle (brut, signé)
 */
import './env.js'
import express from 'express'
import crypto from 'node:crypto'
import { bitnob, LIVE } from './bitnob.js'
import * as store from './store.js'

/* ── Constantes démo (miroir de src/data/demo.js) — TODO prod : source de vérité API ── */
const RECEIVE_CURRENCY = { SN: 'XOF', CI: 'XOF', NG: 'NGN', GH: 'GHS', KE: 'KES', CM: 'XAF', ZA: 'ZAR', FR: 'EUR', US: 'USD' }
const RATES_USD = { USD: 1, EUR: 0.92, XOF: 603.5, XAF: 603.5, NGN: 1548, GHS: 15.4, KES: 129.2, ZAR: 18.1, SATS: 95_000 }
const FEES = { percent: 0.009, fixedUsd: 0.5 }
const SIM_BALANCE = { balanceUsd: 12480.35, currency: 'USD' }
const SIM_WALLETS = [
  { currency: 'USD',  balance: 12480.35, label: 'Portefeuille USD' },
  { currency: 'EUR',  balance: 2840.00,  label: 'Compte Euro' },
  { currency: 'USDC', balance: 3150.00,  label: 'USD Coin (Polygon)' },
]

const SIM_BANKS = {
  GH: [{ code: 'GCB', name: 'GCB Bank' }, { code: 'ECB', name: 'Ecobank Ghana' }, { code: 'GTB', name: 'GTBank Ghana' }],
  NG: [{ code: '058', name: 'GTBank Nigeria' }, { code: '011', name: 'First Bank NG' }, { code: '050', name: 'Access Bank' }],
  SN: [{ code: 'BSIC', name: 'BSIC Sénégal' }, { code: 'BOA', name: 'BOA Sénégal' }, { code: 'ECOBANK', name: 'Ecobank Sénégal' }],
  KE: [{ code: 'KCB', name: 'KCB Bank' }, { code: 'EQTY', name: 'Equity Bank' }, { code: 'COOP', name: 'Co-op Bank' }],
  CI: [{ code: 'SGCI', name: 'SGBCI' }, { code: 'BOACI', name: 'BOA CI' }, { code: 'ECOBANK', name: 'Ecobank CI' }],
  CM: [{ code: 'AFRILAND', name: 'Afriland First Bank' }, { code: 'SGBC', name: 'Société Générale CM' }],
  ZA: [{ code: 'FNB', name: 'FNB' }, { code: 'STD', name: 'Standard Bank' }, { code: 'NED', name: 'Nedbank' }],
}
const SIM_HOLDER_NAMES = ['Fatou Sow', 'Kofi Boateng', 'Chinedu Okafor', 'Mariama Camara', 'Amina Kimani', 'Emmanuel Ekané', 'Lerato Dlamini']

const SIM_ADDRESSES = {
  BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf6',
  USDT: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m8',
  USDC: '0x742d35Cc6634C0532925a3b844Bc454e7595f89',
}

/** réseaux mobile money → codes Bitnob attendus (best-effort, à vérifier par corridor). */
const MOBILE_NETWORK_CODES = { WAVE: 'WAVE', 'ORANGE MONEY': 'ORANGE', 'MTN MOMO': 'MTN', 'M-PESA': 'M_PESA' }

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const digits = (s = '') => String(s).replace(/\D/g, '')
const iso = () => new Date().toISOString()

/** Devis local — copie de src/lib/format.js pour le mode SIMULATION. */
function localQuote({ amount, sendCurrency = 'USD', receiveCurrency }) {
  const a = Number(amount) || 0
  const rate = RATES_USD[receiveCurrency] / RATES_USD[sendCurrency]
  const fee = a > 0 ? a * FEES.percent + (FEES.fixedUsd / RATES_USD[sendCurrency]) : 0
  const net = Math.max(a - fee, 0)
  return { amount: a, fee: round(fee, 2), rate, net: round(net, 2), received: round(net * rate, 2), total: a }
}

/** Quote (réelle ou simulée) partagée par POST /api/quotes et le flux de transfert. */
async function makeQuote({ amount, toCountry, sendCurrency = 'USD', fundingMode = 'offchain' }) {
  const receiveCurrency = RECEIVE_CURRENCY[toCountry] ?? 'XOF'
  if (!LIVE) {
    await sleep(250)
    const q = localQuote({ amount, sendCurrency, receiveCurrency })
    return { ...q, expiresAt: new Date(Date.now() + 60_000).toISOString() }
  }
  const fromAsset = sendCurrency === 'USD' ? 'USDT' : sendCurrency
  const chain = fromAsset === 'BTC' ? 'bitcoin' : 'polygon'
  const payout = await bitnob('POST', '/api/payouts/quotes', {
    amount: String(amount),
    country: toCountry,
    from_asset: fromAsset,
    to_currency: receiveCurrency,
    source: fundingMode === 'onchain' ? 'onchain' : 'offchain',
    ...(fundingMode === 'onchain' ? { chain } : {}),
    reference: `PB-QT-${crypto.randomBytes(6).toString('hex')}`,
  })
  const p = payout?.payout ?? payout
  return {
    amount: Number(p.amount),
    fee: Number(p.fees ?? 0),
    rate: Number(p.exchange_rate?.effective_rate ?? p.exchange_rate?.rate),
    received: Number(p.settlement_amount),
    expiresAt: p.expires_at,
    quoteId: p.quote_id,
    payoutId: p.id,
  }
}

/** Vérifie la réception d'un webhook (à ajuster si la doc finalise le header exact). */
function verifyWebhook(raw, signature) {
  const secret = process.env.BITNOB_WEBHOOK_SECRET
  if (!secret) return true // pas de secret configuré : on accepte (dev/sandbox only)
  if (!signature) return false
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const app = express()

/* ── CORS — ALLOWED_ORIGINS=* ou liste CSV d'origines (ex: https://monshop.com) ── */
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map(s => s.trim()).filter(Boolean)
app.use((req, res, next) => {
  const origin = req.get('Origin')
  const allow = ALLOWED.includes('*') ? (origin ?? '*') : (ALLOWED.includes(origin) ? origin : null)
  if (allow) {
    res.set('Access-Control-Allow-Origin', allow)
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    if (allow !== '*') res.set('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/* Webhook AVANT express.json() : il a besoin du corps BRUT pour vérifier la signature. */
app.post('/api/webhooks/bitnob', express.raw({ type: '*/*', limit: '256kb' }), (req, res) => {
  if (!verifyWebhook(req.body, req.get('x-bitnob-signature'))) {
    return res.status(401).json({ message: 'Signature webhook invalide' })
  }

  let evt
  try {
    evt = JSON.parse(req.body.toString('utf8') || '{}')
  } catch {
    return res.status(400).json({ message: 'Corps webhook JSON invalide.' })
  }

  // Les webhooks Virtual Accounts utilisent eventType/eventId/payload ; les
  // anciens webhooks payout utilisent event/event_id/data. On accepte les deux.
  const eventType = evt.eventType ?? evt.event
  const eventId = evt.eventId ?? evt.event_id
  if (eventId && store.seenEvents.has(eventId)) return res.status(200).json({ received: true, dedup: true })

  if (eventType === 'virtual_account.deposit.success') {
    const payload = evt.payload ?? {}
    if (!payload.virtual_account_id || payload.amount === undefined || !payload.currency) {
      return res.status(400).json({ message: 'Payload de dépôt virtuel incomplet.' })
    }

    if (eventId) store.seenEvents.add(eventId)
    store.addVirtualAccountDeposit({
      eventId: eventId ?? null,
      virtualAccountId: payload.virtual_account_id,
      amount: String(payload.amount), // valeur Bitnob en kobo
      currency: payload.currency,
      reference: payload.reference ?? null,
      ledgerTransactionId: payload.ledger_transaction_id ?? null,
      providerTransactionId: payload.provider_transaction_id ?? null,
      receivedAt: iso(),
    })
    return res.status(200).json({ received: true })
  }

  // Payout webhooks (changelog juillet 2026) — event =学府 résultat, data.payout = record.
  const MAPPING = {
    'payouts.initialized': 'pending',
    'payouts.processing': 'processing',
    'payouts.withdrawal.success': 'completed',
    'payouts.withdrawal.expired': 'failed',
    // anciens événements (obsolètes, tolérés)
    'payout.transfer.success': 'completed',
    'payout.transfer.failed': 'failed',
  }
  const payout = evt.data?.payout ?? evt.data ?? {}
  const tx = store.byReference(payout.reference)
  if (tx && MAPPING[eventType]) store.setStatus(tx.id, MAPPING[eventType])
  if (eventId) store.seenEvents.add(eventId)
  return res.status(200).json({ received: true })
})

app.use(express.json())

const FAIL = (res, e) => res.status(e.status ?? 502).json({ message: e.message })

/* Bearer API Key — requis uniquement si API_KEY= est défini dans .env. */
const API_KEY = process.env.API_KEY ?? ''
const requireApiKey = (req, res, next) => {
  if (!API_KEY) return next()
  if ((req.get('Authorization') ?? '') === `Bearer ${API_KEY}`) return next()
  res.status(401).json({ message: 'API key invalide ou manquante. Ajoutez Authorization: Bearer <API_KEY>.' })
}

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: LIVE ? 'bitnob' : 'simulation', time: iso() }))

/* ── Comptes virtuels NGN — Bitnob Virtual Accounts ──
   Un compte est lié à un customer nigérian vérifié par BVN. Les routes ne
   contournent pas cette exigence de conformité : Bitnob la vérifie à la création. */
app.post('/api/customers', async (req, res) => {
  try {
    const customer = req.body ?? {}
    if (!customer.email || !customer.customer_type) {
      return res.status(400).json({ message: 'email et customer_type sont requis.' })
    }
    res.status(201).json(await bitnob('POST', '/api/customers', customer))
  } catch (e) { FAIL(res, e) }
})

app.get('/api/customers', async (_req, res) => {
  try { res.json(await bitnob('GET', '/api/customers')) } catch (e) { FAIL(res, e) }
})

app.get('/api/virtual-accounts/supported-currencies', async (_req, res) => {
  try { res.json(await bitnob('GET', '/api/virtual-accounts/supported-currencies')) } catch (e) { FAIL(res, e) }
})

app.get('/api/virtual-accounts', async (_req, res) => {
  try { res.json(await bitnob('GET', '/api/virtual-accounts')) } catch (e) { FAIL(res, e) }
})

app.post('/api/virtual-accounts', async (req, res) => {
  try {
    const { reference, customer_id, currency = 'NGN', account_alias } = req.body ?? {}
    if (!reference || !customer_id) return res.status(400).json({ message: 'reference et customer_id sont requis.' })
    if (currency !== 'NGN') return res.status(400).json({ message: 'Seule la devise NGN est disponible pour les comptes virtuels.' })
    const virtualAccount = await bitnob('POST', '/api/virtual-accounts', { reference, customer_id, currency, ...(account_alias ? { account_alias } : {}) })
    res.status(201).json(virtualAccount)
  } catch (e) { FAIL(res, e) }
})

app.get('/api/virtual-accounts/:id/transactions', async (req, res) => {
  try { res.json(await bitnob('GET', `/api/virtual-accounts/${encodeURIComponent(req.params.id)}/transactions`)) } catch (e) { FAIL(res, e) }
})

app.post('/api/virtual-accounts/:id/simulate-deposit', async (req, res) => {
  try {
    const data = await bitnob('POST', `/api/virtual-accounts/${encodeURIComponent(req.params.id)}/simulate-deposit`)
    res.status(201).json(data)
  } catch (e) { FAIL(res, e) }
})

app.get('/api/virtual-account-deposits', (_req, res) => res.json([...store.virtualAccountDeposits]))

/* ── Wallet — mapping GET /api/balances (Bitnob) ── */
app.get('/api/wallet', async (_req, res) => {
  try {
    if (!LIVE) {
      await sleep(200)
      return res.json({ balance: SIM_BALANCE.balanceUsd, currency: 'USD', wallets: SIM_WALLETS })
    }
    const data = await bitnob('GET', '/api/balances')
    // Le format actuel Bitnob renvoie `accounts`; `ledger_balance` est gardé
    // pour les anciennes réponses éventuelles.
    const ledger = data?.accounts ?? data?.ledger_balance ?? (Array.isArray(data) ? data : [])
    const wallets = ledger
      .map((b) => ({ currency: String(b.currency ?? '').toUpperCase(), balance: Number(b.balance ?? 0), label: b.description ?? String(b.currency ?? '') }))
      .filter((w) => w.currency && Number.isFinite(w.balance))
    const usd = wallets.find((w) => w.currency.startsWith('USD') || w.currency === 'USDT')
    res.json({ balance: Number(usd?.balance ?? 0), currency: 'USD', wallets })
  } catch (e) { FAIL(res, e) }
})

/* ── Taux — mapping GET /api/exchange-rates?base=USD (doc : List Exchange Rates) ── */
app.get('/api/rates', async (_req, res) => {
  try {
    if (!LIVE) { await sleep(150); return res.json({ updatedAt: iso(), source: 'simulation', rates: { ...RATES_USD } }) }
    const data = await bitnob('GET', '/api/exchange-rates', { base: 'USD' })
    const list = Array.isArray(data?.rates) ? data.rates : Array.isArray(data) ? data : []
    const rates = { USD: 1 }
    for (const r of list) {
      const currency = String(r.target_currency ?? r.currency ?? '').toUpperCase()
      const value = Number(r.mid_rate ?? r.rate)
      if (currency && Number.isFinite(value)) rates[currency] = value
    }
    res.json({ updatedAt: data?.timestamp ?? iso(), source: 'bitnob', rates })
  } catch (e) { FAIL(res, e) }
})

/* ── Banques — mapping GET /api/payouts/banks/:countryCode ── */
app.get('/api/banks/:country', async (req, res) => {
  try {
    if (!LIVE) { await sleep(150); return res.json({ banks: SIM_BANKS[req.params.country] ?? SIM_BANKS.DEFAULT ?? [] }) }
    const data = await bitnob('GET', `/api/payouts/banks/${req.params.country}`)
    const list = Array.isArray(data?.banks) ? data.banks : Array.isArray(data) ? data : data?.data ?? []
    res.json({ banks: list.map((b) => ({ code: String(b.bank_code ?? b.code), name: String(b.bank_name ?? b.name) })).filter((b) => b.code && b.name) })
  } catch (e) { FAIL(res, e) }
})

/* ── Vérification du titulaire — mapping GET /api/payouts/account-lookup ──
   NG=banque (bank_code), GH=mobile money (type=mobile_money, réseau dans bank_code). */
app.get('/api/account-lookup', async (req, res) => {
  try {
    const { country, accountNumber, bankCode, method } = req.query
    if (!country || !accountNumber || !bankCode) return res.status(400).json({ message: 'Paramètres manquants (country, accountNumber, bankCode).' })
    if (digits(accountNumber).length < 6) return res.status(400).json({ message: 'Numéro de compte invalide.' })

    if (!LIVE) {
      await sleep(500)
      const name = SIM_HOLDER_NAMES[digits(accountNumber).split('').reduce((a, c) => a + Number(c), 0) % SIM_HOLDER_NAMES.length]
      return res.json({ accountName: name.toUpperCase(), accountNumber, bankCode, bankName: 'Banque (démo)', country, isVerified: true })
    }

    const params = { country, bank_code: bankCode, account_number: digits(accountNumber) }
    if (method === 'mobile') params.type = 'mobile_money'
    const d = await bitnob('GET', '/api/payouts/account-lookup', params)
    res.json({
      accountName: d?.account_name ?? null,
      accountNumber: d?.account_number ?? accountNumber,
      bankCode: d?.bank_code ?? bankCode,
      bankName: d?.bank_name ?? null,
      country: d?.country ?? country,
      isVerified: d?.is_verified ?? false,
    })
  } catch (e) { FAIL(res, e) }
})

/* ── Quote — mapping POST /api/payouts/quotes ── */
app.post('/api/quotes', async (req, res) => {
  try {
    const { amount, toCountry, sendCurrency = 'USD' } = req.body ?? {}
    if (!(Number(amount) > 0)) return res.status(400).json({ message: 'montant invalide.' })
    if (!RECEIVE_CURRENCY[toCountry]) return res.status(400).json({ message: `Pays non supporté : ${toCountry}` })
    res.json(await makeQuote({ amount, toCountry, sendCurrency }))
  } catch (e) { FAIL(res, e) }
})

/* ── Transferts ── */
app.get('/api/transfers', (_req, res) => res.json([...store.transfers]))

app.get('/api/transfers/:id', (req, res) => {
  const tx = store.getTransfer(req.params.id)
  if (!tx) return res.status(404).json({ message: 'Transfert introuvable.' })
  res.json(tx)
})

app.post('/api/transfers', async (req, res) => {
  const b = req.body ?? {}
  const beneficiary = store.getBeneficiary(b.beneficiaryId)
  if (!(Number(b.amount) > 0)) return res.status(400).json({ message: 'montant invalide.' })
  if (!beneficiary) return res.status(400).json({ message: 'Bénéficiaire inconnu.' })
  if (!RECEIVE_CURRENCY[b.toCountry] || b.toCountry !== beneficiary.country) {
    return res.status(400).json({ message: 'Pays incompatible avec le bénéficiaire.' })
  }

  const reference = `PB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
  const receiveCurrency = RECEIVE_CURRENCY[b.toCountry]
  try {
    const fundingMode = b.fundingMode === 'onchain' ? 'onchain' : 'offchain'
    const q = await makeQuote({ amount: b.amount, toCountry: b.toCountry, sendCurrency: b.sendCurrency ?? 'USD', fundingMode })
    const tx = store.createTransfer({
      id: reference,
      reference,
      createdAt: iso(),
      pendingAt: iso(),
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.name,
      fromCountry: b.fromCountry ?? 'SN',
      toCountry: b.toCountry,
      sendCurrency: b.sendCurrency ?? 'USD',
      amount: q.amount,
      fee: q.fee,
      rate: q.rate,
      receiveCurrency,
      received: q.received,
      method: beneficiary.method,
      provider: beneficiary.provider,
      paymentReason: b.paymentReason ?? 'family_support',
      fundingMode,
      quoteId: q.quoteId,
      status: 'pending',
      demo: false,
    })

    if (!LIVE) {
      // Simulation déterminée côté serveur (le front en était responsable avant).
      setTimeout(() => store.setStatus(tx.id, 'processing'), 2000)
      setTimeout(() => {
        const ok = !String(tx.amount).endsWith('.13') // astuce démo conservée : X,13 → échec
        store.setStatus(tx.id, ok ? 'completed' : 'failed', ok ? {} : { failureReason: 'Le fournisseur de paiement a refusé la demande (simulation).' })
      }, 5500)
    } else {
      const destinationType = beneficiary.method === 'mobile' ? 'mobile_money' : 'bank'
      const accountNumber = digits(beneficiary.account)
      const bankCode = beneficiary.bankCode
        ?? (beneficiary.method === 'mobile'
          ? (MOBILE_NETWORK_CODES[String(beneficiary.provider).toUpperCase()] ?? String(beneficiary.provider).toUpperCase().replace(/\s+/g, '_'))
          : undefined)
      await bitnob('POST', `/api/payouts/${q.quoteId}/initialize`, {
        quote_id: q.quoteId,
        reference,
        payment_reason: tx.paymentReason,
        callback_url: `${PUBLIC_URL()}/api/webhooks/bitnob`,
        beneficiary: {
          destination_type: destinationType,
          country: b.toCountry,
          account_name: beneficiary.name,
          account_number: accountNumber,
          ...(bankCode ? { bank_code: bankCode } : {}),
        },
      })
      store.setStatus(tx.id, 'pending')
      await bitnob('POST', `/api/payouts/${q.quoteId}/finalize`)
      // Ensuite : webhooks + polling (voir refreshPayout) mettent le statut à jour.
    }
    res.status(201).json(tx)
  } catch (e) {
    const failed = store.byReference(reference)
    if (failed) store.setStatus(failed.id, 'failed', { failureReason: e.message })
    FAIL(res, e)
  }
})

/** Finance un payout on-chain par une écriture simulée — sandbox Bitnob uniquement. */
app.post('/api/transfers/:id/simulate-deposit', async (req, res) => {
  const tx = store.getTransfer(req.params.id)
  if (!tx) return res.status(404).json({ message: 'Transfert introuvable.' })
  if (tx.fundingMode !== 'onchain') return res.status(400).json({ message: 'Ce transfert n’utilise pas le financement sandbox on-chain.' })
  if (!tx.quoteId) return res.status(400).json({ message: 'Quote Bitnob introuvable pour ce transfert.' })
  try {
    await bitnob('POST', `/api/payouts/quotes/${encodeURIComponent(tx.quoteId)}/deposits`, { amount: String(tx.amount) })
    store.setStatus(tx.id, 'processing')
    res.json(tx)
  } catch (e) { FAIL(res, e) }
})

/* ── Bénéficiaires ── */
app.get('/api/beneficiaries', (_req, res) => res.json([...store.beneficiaries]))

app.post('/api/beneficiaries', (req, res) => {
  const b = req.body ?? {}
  if (!b.name || String(b.name).trim().length < 3) return res.status(400).json({ message: 'Nom complet requis.' })
  if (digits(b.account).length < 6) return res.status(400).json({ message: 'Numéro de compte invalide.' })
  res.status(201).json(store.addBeneficiary({ id: `b-${Date.now()}`, ...b, name: String(b.name).trim() }))
})

app.put('/api/beneficiaries/:id', (req, res) => {
  const existing = store.getBeneficiary(req.params.id)
  if (!existing) return res.status(404).json({ message: 'Bénéficiaire introuvable.' })
  Object.assign(existing, req.body ?? {}, { id: existing.id })
  res.json(existing)
})

/* ── Lightning ── */
app.post('/api/lightning/decode', async (req, res) => {
  try {
    const { request } = req.body ?? {}
    if (!request) return res.status(400).json({ message: 'paymentRequest manquant.' })
    if (!LIVE) {
      await sleep(300)
      let h = 0
      for (const c of String(request)) h = (h * 31 + c.charCodeAt(0)) % 9973
      const amountSat = 12_000 + (h % 60) * 1_500
      return res.json({ paymentHash: `${h}`.padStart(64, '0'), amountSat, description: 'Facture PayBridge (simulation)', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), isExpired: false })
    }
    const data = await bitnob('POST', '/api/lightning/decode', { payment_request: request })
    res.json({
      paymentHash: data.payment_hash ?? data.paymentHash ?? null,
      amountSat: Number(data.amount_sat ?? data.numSatoshis ?? data.amount ?? 0),
      description: data.description ?? '',
      expiresAt: data.expires_at ?? null,
      isExpired: data.is_expired ?? false,
    })
  } catch (e) { FAIL(res, e) }
})

app.post('/api/lightning/invoices', async (req, res) => {
  try {
    const { amountUsd, description } = req.body ?? {}
    if (!LIVE) {
      await sleep(400)
      const amountSat = Math.max(1, Math.round((Number(amountUsd) || 0) * RATES_USD.SATS))
      const stamp = Date.now().toString(36)
      return res.json({
        id: `ln-${stamp}`,
        paymentRequest: `lnbc${amountSat}n1p95dqgypp58s3rj2u42yxu9mnxm6k6t3z4fa89uhmqcqzpgn2qpaybridge${stamp}`,
        amountSat,
        description: description ?? 'PayBridge',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        status: 'pending',
      })
    }
    const amountSat = Math.max(1, Math.round((Number(amountUsd) || 0) * RATES_USD.SATS))
    const data = await bitnob('POST', '/api/lightning/invoices', {
      amount: amountSat,
      description: description ?? 'PayBridge',
      reference: `PB-LN-${crypto.randomBytes(6).toString('hex')}`,
    })
    res.json({
      id: data.id ?? data.reference,
      paymentRequest: data.payment_request ?? data.paymentRequest,
      amountSat: Number(data.amount ?? amountSat),
      description: data.description ?? description,
      expiresAt: data.expires_at ?? null,
      status: data.status ?? 'pending',
    })
  } catch (e) { FAIL(res, e) }
})

/* ── Lightning Pay ── */
app.post('/api/lightning/pay', async (req, res) => {
  try {
    const { paymentRequest } = req.body ?? {}
    if (!paymentRequest) return res.status(400).json({ message: 'paymentRequest manquant.' })
    if (!LIVE) {
      await sleep(1500)
      let h = 0
      for (const c of String(paymentRequest)) h = (h * 31 + c.charCodeAt(0)) % 9973
      const amountSat = 12_000 + (h % 60) * 1_500
      const reference = `PB-LN-${Date.now().toString(36).toUpperCase()}`
      return res.json({ id: reference, reference, status: 'completed', amountSat, feeSat: Math.round(amountSat * 0.001) })
    }
    const reference = `PB-LN-${crypto.randomBytes(6).toString('hex')}`
    const data = await bitnob('POST', '/api/lightning/pay', {
      payment_request: paymentRequest,
      reference,
      callback_url: `${PUBLIC_URL()}/api/webhooks/bitnob`,
    })
    res.json({
      id: data.id ?? reference, reference,
      status: data.status ?? 'pending',
      amountSat: Number(data.amount ?? 0),
      feeSat: Number(data.fee ?? 0),
    })
  } catch (e) { FAIL(res, e) }
})

/* ── Adresses crypto ── */
app.post('/api/addresses/validate', async (req, res) => {
  try {
    const { address, chain = 'BTC' } = req.body ?? {}
    if (!address) return res.status(400).json({ message: 'Adresse manquante.' })
    if (!LIVE) {
      await sleep(250)
      const valid = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address)
        || /^0x[a-fA-F0-9]{40}$/.test(address)
        || /^T[a-zA-Z0-9]{33}$/.test(address)
      return res.json({ address, chain, valid, source: 'simulation' })
    }
    const data = await bitnob('POST', '/api/addresses/validate', { address, chain })
    res.json({ address, chain, valid: data?.is_valid ?? data?.valid ?? false, source: 'bitnob' })
  } catch (e) { FAIL(res, e) }
})

app.get('/api/addresses/deposit', async (req, res) => {
  try {
    const { chain = 'BTC' } = req.query
    if (!LIVE) {
      await sleep(250)
      return res.json({ address: SIM_ADDRESSES[chain] ?? SIM_ADDRESSES.BTC, chain, source: 'simulation' })
    }
    const data = await bitnob('GET', '/api/addresses', { currency: chain })
    const address = data?.address ?? data?.walletAddress ?? (Array.isArray(data) ? data[0]?.address : null)
    if (!address) throw Object.assign(new Error('Adresse de dépôt indisponible.'), { status: 502 })
    res.json({ address, chain, source: 'bitnob' })
  } catch (e) { FAIL(res, e) }
})

/* ── Payout simplifié — intégration externe B2B (protégé par API Key) ── */
app.post('/api/payout', requireApiKey, async (req, res) => {
  try {
    const { amount, toCountry, sendCurrency = 'USD', beneficiary: ben, paymentReason = 'business_payment' } = req.body ?? {}
    if (!(Number(amount) > 0)) return res.status(400).json({ message: 'montant invalide.' })
    if (!RECEIVE_CURRENCY[toCountry]) return res.status(400).json({ message: `Pays non supporté : ${toCountry}` })
    if (!ben?.name || !ben?.account) return res.status(400).json({ message: 'beneficiary.name et beneficiary.account sont requis.' })

    let beneficiary = store.beneficiaries.find(b => b.account === ben.account && b.country === toCountry)
    if (!beneficiary) {
      beneficiary = store.addBeneficiary({
        id: `b-${Date.now()}`,
        name: String(ben.name).trim(),
        country: toCountry,
        method: ben.method ?? 'bank',
        provider: ben.provider ?? '',
        account: String(ben.account),
        bankCode: ben.bankCode,
      })
    }

    const reference = `PB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
    const receiveCurrency = RECEIVE_CURRENCY[toCountry]
    const q = await makeQuote({ amount, toCountry, sendCurrency })
    const tx = store.createTransfer({
      id: reference, reference, createdAt: iso(), pendingAt: iso(),
      beneficiaryId: beneficiary.id, beneficiaryName: beneficiary.name,
      fromCountry: 'API', toCountry, sendCurrency,
      amount: q.amount, fee: q.fee, rate: q.rate, receiveCurrency, received: q.received,
      method: beneficiary.method, provider: beneficiary.provider,
      paymentReason, status: 'pending', demo: false,
    })

    if (!LIVE) {
      setTimeout(() => store.setStatus(tx.id, 'processing'), 2000)
      setTimeout(() => store.setStatus(tx.id, 'completed'), 5500)
    } else {
      const destinationType = beneficiary.method === 'mobile' ? 'mobile_money' : 'bank'
      const bankCode = beneficiary.bankCode ?? (beneficiary.method === 'mobile'
        ? (MOBILE_NETWORK_CODES[String(beneficiary.provider).toUpperCase()] ?? String(beneficiary.provider).toUpperCase().replace(/\s+/g, '_'))
        : undefined)
      await bitnob('POST', `/api/payouts/${q.quoteId}/initialize`, {
        quote_id: q.quoteId, reference,
        payment_reason: paymentReason,
        callback_url: `${PUBLIC_URL()}/api/webhooks/bitnob`,
        beneficiary: {
          destination_type: destinationType, country: toCountry,
          account_name: beneficiary.name, account_number: digits(beneficiary.account),
          ...(bankCode ? { bank_code: bankCode } : {}),
        },
      })
      await bitnob('POST', `/api/payouts/${q.quoteId}/finalize`)
    }

    res.status(201).json({
      id: tx.id, reference: tx.reference, status: tx.status,
      amount: tx.amount, fee: tx.fee, rate: tx.rate,
      received: tx.received, receiveCurrency, sendCurrency,
    })
  } catch (e) { FAIL(res, e) }
})

/** URL publique (webhooks) — nécessaire à Initialize. */
function PUBLIC_URL() {
  return process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`
}

/* ── SSE : diffusion temps réel des statuts ── */
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders?.()
  res.write('retry: 3000\n\n')
  const push = (event) => res.write(`data: ${JSON.stringify(event.data)}\n\n`)
  store.listeners.add(push)
  const ping = setInterval(() => res.write(':\n\n'), 20_000)
  req.on('close', () => { store.listeners.delete(push); clearInterval(ping) })
})

/* ── Polling de secours : Bitnob peut ne pas délivrer un webhook ── */
if (LIVE) {
  setInterval(() => {
    for (const tx of store.transfers) {
      if (['completed', 'failed'].includes(tx.status)) continue
      bitnob('GET', `/api/payouts/${tx.reference}`)
        .then((p) => {
          const record = p?.payout ?? p
          const status = store.mapPayoutStatus(record?.status)
          if (status !== tx.status) store.setStatus(tx.id, status)
        })
        .catch(() => { /* silencieux, on retente au prochain cycle */ })
    }
  }, 20_000)
}

const PORT = Number(process.env.PORT ?? 4000)
app.listen(PORT, () => {
  console.log(`✔ PayBridge server sur http://localhost:${PORT} — mode : ${LIVE ? 'BITNOB LIVE' : 'SIMULATION'}`)
  console.log('  Webhooks Bitnob → POST /api/webhooks/bitnob')
  console.log('  Flux temps réel front → GET /api/events (SSE)')
})
