import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppStoreProvider } from './context/AppStore'
import { AppLayout } from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import NewTransfer from './pages/NewTransfer'
import Confirmation from './pages/Confirmation'
import History from './pages/History'
import Beneficiaries from './pages/Beneficiaries'
import Settings from './pages/Settings'

// HashRouter : fonctionne sur tout hébergement statique (Vercel, Netlify, GitHub Pages) sans réécriture d'URL.
export default function App() {
  return (
    <AppStoreProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="transferts" element={<NewTransfer />} />
            <Route path="transferts/:id" element={<Confirmation />} />
            <Route path="historique" element={<History />} />
            <Route path="beneficiaires" element={<Beneficiaries />} />
            <Route path="parametres" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppStoreProvider>
  )
}
