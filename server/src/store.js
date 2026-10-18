/**
 * Store en mémoire (hackathon) — à remplacer par une vrai DB (Postgres / SQLite)
 * en production. Les statuts front sont : pending → processing → completed | failed.
 * Les listeners servent au flux SSE (`GET /api/events`) qui remplace le
 * clignotement simulé du prototype : le front reçoit les vrais changements d'état.
 */

/** Transferts front-first (les plus récents d'abord). */
export const transfers = []

/** Bénéficiaires — même sémantique que data/demo.js côté front. */
export const beneficiaries = [
  { id: 'b1', name: 'Kwame Mensah', country: 'GH', method: 'mobile', provider: 'MTN MoMo', account: '+233 24 ••• 4412' },
  { id: 'b2', name: 'Chiamaka Obi', country: 'NG', method: 'bank', provider: 'GTBank Nigeria', account: '0123456789', bankCode: '058' },
  { id: 'b3', name: 'Moussa Ndiaye', country: 'SN', method: 'mobile', provider: 'Wave', account: '+221 77 ••• 2208' },
  { id: 'b4', name: 'Wanjiku Kamau', country: 'KE', method: 'mobile', provider: 'M-Pesa', account: '+254 7•• ••• 118' },
  { id: 'b5', name: 'Aïcha Koné', country: 'CI', method: 'mobile', provider: 'Orange Money', account: '+225 07 ••• 5560' },
  { id: 'b6', name: 'Jean-Paul Ekané', country: 'CM', method: 'bank', provider: 'Afriland', account: '1234567890', bankCode: '00012' },
  { id: 'b7', name: 'Thandi Nkosi', country: 'ZA', method: 'bank', provider: 'FNB', account: '62834123456', bankCode: 'FNB' },
]

/** Listeners de diffusion temps réel (SSE). */
export const listeners = new Set()

/** Dé-duplication des webhooks Bitnob (eventId / event_id). */
export const seenEvents = new Set()

/** Dépôts reçus par les comptes virtuels (en kobo, comme l'API Bitnob). */
export const virtualAccountDeposits = []

export const getTransfer = (id) => transfers.find((t) => t.id === id)
export const getBeneficiary = (id) => beneficiaries.find((b) => b.id === id)

export function createTransfer(data) {
  const tx = { ...data }
  transfers.unshift(tx)
  return tx
}

export function addBeneficiary(b) {
  beneficiaries.unshift(b)
  return b
}

export function addVirtualAccountDeposit(deposit) {
  virtualAccountDeposits.unshift(deposit)
  const event = { type: 'virtual_account.deposit.success', data: deposit }
  for (const listener of listeners) {
    try { listener(event) } catch { /* client parti */ }
  }
  return deposit
}

export function byReference(reference) {
  return transfers.find((t) => t.reference === reference)
}

/**
 * Met à jour le statut, estampille `${status}At` la première fois et
 * diffuse l'évènement aux clients SSE.
 */
export function setStatus(id, status, extra = {}) {
  const tx = getTransfer(id)
  if (!tx || tx.status === status) return
  tx.status = status
  const stampKey = { pending: 'pendingAt', processing: 'processingAt', completed: 'completedAt', failed: 'failedAt' }[status]
  if (stampKey && !tx[stampKey]) tx[stampKey] = new Date().toISOString()
  Object.assign(tx, extra)
  const event = { type: 'transfer.status', data: { id, status } }
  for (const listener of listeners) {
    try { listener(event) } catch { /* client parti */ }
  }
}

/** Statut Bitnob (QUOTE/INITIATED/PENDING/PROCESSING/COMPLETED/FAILED/EXPIRED) → statut front. */
export function mapPayoutStatus(status = '') {
  const s = String(status).toUpperCase()
  if (s === 'COMPLETED') return 'completed'
  if (s === 'FAILED' || s === 'EXPIRED') return 'failed'
  if (['PENDING', 'PROCESSING', 'FUNDED'].includes(s)) return 'processing'
  return 'pending'
}
