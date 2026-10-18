import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { IS_DEMO, DEMO_RATES_USD } from '../data/demo'

const Ctx = createContext(null)

export function AppStoreProvider({ children }) {
  const [wallet, setWallet] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toasts, setToasts] = useState([])
  const timers = useRef([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [w, t, b] = await Promise.all([api.getWallet(), api.getTransfers(), api.getBeneficiaries()])
      setWallet(w); setTransfers(t); setBeneficiaries(b)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); return () => timers.current.forEach(clearTimeout) }, [load])

  // Mode API : les statuts viennent du flux SSE du backend (webhooks Bitnob + polling),
  // les timers simulés ne servent plus qu'en mode démo.
  useEffect(() => {
    if (IS_DEMO) return
    return api.subscribeStatusEvents(({ id, status }) =>
      setTransfers((s) => s.map((t) => (t.id === id ? { ...t, status, [`${status}At`]: new Date().toISOString() } : t))))
  }, [])

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
      api.getWallet().then(setWallet).catch(() => {})
    }
    return tx
  }, [])

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
    const by = (st) => transfers.filter((t) => t.status === st)
    return {
      volume: transfers.filter((t) => t.status !== 'failed').reduce((a, t) => a + t.amount, 0),
      completed: by('completed').length,
      pending: by('pending').length + by('processing').length,
      failed: by('failed').length,
    }
  }, [transfers])

  const value = {
    wallet, transfers, beneficiaries, loading, error, stats, toasts,
    reload: load, toast, dismissToast, createTransfer, addBeneficiary, updateBeneficiary,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
