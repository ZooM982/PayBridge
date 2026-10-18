import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Send, ShieldCheck, Smartphone, Bitcoin, Wallet,
  Users, Globe, Clock, Zap, CheckCircle2,
} from 'lucide-react'
import { Button } from '../components/ui/Button'

const features = [
  { icon: Send, label: 'Transferts internationaux', text: 'Envoyez de l\'argent vers l\'Afrique en quelques clics, avec des frais affichés avant chaque confirmation.' },
  { icon: Smartphone, label: 'Mobile Money', text: 'Portefeuilles mobiles (Orange Money, MTN MoMo, Wave, Free, Expresso…) et virements bancaires locaux.' },
  { icon: Bitcoin, label: 'Crypto & Lightning', text: 'USDT sur TRON/ETHEREUM, BTC sur Bitcoin, et factures Lightning pour des paiements instantanés.' },
  { icon: ShieldCheck, label: 'Sécurisé', text: 'Vérification des titulaires et validation des adresses avant chaque envoi.' },
  { icon: Wallet, label: 'Multi-devises', text: 'Solde en USD, USDC, USDT et BTC avec taux de change en temps réel.' },
  { icon: Users, label: 'Bénéficiaires', text: 'Enregistrez plusieurs canaux de réception par bénéficiaire et partagez-les par QR code.' },
]

const stats = [
  { value: '0%', label: 'Frais cachés' },
  { value: '< 60s', label: 'Délai moyen' },
  { value: '24/7', label: 'Disponible' },
]

const steps = [
  { num: '01', n: 1, title: 'Créez votre compte', text: 'Inscrivez-vous et accédez à votre tableau de bord avec solde multi-devises.' },
  { num: '02', n: 2, title: 'Ajoutez un bénéficiaire', text: 'Enregistrez son nom, son pays et ses canaux de réception (Mobile Money, banque, crypto…).' },
  { num: '03', n: 3, title: 'Envoyez le paiement', text: 'Saisissez le montant, confirmez les frais, et le destinataire reçoit ses fonds en moins de 60 secondes.' },
]

const securityBadges = [
  { icon: ShieldCheck, label: 'Vérification KYC' },
  { icon: Globe, label: 'Réseau mondial' },
  { icon: Clock, label: 'Envoi rapide' },
  { icon: Zap, label: 'Lightning Network' },
]

export default function Landing() {
  const nav = useNavigate()
  const scrollTo = (id) => (e) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-dvh flex flex-col bg-night text-white">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-night/75 backdrop-blur-xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => nav('/')}>
            <span className="grid size-9 place-items-center rounded-xl bg-volt shadow-[0_0_18px_rgba(0,214,143,0.35)]">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#0B1220" strokeWidth="2.6" strokeLinecap="round">
                <path d="M4 16c3.5-7 12.5-7 16 0" /><path d="M4 16v3M20 16v3M12 10.5V19" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight">PayBridge</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Africa</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-white/60">
            <a href="#fonctionnalites" onClick={scrollTo('fonctionnalites')} className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#comment-ca-marche" onClick={scrollTo('comment-ca-marche')} className="hover:text-white transition-colors">Comment ça marche</a>
            <a href="#securite" onClick={scrollTo('securite')} className="hover:text-white transition-colors">Sécurité</a>
          </div>

          <Button onClick={() => nav('/dashboard')} className="text-[14px]">
            Se connecter
          </Button>
        </div>
      </nav>

      <main className="flex-1 relative overflow-x-hidden">

        {/* ── Décor arrière-plan ─────────────────────────── */}
        <div className="pointer-events-none select-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
          <div className="absolute -top-40 left-1/4 w-[800px] h-[800px] rounded-full bg-volt/10 blur-[140px] animate-float" />
          <div className="absolute top-60 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] animate-float-delay" />
          <div className="absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full bg-emerald-400/5 blur-[160px] animate-float-slow" />
        </div>

        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 lg:pt-36 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-16 items-center">

            {/* Texte gauche */}
            <div className="max-w-[560px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-volt/10 border border-volt/20 px-3 py-1 text-[12px] font-semibold text-volt mb-7">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-volt opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-volt" />
                </span>
                En ligne · Transferts temps réel
              </span>

              <h1 className="mb-5 font-bold leading-[1.06] tracking-tight">
                <span className="block text-[46px] sm:text-[58px] lg:text-[66px]">Envoyez de l'argent</span>
                <span className="block text-[46px] sm:text-[58px] lg:text-[66px]">en Afrique,</span>
                <span className="block text-[46px] sm:text-[58px] lg:text-[66px] text-volt">simplement.</span>
              </h1>

              <p className="mb-9 text-[17px] text-white/50 leading-[1.7] max-w-[480px]">
                PayBridge connecte votre compte aux réseaux de paiement africains — Mobile Money, virement bancaire, crypto et Lightning. Frais transparents, délai réel.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Button size="lg" icon={ArrowRight} onClick={() => nav('/dashboard')}>
                  Commencer gratuitement
                </Button>
                <button
                  onClick={() => nav('/dashboard')}
                  className="h-12 px-5 rounded-xl text-[14px] font-medium text-white/50 hover:text-white transition-colors"
                >
                  Voir la démo
                </button>
              </div>
            </div>

            {/* Carte de transfert droite */}
            <div className="relative flex justify-center lg:justify-end w-full lg:w-auto">

              {/* Notification succès — flotte décalée */}
              <div className="absolute -top-6 -left-4 sm:-left-10 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-volt/20 bg-night-800/90 backdrop-blur-sm shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4)] animate-float-delay">
                <CheckCircle2 className="size-4 text-volt shrink-0" />
                <div>
                  <div className="text-[12px] font-semibold">Paiement reçu</div>
                  <div className="text-[11px] text-white/40">302 500 FCFA · Wave SN</div>
                </div>
              </div>

              {/* Carte principale */}
              <div className="relative w-[320px] sm:w-[350px] p-6 rounded-[22px] border border-white/10 bg-night-800/70 backdrop-blur-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] animate-float">

                <div className="flex items-center justify-between mb-6">
                  <span className="text-[11px] font-medium text-white/30 tracking-wide">Nouveau transfert</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-volt bg-volt/10 px-2.5 py-1 rounded-full border border-volt/15">
                    <span className="size-1.5 rounded-full bg-volt" />
                    Live
                  </span>
                </div>

                <div className="mb-6">
                  <div className="text-[44px] font-bold tracking-tight leading-none">$500</div>
                  <div className="flex items-center gap-2 mt-2 text-[13px] text-white/35">
                    <span>→</span>
                    <span className="font-semibold text-volt">302 500 FCFA</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 mb-5">
                  <div
                    className="size-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg,rgba(0,214,143,.2),rgba(0,214,143,.06))', color: '#00D68F', border: '1px solid rgba(0,214,143,.2)' }}
                  >MD</div>
                  <div>
                    <div className="text-[13px] font-semibold">Mohamed Diallo</div>
                    <div className="text-[11px] text-white/40">🇸🇳 Wave · Sénégal</div>
                  </div>
                </div>

                <div className="space-y-2 py-4 border-t border-b border-white/10 mb-5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-white/35">Taux de change</span>
                    <span className="text-white/60">605 FCFA / $1</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-white/35">Frais</span>
                    <span className="font-semibold text-volt">$0,00</span>
                  </div>
                </div>

                <button className="w-full h-11 rounded-xl bg-volt text-night text-[14px] font-bold hover:brightness-110 transition-all shadow-[0_4px_16px_-4px_rgba(0,214,143,0.5)]">
                  Confirmer l'envoi
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="relative z-10 border-y border-white/10">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <dl className="grid grid-cols-3 divide-x divide-white/10">
              {stats.map((s) => (
                <div key={s.value} className="flex flex-col items-center gap-1 px-4 text-center">
                  <dt className="text-[13px] text-white/40 order-2">{s.label}</dt>
                  <dd className="text-[38px] sm:text-[50px] font-bold tracking-tight leading-none order-1 tabular">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* ── Fonctionnalités — bento ────────────────────────── */}
        <section id="fonctionnalites" className="py-24 relative z-10">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-14 max-w-xl">
              <h2 className="text-[30px] sm:text-[42px] font-bold tracking-tight leading-[1.08] mb-3">
                Tout ce dont vous avez besoin<br className="hidden sm:block" /> pour payer en Afrique
              </h2>
              <p className="text-white/45 text-[15px] leading-relaxed">
                Plusieurs canaux par bénéficiaire, devises multiples, envoi sécurisé.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.slice(0, 2).map((f) => (
                <div
                  key={f.label}
                  className="lg:col-span-2 p-7 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300 cursor-default group"
                >
                  <div className="mb-5 grid size-12 place-items-center rounded-xl bg-white/10 text-white/60 group-hover:bg-volt/15 group-hover:text-volt transition-all duration-300">
                    <f.icon className="size-6" />
                  </div>
                  <h3 className="mb-2 text-[17px] font-semibold">{f.label}</h3>
                  <p className="text-[14px] text-white/45 leading-relaxed">{f.text}</p>
                </div>
              ))}

              {features.slice(2).map((f) => (
                <div
                  key={f.label}
                  className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300 cursor-default group"
                >
                  <div className="mb-4 grid size-10 place-items-center rounded-xl bg-white/10 text-white/60 group-hover:bg-volt/15 group-hover:text-volt transition-all duration-300">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="mb-1.5 text-[15px] font-semibold">{f.label}</h3>
                  <p className="text-[13px] text-white/45 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comment ça marche ──────────────────────────────── */}
        <section id="comment-ca-marche" className="py-24 border-t border-white/10 relative z-10">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-14 max-w-xl">
              <h2 className="text-[30px] sm:text-[42px] font-bold tracking-tight leading-[1.08] mb-3">
                Comment ça marche
              </h2>
              <p className="text-white/45 text-[15px]">
                Créez un bénéficiaire, choisissez un canal, envoyez.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.num} className="relative p-7 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  {/* Numéro décoratif en arrière-plan */}
                  <span
                    className="absolute right-4 bottom-2 font-black leading-none select-none text-white/[0.04]"
                    style={{ fontSize: '110px' }}
                  >
                    {step.n}
                  </span>
                  <div className="relative">
                    <div className="inline-flex size-8 items-center justify-center rounded-full bg-volt text-night text-[12px] font-bold mb-5 shadow-[0_0_18px_rgba(0,214,143,0.4)]">
                      {step.num}
                    </div>
                    <h3 className="mb-2 text-[16px] font-semibold">{step.title}</h3>
                    <p className="text-[14px] text-white/45 leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sécurité ──────────────────────────────────────── */}
        <section id="securite" className="py-24 border-t border-white/10 relative z-10">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-14 md:grid-cols-2 items-center">
              <div>
                <h2 className="text-[30px] sm:text-[42px] font-bold tracking-tight leading-[1.08] mb-5">
                  Sécurité et conformité
                </h2>
                <p className="text-white/50 leading-relaxed mb-8 text-[15px]">
                  Chaque bénéficiaire est vérifié avant le premier envoi. Les adresses crypto sont contrôlées, les factures Lightning vérifiées, et les titulaires confirmés via le rail de paiement.
                </p>
                <ul className="space-y-4">
                  {[
                    'Vérification des titulaires de compte',
                    'Validation des adresses on-chain et Lightning',
                    'Frais et taux affichés avant confirmation',
                    'Données fictives en mode démo — aucune transaction réelle',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[14px] text-white/55 leading-relaxed">
                      <CheckCircle2 className="mt-0.5 size-5 text-volt shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {securityBadges.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="relative p-5 rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300"
                  >
                    {/* Ligne volt en haut */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-volt/50 to-transparent" />
                    <Icon className="mb-3 size-6 text-volt" />
                    <p className="text-[13px] font-medium text-white/65">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Final ─────────────────────────────────────── */}
        <section className="py-24 relative z-10">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-night-700/50 backdrop-blur-sm p-12 md:p-20 text-center">
              {/* Grille volt subtile */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,214,143,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,214,143,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
              {/* Ligne volt en haut + halo */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-volt to-transparent" />
              <div className="absolute inset-x-24 top-0 h-32 bg-volt/5 blur-3xl" />

              <div className="relative">
                <h2 className="mb-4 text-[28px] sm:text-[42px] font-bold tracking-tight leading-[1.08]">
                  Prêt à envoyer votre premier paiement ?
                </h2>
                <p className="mb-10 text-white/45 text-[16px] max-w-md mx-auto leading-relaxed">
                  Rejoignez les entreprises qui paient l'Afrique en toute simplicité.
                </p>
                <Button size="lg" icon={ArrowRight} onClick={() => nav('/dashboard')}>
                  Accéder au tableau de bord
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 relative z-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-volt">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="#0B1220" strokeWidth="2.6" strokeLinecap="round">
                <path d="M4 16c3.5-7 12.5-7 16 0" /><path d="M4 16v3M20 16v3M12 10.5V19" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[14px] font-bold tracking-tight">PayBridge</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Africa</p>
            </div>
          </div>
          <p className="text-[12px] text-white/30">
            PayBridge Africa · Mode démo · Données fictives — aucune transaction réelle
          </p>
        </div>
      </footer>
    </div>
  )
}
