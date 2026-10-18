/**
 * Couche service unique du front.
 *
 * Mode "demo" → réponses simulées (latence + statuts) à partir de data/demo.js
 * Mode "api"  → backend Node.js/Express (server/) qui seul détient les clés
 *               Bitnob et signe les requêtes HMAC (https://bitnob.dev).
 *
 * ── Mapping des routes ────────────────────────────────────────────────────────
 * Chaque appel du front proxifie une route Bitnob signée côté serveur ; les clés
 * ne descendent JAMAIS ici. Colonne 3 = route Bitnob réellement appelée.
 *
 *   Front (ce fichier)              Backend (server/)                    Bitnob (HMAC)
 *   ──────────────────────────────  ───────────────────────────────────  ─────────────────────────────────────
 *   /whoami                         GET  /api/whoami                     GET  /api/whoami
 *   /bitnob/whoami                  (idem, ancienne route)               GET  /api/whoami
 *   /balances  → /wallet            GET  /api/balances                   GET  /api/balances  (available_balance)
 *   /rates                          GET  /api/rates                      GET  /api/exchange-rates?base=USD
 *   /banks/:country                 GET  /api/banks/:country             GET  /api/payouts/banks/:country
 *   /account-lookup                 GET  /api/account-lookup             GET  /api/payouts/account-lookup
 *   /addresses/deposit              GET  /api/addresses/deposit          GET  /api/addresses
 *   /addresses/validate             POST /api/addresses/validate         POST /api/addresses/validate
 *   /transactions → /deposits       GET  /api/transactions               GET  /api/transactions
 *                                   (side Credit = reçus, side Debit = envois)
 *
 *   Parcours A — envoi crypto vers une adresse externe :
 *   /transfers  (canal crypto)      POST /api/transfers                  POST /api/withdrawals
 *   /transfers/:id                  GET  /api/transfers/:id              GET  /api/transactions/{id|reference}
 *
 *   Parcours B — USDC → XOF → Mobile Money :
 *   /quotes                         POST /api/quotes                     POST /api/payouts/quotes
 *   /transfers  (canal fiat)        POST /api/transfers                  POST /api/payouts/{quote_id}/initialize
 *                                                                        POST /api/payouts/{quote_id}/finalize
 *   /transfers/:id  (suivi)         GET  /api/transfers/:id              GET  /api/payouts/{id}  ou  /api/payouts/reference/{ref}
 *
 *   Divers : /beneficiaries (store local), /lightning/* (decode, invoices, pay),
 *   /virtual-accounts* (comptes NGN), /events (SSE statuts temps réel).
 *
 *   Les paires « A → B » signalent un repli : on appelle A (route Bitnob
 *   canonique) et, si le backend déployé répond 404, on retente B (ancienne route
 *   applicative). Le front reste ainsi compatible pendant la migration du back.
 *
 * Note : seuls `completed`/`SETTLED` confirment un envoi ; `/api/transactions` et
 * `/api/payouts` servent à réconcilier les soldes avant/après un paiement.
 */
import {
  IS_DEMO, DEMO_TRANSACTIONS, DEMO_BENEFICIARIES, DEMO_WALLET, DEMO_RATES_USD, DEMO_BANKS, DEMO_BANKS_FALLBACK, DEMO_USER, demoHolder,
} from '../data/demo'
import { quote as localQuote, country, frontStatus, countryOfCurrency } from '../lib/format'
import { channelsOf, channelTitle, channelAccount, cryptoReceived } from '../lib/channels'

const API = import.meta.env.VITE_API_URL ?? 'https://paybridge-ilvu.onrender.com/api'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Dépôts simulés (mode démo) — miroir du contrat de GET /api/deposits. */
const DEMO_DEPOSITS = [
  {
    id: 'RCV_USDC_demo1',
    reference: 'RCV_USDC_demo1',
    direction: 'in',
    amount: 2,
    currency: 'USDC',
    status: 'completed',
    type: 'DEPOSIT_CONFIRMED',
    chain: 'ethereum',
    address: '0x958858853C8B42466DDbb9B8a0e67Def9FB4B5Ed',
    txHash: 'oc_89dd214231f359af962da8c4f0063b28c6bd352312b33a06b2cfe34b528b9b4f',
    source: 'bitnob',
    createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  {
    id: 'RCV_USDC_demo2',
    reference: 'RCV_USDC_demo2',
    direction: 'in',
    amount: 1,
    currency: 'USDC',
    status: 'completed',
    type: 'DEPOSIT_CONFIRMED',
    chain: 'polygon',
    address: '0x28f9382F53410D846a6130a8578BaB92e30EaE33',
    txHash: 'oc_bec86d8929cd85b4f03ae2b988d9d1ee55746d250c0e06ef1944c66ee8939b06',
    source: 'bitnob',
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
  },
]

/** Exigences par pays (mode démo) — miroir de la branche simulation du backend. */
const DEMO_DIAL = { SN: '+221', CI: '+225', GH: '+233', KE: '+254', CM: '+237' }
const DEMO_NETWORKS = { SN: ['ORANGE', 'FREE', 'EXPRESSO', 'WAVE'], CI: ['ORANGE', 'MTN', 'MOOV'], GH: ['MTN', 'TELECEL', 'AIRTELTIGO'], KE: ['MPESA'] }
const DEMO_LIMITS = {
  SN: { min_amount: '100', max_amount: '200000', currency: 'XOF' },
  CI: { min_amount: '100', max_amount: '200000', currency: 'XOF' },
  GH: { min_amount: '20', max_amount: '15000', currency: 'GHS' },
  KE: { min_amount: '20', max_amount: '250000', currency: 'KES' },
}
const DEMO_COUNTRY_REQUIREMENTS = Object.fromEntries(Object.entries(DEMO_NETWORKS).map(([code, options]) => [code, {
  code, source: 'demo', dial_code: DEMO_DIAL[code],
  mobile_money: {
    label: 'Mobile Money',
    limits: DEMO_LIMITS[code] ?? null,
    lookup_fields: ['account_number', 'network'],
    fields: [
      { key: 'account_name', label: 'Nom du titulaire', type: 'text', required: true },
      { key: 'account_number', label: 'Numéro de téléphone', type: 'text', required: true },
      { key: 'network', label: 'Opérateur', type: 'select', required: true, options },
    ],
  },
}]))

async function http(path, opts = {}) {
  // Pas d'auth par cookie ici (aucune session) : envoyer `credentials: 'include'`
  // oblige le navigateur à exiger `Access-Control-Allow-Credentials: true` sur
  // chaque réponse cross-origin (Render). Le défaut « same-origin » suffit.
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const error = new Error((await res.json().catch(() => ({}))).message ?? `Erreur ${res.status}`)
    error.status = res.status
    throw error
  }
  return res.json()
}

/**
 * Essaie plusieurs chemins pour la même donnée : le backend Render bascule vers
 * les routes Bitnob canoniques (/balances, /transactions…) tout en gardant, selon
 * les déploiements, les anciennes routes applicatives (/wallet, /deposits…).
 * Seul un 404 (route absente de cette version) déclenche le repli ; toute autre
 * erreur remonte telle quelle (un 500 n'est pas un changement de contrat).
 */
async function httpFirst(paths, opts = {}) {
  let lastError
  for (const path of paths) {
    try {
      return await http(path, opts)
    } catch (e) {
      lastError = e
      if (e.status !== 404) throw e
    }
  }
  throw lastError
}

/** Recomplate un transfert avec les infos de son bénéficiaire quand le backend
 *  ne les a pas incluses (nom, pays, opérateur) — évite les lignes vides en UI. */
function attachBeneficiaries(transfers, beneficiaries = []) {
  if (!Array.isArray(transfers)) return []
  const byId = new Map((beneficiaries ?? []).map((b) => [b.id, b]))
  return transfers.map((t) => {
    const b = t.beneficiaryId ? byId.get(t.beneficiaryId) : null
    if (!b) return t
    return {
      ...t,
      beneficiaryName: t.beneficiaryName ?? b.name ?? null,
      toCountry: t.toCountry ?? b.country ?? null,
      provider: t.provider ?? b.provider ?? null,
    }
  })
}

/* ── Normalisation des réponses Bitnob ───────────────────────────────────────
 * GET /api/transactions renvoie les mouvements bruts de Bitnob :
 *   { transactions: [{ transaction_id, side: 'Credit'|'Debit', type, state,
 *                      amount (unité mineure), amount_formatted, metadata }] }
 * On les traduit vers les deux contrats du front : « dépôt reçu » et « envoi ».
 */
const MINOR_DECIMALS = { BTC: 8, USDT: 6, USDC: 6 }
const asList = (payload) => (Array.isArray(payload) ? payload : payload?.transactions ?? payload?.data ?? [])

/** Montant Bitnob (unité mineure) → unité majeure. `amount_formatted` prime. */
function majorAmount(tx = {}) {
  const formatted = tx.amount_formatted ?? tx.original_amount_formatted
  if (formatted) {
    const parsed = parseFloat(String(formatted).replace(/[^0-9.]/g, ''))
    if (Number.isFinite(parsed)) return Math.abs(parsed)
  }
  const raw = Math.abs(Number(tx.amount ?? tx.original_amount ?? 0))
  return raw / 10 ** (MINOR_DECIMALS[String(tx.currency ?? '').toUpperCase()] ?? 2)
}

const typeOf = (t) => String(t?.type ?? '').toUpperCase()
const isCredit = (t) => t?.side === 'Credit' || Number(t?.amount ?? 0) > 0 || typeOf(t).startsWith('DEPOSIT')
const isDebit = (t) => !isCredit(t) && (t?.side === 'Debit' || Number(t?.amount ?? 0) < 0 || /PAYOUT|WITHDRAW|TRANSFER/.test(typeOf(t)))

/** Réponse /wallet ou /balances → contrat du front ({ balance, currency, wallets }). */
function normalizeWallet(raw = {}) {
  const wallets = (raw.wallets ?? raw.accounts ?? [])
    .map((w) => {
      const currency = String(w.currency ?? '').toUpperCase()
      const formatted = w.available_balance_formatted ?? w.balance_formatted
      const parsed = formatted ? parseFloat(String(formatted).replace(/[^0-9.]/g, '')) : NaN
      const minor = Number(w.available_balance ?? w.ledger_balance ?? 0) || 0
      const balance = Number.isFinite(Number(w.balance)) ? Number(w.balance)
        : Number.isFinite(parsed) ? parsed
        : minor / 10 ** (MINOR_DECIMALS[currency] ?? 1)
      return { currency, balance, label: w.label ?? w.description ?? `Portefeuille ${currency}` }
    })
    .filter((w) => w.currency)
  const primary = wallets.find((w) => ['USDC', 'USDT', 'USD'].includes(w.currency)) ?? wallets[0]
  return {
    balance: Number(raw.balance ?? primary?.balance ?? 0) || 0,
    currency: String(raw.currency ?? primary?.currency ?? 'USD').toUpperCase(),
    wallets,
  }
}

/** Réponse /transactions ou /deposits → dépôts reçus (contrat du front). */
function depositsOf(payload) {
  const list = asList(payload)
  // Ancienne route /deposits : les entrées sont déjà au contrat du front.
  if (list.length && list.every((t) => t?.direction)) return list
  return list.filter(isCredit).map((t) => {
    const meta = t.metadata ?? {}
    return {
      id: String(t.transaction_id ?? t.id ?? t.reference ?? meta.reference ?? ''),
      reference: t.reference ?? meta.reference ?? null,
      direction: 'in',
      amount: majorAmount(t),
      currency: String(t.currency ?? '').toUpperCase(),
      status: frontStatus(t.state),
      type: t.type ?? 'DEPOSIT',
      chain: meta.chain ?? null,
      address: meta.address ?? null,
      fromAddress: meta.from_address ?? null,
      txHash: meta.tx_hash ?? null,
      source: 'bitnob',
      createdAt: t.created_at ?? meta.detected_at ?? null,
    }
  })
}

/** Réponse /transactions → envois (débits) au contrat du front. */
function transfersOf(payload) {
  return asList(payload).filter(isDebit).map((t) => {
    const meta = t.metadata ?? {}
    const currency = String(t.currency ?? '').toUpperCase()
    const receiveCurrency = String(meta.to_currency ?? '').toUpperCase() || null
    return {
      id: String(t.transaction_id ?? t.id ?? t.reference ?? ''),
      reference: t.reference ?? meta.reference ?? null,
      createdAt: t.created_at ?? meta.settled_at ?? null,
      beneficiaryId: null,
      beneficiaryName: null,
      // Bitnob ne dit pas d'où part le paiement : c'est toujours le compte
      // PayBridge (Sénégal), comme partout ailleurs dans l'app.
      fromCountry: DEMO_USER.country,
      toCountry: countryOfCurrency(receiveCurrency)?.code ?? null,
      sendCurrency: currency,
      receiveCurrency,
      amount: majorAmount(t),
      fee: majorAmount({ amount: t.fee, amount_formatted: t.fee_formatted, currency }),
      rate: null,
      received: null,
      method: meta.address ? 'crypto' : 'mobile',
      provider: 'Bitnob',
      bitnobType: t.type ?? null,
      bitnobStatus: t.state ?? null,
      status: frontStatus(t.state),
      source: 'bitnob',
    }
  })
}

/**
 * GET /api/rates peut renvoyer `rates: {}` accompagné de `rateDetails[]`
 * (réponse Bitnob brute). On reconstitue la table « 1 USD = X devise » :
 * `sell_rate` est le taux appliqué aux payouts, `buy_rate` sert de repli.
 */
function normalizeRates(raw = {}) {
  const rates = { ...(raw.rates ?? {}) }
  for (const d of raw.rateDetails ?? []) {
    const currency = String(d.target_currency ?? '').toUpperCase()
    if (!currency || rates[currency] != null) continue
    const value = Number(d.sell_rate ?? d.buy_rate ?? d.rate)
    if (Number.isFinite(value) && value > 0) rates[currency] = value
  }
  if (rates.USD == null) rates.USD = 1
  return { ...raw, rates }
}

export const api = {
  /** Vérifie l'état de la connexion Bitnob Sandbox via Render */
  async getWhoami() {
    return httpFirst(['/whoami', '/bitnob/whoami'])
  },

  /** Client Bitnob. Un compte virtuel NGN exige ensuite un BVN nigérian valide. */
  async createCustomer(input) {
    if (IS_DEMO) throw new Error('Les clients Bitnob sont disponibles en mode API uniquement.')
    return http('/customers', { method: 'POST', body: input })
  },

  async getVirtualAccounts() {
    if (IS_DEMO) return []
    return http('/virtual-accounts')
  },

  async createVirtualAccount(input) {
    if (IS_DEMO) throw new Error('Les comptes virtuels Bitnob sont disponibles en mode API uniquement.')
    return http('/virtual-accounts', { method: 'POST', body: input })
  },

  async getVirtualAccountTransactions(id) {
    if (IS_DEMO) return []
    return http(`/virtual-accounts/${encodeURIComponent(id)}/transactions`)
  },

  async simulateVirtualAccountDeposit(id) {
    if (IS_DEMO) throw new Error('La simulation de dépôt est disponible en mode API uniquement.')
    return http(`/virtual-accounts/${encodeURIComponent(id)}/simulate-deposit`, { method: 'POST' })
  },

  /** Solde du compte Bitnob : GET /api/balances (canonique), sinon /api/wallet. */
  async getWallet() {
    if (!IS_DEMO) return normalizeWallet(await httpFirst(['/balances', '/wallet']))
    await wait(500)
    return { balance: DEMO_WALLET.balanceUsd, currency: DEMO_WALLET.currency }
  },

  /**
   * Envois. Source canonique : GET /api/transactions (les débits = nos sorties
   * d'argent, avec leur état Bitnob réel). Repli sur /api/transfers pour les
   * versions du backend qui n'exposent pas encore /transactions.
   */
  async getTransfers() {
    if (IS_DEMO) {
      await wait(650)
      return structuredClone(DEMO_TRANSACTIONS)
    }
    const [beneficiaries, legacy] = await Promise.all([
      http('/beneficiaries').catch(() => []),
      http('/transactions').then(
        (payload) => ({ transactions: transfersOf(payload) }),
        (e) => (e.status === 404 ? null : Promise.reject(e)),
      ),
    ])
    if (legacy) return attachBeneficiaries(legacy.transactions, beneficiaries)
    // Ancienne version du backend : liste d'objets transfert propres à l'app.
    return attachBeneficiaries(await http('/transfers'), beneficiaries)
  },

  async getTransfer(id) {
    if (!IS_DEMO) return http(`/transfers/${id}`)
    await wait(400)
    const tx = DEMO_TRANSACTIONS.find((t) => t.id === id)
    if (!tx) throw new Error('Transfert introuvable.')
    return structuredClone(tx)
  },

  /** Opérations REÇUES : crédits de GET /api/transactions (canonique), sinon /api/deposits. */
  async getDeposits() {
    if (!IS_DEMO) return depositsOf(await httpFirst(['/transactions', '/deposits']))
    await wait(550)
    return structuredClone(DEMO_DEPOSITS)
  },

  async getBeneficiaries() {
    if (!IS_DEMO) return http('/beneficiaries')
    await wait(450)
    return structuredClone(DEMO_BENEFICIARIES)
  },

  async getQuote(input) {
    if (!IS_DEMO) return http('/quotes', { method: 'POST', body: input })
    await wait(250)
    return { ...localQuote(input), expiresAt: Date.now() + 60_000 }
  },

  async createTransfer(input) {
    if (!IS_DEMO) return http('/transfers', { method: 'POST', body: input })
    await wait(1100)
    // Démo : un montant se terminant par ",13" simule un échec, pour montrer l'état d'erreur.
    if (String(input.amount).endsWith('.13')) throw new Error('Le montant a été refusé sur ce canal (simulation).')
    const beneficiary = input.beneficiary
    const ch = input.channel ?? channelsOf(beneficiary)[0]
    const fiat = !['crypto', 'lightning'].includes(ch.kind)
    const receiveCurrency = fiat ? country(input.toCountry).currency : (ch.kind === 'lightning' ? 'SATS' : (ch.asset ?? 'USDT'))
    const q = localQuote({ ...input, receiveCurrency: fiat ? receiveCurrency : 'USD' })
    const cryptoKind = !fiat
    return {
      id: `t-${Date.now()}`,
      reference: `DEMO-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      createdAt: new Date().toISOString(),
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.name,
      fromCountry: input.fromCountry,
      toCountry: input.toCountry,
      sendCurrency: input.sendCurrency,
      channelId: ch.id,
      channelKind: ch.kind,
      amount: q.amount,
      fee: q.fee,
      rate: cryptoKind ? (ch.kind === 'lightning' ? DEMO_RATES_USD.SATS : 1) : q.rate,
      receiveCurrency,
      received: cryptoKind ? cryptoReceived(ch.kind, q.net, ch.asset) : q.received,
      method: ch.kind,
      provider: channelTitle(ch),
      account: channelAccount(ch),
      paymentReason: input.paymentReason ?? 'family_support',
      status: 'pending',
      demo: true,
    }
  },

  /** Dépôt fictif d'un payout on-chain, réservé au sandbox Bitnob. */
  async simulateTransferDeposit(id) {
    if (IS_DEMO) throw new Error('Le dépôt simulé est disponible en mode API uniquement.')
    return http(`/transfers/${encodeURIComponent(id)}/simulate-deposit`, { method: 'POST' })
  },

  async createBeneficiary(input) {
    if (!IS_DEMO) return http('/beneficiaries', { method: 'POST', body: input })
    await wait(600)
    return { id: `b-${Date.now()}`, ...input }
  },

  async updateBeneficiary(id, input) {
    if (!IS_DEMO) return http(`/beneficiaries/${id}`, { method: 'PUT', body: input })
    await wait(500)
    return { ...input, id }
  },

  /** Validation d'adresse on-chain (Bitnob : addresses/validate). */
  async validateAddress({ address, chain }) {
    if (!IS_DEMO) return http('/addresses/validate', { method: 'POST', body: { address, chain } })
    await wait(350)
    return { address, chain, valid: true, source: 'demo' }
  },

  /** Décodage d'une facture BOLT11 (Bitnob : lightning/decode) — aperçu sans paiement. */
  async decodeLightning({ request }) {
    if (!IS_DEMO) return http('/lightning/decode', { method: 'POST', body: { request } })
    await wait(400)
    let h = 0
    for (const c of String(request)) h = (h * 31 + c.charCodeAt(0)) % 9973
    const amountSat = 12_000 + (h % 60) * 1_500
    return { paymentHash: `${h}`.padStart(64, '0'), amountSat, description: 'Facture PayBridge (démo)', expiresAt: Date.now() + 3_600_000, isExpired: false, source: 'demo' }
  },

  /** Création d'une facture pour RECEVOIR (Bitnob : lightning/invoices). */
  async createLightningInvoice({ amountUsd, description }) {
    if (!IS_DEMO) return http('/lightning/invoices', { method: 'POST', body: { amountUsd, description } })
    await wait(700)
    const amountSat = Math.max(1, Math.round((Number(amountUsd) || 0) * DEMO_RATES_USD.SATS))
    const stamp = Date.now().toString(36)
    return {
      id: `ln-${stamp}`,
      paymentRequest: `lnbc${amountSat}n1p95dqgypp58s3rj2u42yxu9mnxm6k6t3z4fa89uhmqcqzpgn2qpaybridge${stamp}`,
      amountSat,
      description,
      expiresAt: Date.now() + 3_600_000,
      status: 'pending',
    }
  },

  /** Payer une facture Lightning (BOLT11). */
  async payLightningInvoice({ paymentRequest }) {
    if (!IS_DEMO) return http('/lightning/pay', { method: 'POST', body: { paymentRequest } })
    await wait(1500)
    let h = 0
    for (const c of String(paymentRequest)) h = (h * 31 + c.charCodeAt(0)) % 9973
    const amountSat = 12_000 + (h % 60) * 1_500
    return { id: `ln-pay-${Date.now()}`, status: 'completed', amountSat, feeSat: Math.round(amountSat * 0.001) }
  },

  /**
   * Adresses de dépôt on-chain disponibles (une par réseau).
   * → { addresses: [{ chain, address, label }], chains: string[], source }
   * L'appel sans `chain` renvoie la liste complète, ce qui évite d'exposer des
   * réseaux non provisionnés dans le sélecteur du front.
   */
  async getDepositAddresses() {
    if (!IS_DEMO) return http('/addresses/deposit')
    await wait(300)
    return {
      source: 'demo',
      chains: ['bitcoin', 'ethereum', 'polygon'],
      addresses: [
        { chain: 'bitcoin', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf6', label: 'BTC' },
        { chain: 'ethereum', address: '0x742d35Cc6634C0532925a3b844Bc454e7595f89', label: 'USDC' },
        { chain: 'polygon', address: '0x28f9382F53410D846a6130a8578BaB92e30EaE33', label: 'USDT' },
      ],
    }
  },

  /**
   * Adresse de dépôt on-chain pour recevoir du crypto.
   * chain : réseau Bitnob ('bitcoin' | 'ethereum' | 'polygon' | 'avalanche'…)
   * ou un alias actif ('BTC' | 'USDT' | 'USDC').
   */
  async getDepositAddress({ chain = 'ethereum' } = {}) {
    if (!IS_DEMO) return http(`/addresses/deposit?chain=${encodeURIComponent(chain)}`)
    const { addresses } = await api.getDepositAddresses()
    const match = addresses.find((a) => a.chain === chain) ?? addresses[0]
    return { ...match, source: 'demo' }
  },

  /** Taux du jour : { updatedAt, rates: { USD: 1, NGN: 1548, … } }. */
  async getRates() {
    if (!IS_DEMO) return normalizeRates(await http('/rates'))
    await wait(250)
    return { updatedAt: new Date().toISOString(), source: 'demo', rates: { ...DEMO_RATES_USD } }
  },

  /** Liste des banques d'un pays (choisissez un code dans le champ bankCode des bénéficiaires). */
  async getBanks(countryCode) {
    if (!IS_DEMO) return http(`/banks/${countryCode}`)
    await wait(200)
    return { banks: DEMO_BANKS[countryCode] ?? DEMO_BANKS_FALLBACK }
  },

  /**
   * Exigences d'un pays : par rail (`mobile_money`, `bank`…), les champs requis,
   * l'enum des opérateurs mobile money (`network`) et les limites min/max.
   * ← Bitnob GET /api/payouts/supported-countries/:country
   * → { code, name, dial_code, mobile_money: { label, limits, fields[] }, bank?: … }
   */
  async getCountryRequirements(countryCode) {
    if (!IS_DEMO) return http(`/payouts/supported-countries/${encodeURIComponent(countryCode)}`)
    await wait(250)
    return DEMO_COUNTRY_REQUIREMENTS[countryCode] ?? { code: countryCode, source: 'demo' }
  },

  /**
   * Vérification du titulaire de compte (Account Lookup Bitnob).
   * input : { country, accountNumber, bankCode, method: 'bank' | 'mobile' }
   * → { accountName, accountNumber, bankCode, bankName, country, isVerified }
   */
  async lookupAccount(input) {
    if (!IS_DEMO) return http(`/account-lookup?${new URLSearchParams(input)}`)
    await wait(500)
    if (String(input.accountNumber ?? '').replace(/\D/g, '').length < 6) {
      throw new Error('Numéro de compte invalide (démo).')
    }
    return {
      accountName: demoHolder(input.accountNumber),
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      bankName: 'Banque (démo)',
      country: input.country,
      isVerified: true,
    }
  },

  /**
   * Flux temps réel des statuts de transfert (mode API : SSE `GET /api/events`).
   * Renvoie une fonction de désabonnement. En démo : no-op.
   */
  subscribeStatusEvents(onEvent) {
    if (IS_DEMO) return () => {}
    const es = new EventSource(`${API}/events`)
    es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)) } catch { /* ping */ } }
    return () => es.close()
  },
}
