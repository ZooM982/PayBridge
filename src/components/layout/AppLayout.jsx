import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  LayoutDashboard, Send, Users, History, Settings, Plus, Bell, Search, FlaskConical, ShieldCheck, QrCode,
} from 'lucide-react'
import { Logo, Avatar, PoweredBy } from '../ui/Misc'
import { Button } from '../ui/Button'
import { Toaster } from '../ui/Toaster'
import { QRReceive } from '../ui/QRReceive'
import { DEMO_USER, IS_DEMO } from '../../data/demo'
import { cn } from '../../lib/format'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transferts', label: 'Transferts', icon: Send },
  { to: '/beneficiaires', label: 'Bénéficiaires', icon: Users },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
]

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-night px-4 py-6 lg:flex">
      <div className="px-2"><Logo light /></div>
      <nav className="mt-10 flex flex-col gap-1" aria-label="Navigation principale">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cn(
              'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-colors',
              isActive ? 'bg-night-700 text-white' : 'text-white/55 hover:bg-night-800 hover:text-white',
            )}>
            {({ isActive }) => (<>
              {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-volt" />}
              <Icon className={cn('size-[18px]', isActive && 'text-volt')} strokeWidth={2} />
              {label}
            </>)}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-night-700 to-night-800 p-4">
          <ShieldCheck className="size-5 text-volt" />
          <p className="mt-3 text-[13px] font-semibold text-white">Paiements sécurisés</p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/50">Frais et taux affichés avant chaque confirmation.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-1">
          <Avatar name={DEMO_USER.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{DEMO_USER.name}</p>
            <p className="truncate text-[11px] text-white/45">{DEMO_USER.business}</p>
          </div>
        </div>
        <PoweredBy className="px-2 text-white/30" />
      </div>
    </aside>
  )
}

function Topbar({ onReceive }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-mist/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden"><Logo compact /></div>
        <div className="relative hidden max-w-sm flex-1 md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
          <input aria-label="Rechercher" placeholder="Rechercher une référence, un bénéficiaire…"
            onKeyDown={(e) => e.key === 'Enter' && nav(`/historique?q=${encodeURIComponent(e.currentTarget.value)}`)}
            className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-[14px] outline-none placeholder:text-ink-mute focus:border-volt focus:ring-4 focus:ring-volt/15" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {IS_DEMO && (
            <span className="hidden items-center gap-1.5 rounded-full bg-warn-50 px-3 py-1.5 text-[12px] font-semibold text-[#B7770F] sm:inline-flex">
              <FlaskConical className="size-3.5" /> Mode démo · données fictives
            </span>
          )}
          <button aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-white">
            <Bell className="size-[18px]" />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-volt ring-2 ring-mist" />
          </button>
          <div className="hidden lg:flex items-center gap-2">
            <Button variant="outline" icon={QrCode} onClick={onReceive}>Recevoir</Button>
            <Button icon={Plus} onClick={() => nav('/transferts')}>Nouveau transfert</Button>
          </div>
        </div>
      </div>
    </header>
  )
}

function MobileNav() {
  const nav = useNavigate()
  const items = NAV.filter((n) => n.to !== '/transferts')
  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="relative grid grid-cols-5 items-center">
        {items.slice(0, 2).map((n) => <MobileItem key={n.to} {...n} />)}
        <div className="flex justify-center">
          <button onClick={() => nav('/transferts')} aria-label="Nouveau transfert"
            className="-mt-7 grid size-14 place-items-center rounded-2xl bg-volt text-night shadow-[var(--shadow-volt)] active:scale-95">
            <Plus className="size-6" strokeWidth={2.6} />
          </button>
        </div>
        {items.slice(2).map((n) => <MobileItem key={n.to} {...n} />)}
      </div>
    </nav>
  )
}
function MobileItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium', isActive ? 'text-ink' : 'text-ink-mute')}>
      {({ isActive }) => (<><Icon className={cn('size-5', isActive && 'text-volt-600')} />{label}</>)}
    </NavLink>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const main = useRef()
  const [receiveOpen, setReceiveOpen] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useGSAP(() => { gsap.fromTo(main.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }) }, { dependencies: [pathname] })

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="min-w-0 overflow-x-clip lg:pl-[260px]">
        <Topbar onReceive={() => setReceiveOpen(true)} />
        <main ref={main} className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <QRReceive open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      <Toaster />
    </div>
  )
}
