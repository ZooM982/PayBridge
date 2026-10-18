import { readFileSync } from 'node:fs'

/**
 * Chargeur .env minimaliste (sans dépendance).
 * Charge .env.local en priorité, puis .env comme fallback.
 * Ne surcharge jamais une variable déjà présente dans l'environnement.
 */
function loadEnvFile(filename) {
  try {
    for (const line of readFileSync(new URL(filename, import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
    }
  } catch {
    /* fichier absent : on continue */
  }
}

loadEnvFile('../.env.local') // priorité (valeurs locales)
loadEnvFile('../.env')       // fallback (valeurs par défaut)
