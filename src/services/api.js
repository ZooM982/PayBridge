/**
 * Couche service unique du front.
 *
 * Mode "demo" → réponses simulées (latence + statuts) à partir de data/demo.js
 * Mode "api"  → backend Node.js/Express (server/) qui seul détient les clés
 *               Bitnob et signe les requêtes HMAC (https://bitnob.dev).
 *
 * Contrat du backend (implémenté dans server/src/index.js) :
 *   GET  /api/health                      → { ok, mode }
 *   GET  /api/wallet                      → { balance, currency }   ← Bitnob : balances
 *   GET  /api/rates                       → { updatedAt, rates }    ← Bitnob : exchange-rates
 *   GET  /api/banks/:country              → { banks: [{ code, name }] } ← Bitnob : banks/:code
 *   GET  /api/account-lookup?country&accountNumber&bankCode&method
 *                                         → { accountName, isVerified, ... } ← Bitnob : account-lookup
 *   POST /api/quotes                      → { amount, fee, rate, received, expiresAt, quoteId }
 *                                         ← Bitnob : payouts/quotes
 *   POST /api/transfers                   → Transfer (quote + initialize + finalize côté backend,
 *                                           canal : mobile_money | bank | crypto | lightning)
 *   POST /api/addresses/validate          → { valid }          ← Bitnob : addresses/validate
 *   POST /api/lightning/decode            → { amountSat, description, expiresAt, … } ← Bitnob : lightning/decode
 *   POST /api/lightning/invoices          → { paymentRequest, amountSat } ← Bitnob : lightning/invoices (« Recevoir »)
 *   GET  /api/beneficiaries | POST | PUT /:id → Beneficiary(s) multi-canaux
 *   GET  /api/events                      → flux SSE { id, status } (statuts temps réel,
 *                                           remplace le clignotement simulé du prototype)
 *   POST /api/webhooks/bitnob             → webhooks Bitnob relancés au backend
 *   POST /api/customers                    → client Bitnob
 *   GET|POST /api/virtual-accounts         → comptes virtuels NGN
 *   POST /api/virtual-accounts/:id/simulate-deposit → crédit sandbox
 */
import {
  IS_DEMO, DEMO_TRANSACTIONS, DEMO_BENEFICIARIES, DEMO_WALLET, DEMO_RATES_USD, DEMO_BANKS, DEMO_BANKS_FALLBACK, demoHolder,
} from '../data/demo'
import { quote as localQuote, country } from '../lib/format'
import { channelsOf, channelTitle, channelAccount, cryptoReceived } from '../lib/channels'

const API = import.meta.env.VITE_API_URL ?? '/api'
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

async function http(path, opts = {}) {
  // Pas d'auth par cookie ici (aucune session) : envoyer `credentials: 'include'`
  // oblige le navigateur à exiger `Access-Control-Allow-Credentials: true` sur
  // chaque réponse cross-origin (Render). Le défaut « same-origin » suffit.
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `Erreur ${res.status}`)
  return res.json()
}

export const api = {
  /** Vérifie l'état de la connexion Bitnob Sandbox via Render */
  async getWhoami() {
    return http('/bitnob/whoami')
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

  async getVirtualAccountDeposits() {
    if (IS_DEMO) return []
    return http('/virtual-account-deposits')
  },

  async getWallet() {
    if (!IS_DEMO) return http('/wallet')
    await wait(500)
    return { balance: DEMO_WALLET.balanceUsd, currency: DEMO_WALLET.currency }
  },

  async getTransfers() {
    if (!IS_DEMO) return http('/transfers')
    await wait(650)
    return structuredClone(DEMO_TRANSACTIONS)
  },

  async getTransfer(id) {
    if (!IS_DEMO) return http(`/transfers/${id}`)
    await wait(400)
    const tx = DEMO_TRANSACTIONS.find((t) => t.id === id)
    if (!tx) throw new Error('Transfert introuvable.')
    return structuredClone(tx)
  },

  /** Opérations REÇUES : dépôts on-chain (Bitnob) + comptes virtuels NGN. */
  async getDeposits() {
    if (!IS_DEMO) return http('/deposits')
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
    if (!IS_DEMO) return http('/rates')
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
