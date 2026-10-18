import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { toUsd } from '../lib/format'
import { IS_DEMO, DEMO_RATES_USD } from '../data/demo'

const Ctx = createContext(null)

export function AppStoreProvider({ children }) {
  const [wallet, setWallet] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [deposits, setDeposits] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([])
  const timers = useRef([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Chaque source est tolérante : une route absente/indisponible (le backend
      // Render migre vers les routes Bitnob) ne doit pas vider tout le tableau de bord.
      const [w, t, b, d] = await Promise.all([
        api.getWallet().catch(() => null),
        api.getTransfers().catch(() => []),
        api.getBeneficiaries().catch(() => []),
        api.getDeposits().catch(() => []),
      ])
      setWallet(w)
      setTransfers(Array.isArray(t) ? t : [])
      setBeneficiaries(Array.isArray(b) ? b : [])
      setDeposits(Array.isArray(d) ? d : [])
      if (!w) setError('Solde indisponible : le backend n’a pas répondu (GET /api/balances).')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); return () => timers.current.forEach(clearTimeout) }, [load])

  /** Recharge uniquement le solde (appel léger) — polling, focus onglet… */
  const refreshWallet = useCallback(() => {
    if (IS_DEMO) return
    api.getWallet().then(setWallet).catch(() => {})
  }, [])

  /** Recharge les opérations reçues (dépôts on-chain + comptes virtuels). */
  const refreshDeposits = useCallback(() => {
    if (IS_DEMO) return
    api.getDeposits().then(setDeposits).catch(() => {})
  }, [])

  // Solde et dépôts en direct : polling léger + rafraîchissement au retour sur l'onglet.
  useEffect(() => {
    if (IS_DEMO) return
    const refresh = () => { refreshWallet(); refreshDeposits() }
    const id = setInterval(refresh, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshWallet, refreshDeposits])

  // Mode API : les statuts viennent du flux SSE du backend (webhooks Bitnob + polling),
  // les timers simulés ne servent plus qu'en mode démo.
  useEffect(() => {
    if (IS_DEMO) return
    return api.subscribeStatusEvents(({ id, status }) => {
      setTransfers((s) => s.map((t) => (t.id === id ? { ...t, status, [`${status}At`]: new Date().toISOString() } : t)))
      // Un solde change vraiment quand le transfert aboutit (ou échoue) → on recharge.
      if (status === 'completed' || status === 'failed') refreshWallet()
    })
  }, [refreshWallet])

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((s) => [...s, { id, tone: 'success', ...t }])
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), t.duration ?? 4200)
  }, [])
  const dismissToast = (id) => setToasts((s) => s.filter((x) => x.id !== id))

  const setStatus = (id, status) =>
    setTransfers((s) => s.map((t) => (t.id === id ? { ...t, status, [`${status}At`]: new Date().toISOString() } : t)))

  /** Crée un transfert. Démo : progression simulée ici. API : la progression
   *  vient du backend (webhooks Bitnob → SSE), le solde est rechargé. */
  const createTransfer = useCallback(async (input) => {
    const tx = await api.createTransfer(input)
    setTransfers((s) => [tx, ...s])
    if (IS_DEMO) {
      setWallet((w) => ({ ...w, balance: w.balance - tx.amount / DEMO_RATES_USD[tx.sendCurrency] }))
      timers.current.push(setTimeout(() => setStatus(tx.id, 'processing'), 2200))
      timers.current.push(setTimeout(() => setStatus(tx.id, 'completed'), 5600))
    } else {
      // Le solde Bitnob est débité à l'initiation ; en sandbox la valeur
      // disponible peut mettre quelques secondes à se recalculer → 2 passes.
      refreshWallet()
      timers.current.push(setTimeout(refreshWallet, 4000))
    }
    return tx
  }, [refreshWallet])

  const addBeneficiary = useCallback(async (input) => {
    const b = await api.createBeneficiary(input)
    setBeneficiaries((s) => [b, ...s])
    return b
  }, [])

  /** Éditer un bénéficiaire (ajout de canaux, nom, défaut…). */
  const updateBeneficiary = useCallback(async (id, input) => {
    const b = await api.updateBeneficiary(id, input)
    setBeneficiaries((s) => s.map((x) => (x.id === id ? b : x)))
    return b
  }, [])

  const stats = useMemo(() => {
    const outbound = transfers.map((t) => ({ status: t.status, amount: t.amount, currency: t.sendCurrency }))
    const inbound = deposits.map((d) => ({ status: d.status, amount: d.amount, currency: d.currency }))
    const all = [...outbound, ...inbound]
    const by = (st) => all.filter((x) => x.status === st)
    const sum = (list) => list.filter((x) => x.status !== 'failed').reduce((a, x) => a + toUsd(x.amount, x.currency), 0)
    return {
      // Volume global (envois + reçus), en USD.
      volume: sum(all),
      sent: sum(outbound),
      received: sum(inbound),
      completed: by('completed').length,
      pending: by('pending').length + by('processing').length,
      failed: by('failed').length,
    }
  }, [transfers, deposits])

  const value = {
    wallet, transfers, deposits, beneficiaries, loading, error, stats, toasts,
    reload: load, refreshWallet, refreshDeposits, toast, dismissToast, createTransfer, addBeneficiary, updateBeneficiary,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
