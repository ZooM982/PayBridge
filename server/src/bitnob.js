/**
 * Client HTTP Bitnob minimal — signature HMAC-SHA256.
 * Doc : https://bitnob.dev/api-reference/authentication
 *
 * Chaque requête est signée avec :
 *   message  = CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD
 *   signature = HMAC-SHA256(CLIENT_SECRET, message) en hexadécimal
 * Headers : X-Auth-Client, X-Auth-Timestamp, X-Auth-Nonce, X-Auth-Signature.
 * AUCUN secret ne doit remonter au front : ce fichier ne vit QUE côté serveur.
 */
import crypto from 'node:crypto'

const BASE = process.env.BITNOB_BASE_URL ?? 'https://api.bitnob.com'
const CLIENT_ID = process.env.BITNOB_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.BITNOB_CLIENT_SECRET ?? ''

export const LIVE = Boolean(CLIENT_ID && CLIENT_SECRET)

function signHeaders(payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomBytes(16).toString('hex')
  const message = `${CLIENT_ID}:${timestamp}:${nonce}:${payload}`
  const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('hex')
  return {
    'X-Auth-Client': CLIENT_ID,
    'X-Auth-Timestamp': String(timestamp),
    'X-Auth-Nonce': nonce,
    'X-Auth-Signature': signature,
  }
}

/**
 * bitnob(method, path, body?) → résout le `data` de la réponse Bitnob.
 * - GET   : `body` est sérialisé en querystring, payload signé = ''
 * - POST  : `body` est le JSON exact signé (sans espace superflu)
 */
export async function bitnob(method, path, body) {
  if (!LIVE) throw new Error('Bitnob non configuré (BITNOB_CLIENT_ID / BITNOB_CLIENT_SECRET)')

  const payload = ['POST', 'PUT', 'PATCH'].includes(method) && body ? JSON.stringify(body) : ''
  const url = method === 'GET' && body
    ? `${BASE}${path}?${new URLSearchParams(body)}`
    : `${BASE}${path}`

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...signHeaders(payload) },
    body: payload || undefined,
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    console.error(`[Bitnob] ${method} ${path} → ${res.status}`, JSON.stringify(json))
    throw Object.assign(new Error(json.message ?? json.detail ?? `Bitnob HTTP ${res.status}`), {
      status: res.status,
      detail: json,
    })
  }
  return json.data ?? json
}
