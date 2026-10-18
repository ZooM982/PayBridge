/**
 * Disponibilité des canaux de réception par corridor.
 *
 * Miroir front de server/src/index.js (FIAT_CORRIDORS / CRYPTO_CHAINS), lui-même
 * un snapshot de l'API Bitnob :
 *   - GET /api/payouts/supported-countries        → rails fiat par corridor
 *   - GET /api/stablecoins/supported-chains        → réseaux on-chain + actifs
 *
 * Objectif : ne jamais laisser l'utilisateur choisir un canal que Bitnob
 * refusera (`Invalid beneficiary destination`) — on le signale en amont.
 */

/** Rails fiat autorisés par pays de réception (miroir de FIAT_CORRIDORS). */
export const FIAT_RAILS = {
  SN: { mobile: true, bank: false },   // XOF : mobile money uniquement
  CI: { mobile: true, bank: false },   // XOF : mobile money uniquement
  NG: { mobile: false, bank: true },   // NGN : virement bancaire uniquement
  GH: { mobile: true, bank: true },    // GHS : mobile money + banque
  KE: { mobile: true, bank: false },   // KES : mobile money / paybill / paytill
  CM: { mobile: true, bank: false },   // XAF : mobile money uniquement
  ZA: { mobile: false, bank: true },   // ZAR : bank / swift
  FR: { mobile: false, bank: true },
  US: { mobile: false, bank: true },
}

/** Réseaux on-chain supportés par l'API Stablecoins (miroir de CRYPTO_CHAINS). */
export const CRYPTO_NETWORKS = {
  BITCOIN: ['BTC'],
  ETHEREUM: ['USDT', 'USDC'],
  OPTIMISM: ['USDT', 'USDC'],
  POLYGON: ['USDT', 'USDC'],
  BASE: ['USDC'],
  SOLANA: ['USDT', 'USDC'],
  STELLAR: ['USDC'],
}

const chainKey = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z]/g, '')

const CRYPTO_ASSET_CODES = /^(BTC|USDT|USDC)$/

/**
 * Actif on-chain réellement envoyé. Il suit le portefeuille débité (ex. un wallet
 * USDC vers un canal ETH part en USDC) ; on retombe sur l'actif du canal seulement
 * si la devise n'est pas un actif crypto (mode démo : portefeuilles USD/EUR).
 * Miroir de `createCryptoTransfer` côté serveur.
 */
export function effectiveCryptoAsset(channel, sendCurrency) {
  const send = String(sendCurrency ?? '').toUpperCase()
  if (CRYPTO_ASSET_CODES.test(send)) return send
  return String(channel?.asset ?? 'USDT').toUpperCase()
}

/**
 * Un canal peut-il recevoir un paiement depuis le corridor `countryCode`, en
 * débitant `sendCurrency` ? → { ok, reason? } — `reason` à afficher si non supporté.
 */
export function channelSupport(channel, countryCode, sendCurrency) {
  if (!channel?.kind) return { ok: true }

  if (channel.kind === 'lightning') return { ok: true }

  if (channel.kind === 'crypto') {
    const asset = effectiveCryptoAsset(channel, sendCurrency)
    const key = chainKey(channel.chain ?? (asset === 'BTC' ? 'BITCOIN' : 'ETHEREUM'))
    const assets = CRYPTO_NETWORKS[key]
    if (!assets) {
      return { ok: false, reason: `Réseau ${channel.chain ?? '—'} non supporté pour un envoi on-chain (autorisés : ${Object.keys(CRYPTO_NETWORKS).join(', ')}).` }
    }
    if (!assets.includes(asset)) {
      return { ok: false, reason: `Le réseau ${key} n'accepte que ${assets.join(', ')} : débitez un portefeuille compatible (actif envoyé : ${asset}).` }
    }
    return { ok: true }
  }

  const rails = FIAT_RAILS[countryCode]
  if (!rails) return { ok: true }
  const ok = channel.kind === 'mobile' ? rails.mobile : rails.bank
  if (ok) return { ok: true }
  const label = channel.kind === 'mobile' ? 'Mobile Money' : 'virement bancaire'
  const other = channel.kind === 'mobile' ? 'virement bancaire' : 'Mobile Money'
  return { ok: false, reason: `Bitnob ne reçoit pas de ${label} vers ${countryCode} — utilisez le ${other}.` }
}
