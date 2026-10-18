/**
 * Canaux de réception d'un bénéficiaire.
 * Un bénéficiaire peut posséder plusieurs canaux : Mobile Money, banque,
 * crypto (USDT/BTC) et Lightning — chacun routé vers un rail Bitnob distinct
 * (payouts fiat · stablecoins/addresses · lightning pay).
 */
import { CURRENCIES, DEMO_RATES_USD } from '../data/demo'

export const CHANNEL_KINDS = {
  mobile: { label: 'Mobile Money', rail: 'mobile_money', desc: 'Instantané · Wave, Orange, MTN, M-Pesa' },
  bank: { label: 'Banque', rail: 'bank', desc: 'Virement local · vérification du titulaire' },
  crypto: { label: 'Crypto (USDT)', rail: 'crypto', desc: 'USDT on-chain · TRC20 / ERC20' },
  lightning: { label: 'Lightning', rail: 'lightning', desc: 'Facture BOLT11 · sats en ~1 s' },
}

/** Canaux d'un bénéficiaire, avec dérivation depuis les anciens champs (method/provider/account). */
export const channelsOf = (b) => {
  if (Array.isArray(b?.channels) && b.channels.length) return b.channels
  if (!b?.account) return []
  return [{
    id: 'legacy', kind: b.kind ?? (b.method === 'mobile' ? 'mobile' : b.method === 'lightning' ? 'lightning' : b.method === 'crypto' ? 'crypto' : 'bank'),
    label: b.label ?? b.provider, asset: b.asset, chain: b.chain, bankCode: b.bankCode, account: b.account,
  }]
}
export const defaultChannel = (b) => channelsOf(b).find((c) => c.isDefault) ?? channelsOf(b)[0]

/** Titre lisible d'un canal. */
export const channelTitle = (c) => {
  if (!c) return '—'
  if (c.kind === 'crypto') return `${c.asset ?? 'USDT'} · ${c.chain ?? 'TRON'}`
  return c.label ?? c.provider ?? CHANNEL_KINDS[c.kind]?.label ?? c.kind
}

/** Compte masqué pour affichage. */
export const channelAccount = (c) => {
  const a = String(c?.account ?? '')
  return a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a
}

/* ── Validation par canal (miroir de ce que Bitnob vérifiera côté backend) ── */
const RX = {
  lightning: /^(lnbc|lnurl)\d[a-z0-9]{40,}$/i,
  erc20: /^0x[a-fA-F0-9]{40}$/,
  bech32: /^(bc1[a-z0-9]{25,62}1?)/,
  btcLegacy: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  trc20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
}

export function channelError(c = {}) {
  const acc = String(c.account ?? '').trim()
  if (c.kind === 'mobile') {
    if (!/^\+?\d[\d\s().-]{6,}$/.test(acc)) return 'Numéro de téléphone invalide.'
    return null
  }
  if (c.kind === 'bank') {
    if (!acc || acc.replace(/\D/g, '').length < 6) return 'Numéro de compte invalide.'
    if (!c.bankCode && !c.label) return 'Choisissez une banque.'
    return null
  }
  if (c.kind === 'crypto') {
    if (!RX.trc20.test(acc) && !RX.erc20.test(acc) && !RX.bech32.test(acc) && !RX.btcLegacy.test(acc)) {
      return 'Adresse crypto invalide (formats : T…, 0x…, bc1…).'
    }
    if (!c.chain) return 'Choisissez un réseau.'
    if (!c.asset) return 'Choisissez l’actif du canal (USDT ou BTC).'
    return null
  }
  if (c.kind === 'lightning') {
    if (!RX.lightning.test(acc)) return 'Facture BOLT11 ou LNURL invalide.'
    return null
  }
  return 'Canal inconnu.'
}

/* ── Facture Lightning : devise & conversion ── */
export const channelCurrency = (c) =>
  c?.kind === 'crypto' ? (c.asset ?? 'USDT') : c?.kind === 'lightning' ? 'SATS' : null

export const channelRecvCurrency = (c) => channelCurrency(c) ?? null

/** Montant converti pour l'affichage « reçoit » d'un canal crypto/Lightning. */
export function cryptoReceived(channelKind, netUsd, asset = 'USDT') {
  const currency = channelKind === 'lightning' ? 'SATS' : asset
  const rate = DEMO_RATES_USD[currency] ?? 1
  const decimals = CURRENCIES[currency]?.decimals ?? 2
  return Math.round(netUsd * rate * 10 ** decimals) / 10 ** decimals
}

/* ── Partage QR ──
   Payload « PBA1.<base64url(JSON)> » : bénéficiaire + canal par défaut.
   Sont aussi reconnus au scan/collage : lightning:<bolt11|lnurl>, bitcoin:<addr>,
   adresse 0x… (ERC20), bc1… (bech32), T… (TRC20). */
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function encodeShare(beneficiary) {
  const channels = channelsOf(beneficiary)
  const payload = {
    v: 1, name: beneficiary.name, country: beneficiary.country,
    channel: channelsOf(beneficiary)[0] ?? null, channels,
  }
  return `PBA1.${b64u(JSON.stringify(payload))}`
}

export function decodeShare(text) {
  const t = String(text ?? '').trim()
  const m = /^PBA1\.([A-Za-z0-9_-]+)$/.exec(t)
  if (!m) return null
  try {
    const p = JSON.parse(unb64u(m[1]))
    if (!p?.name) return null
    return { beneficiary: { name: p.name, country: p.country ?? 'SN', channels: p.channels?.length ? p.channels : p.channel ? [p.channel] : [] } }
  } catch { return null }
}

/** Détecte un canal saisi collé (invoice Lightning, adresse on-chain…) → canal prêt à ajouter. */
export function detectChannel(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const strip = (s) => s.replace(/^[a-z]+:/i, '')
  const one = strip(t.split(/\s/)[0])
  if (RX.lightning.test(one)) return { channel: { kind: 'lightning', account: one } }
  if (RX.trc20.test(one)) return { channel: { kind: 'crypto', asset: 'USDT', chain: 'TRON', account: one } }
  if (RX.erc20.test(one)) return { channel: { kind: 'crypto', asset: 'USDT', chain: 'ETHEREUM', account: one } }
  if (RX.bech32.test(one) || RX.btcLegacy.test(one)) return { channel: { kind: 'crypto', asset: 'BTC', chain: 'BITCOIN', account: one } }
  const share = decodeShare(t)
  if (share) return share
  return null
}

/** Décode un QR depuis un fichier image (jsQR). */
export async function scanQrFile(file) {
  const bmp = await createImageBitmap(file)
  const size = Math.min(bmp.width, 640)
  const scale = size / bmp.width
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const { default: jsQR } = await import('jsqr')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(data.data, data.width, data.height)?.data ?? null
}
