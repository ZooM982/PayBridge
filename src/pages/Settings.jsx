import { useState } from 'react'
import { User, ShieldCheck, Bell, Plug, FlaskConical, Globe2 } from 'lucide-react'
import { useStore } from '../context/AppStore'
import { useReveal } from '../hooks/useMotion'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { Avatar, PoweredBy } from '../components/ui/Misc'
import { PageHeader } from '../components/layout/PageHeader'
import { DEMO_USER, IS_DEMO } from '../data/demo'
import { cn } from '../lib/format'

function Toggle({ label, desc, defaultOn }) {
  const [on, setOn] = useState(!!defaultOn)
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div><p className="text-[14px] font-semibold">{label}</p><p className="text-[12px] text-ink-mute">{desc}</p></div>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => setOn(!on)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-volt' : 'bg-line')}>
        <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

export default function Settings() {
  const { toast } = useStore()
  const [saving, setSaving] = useState(false)
  const scope = useReveal()
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); toast({ title: 'Paramètres enregistrés' }) }, 700) }

  return (
    <div ref={scope}>
      <PageHeader eyebrow="Paramètres" title="Compte & préférences" subtitle="Gérez votre profil, la sécurité et les intégrations." />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card data-reveal>
            <CardHeader title="Profil" subtitle="Informations de votre activité" action={<User className="size-5 text-ink-mute" />} />
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-4"><Avatar name={DEMO_USER.name} size="lg" />
                <div><p className="font-semibold">{DEMO_USER.name}</p><p className="text-[13px] text-ink-mute">{DEMO_USER.email}</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom complet"><Input defaultValue={DEMO_USER.name} /></Field>
                <Field label="Entreprise"><Input defaultValue={DEMO_USER.business} /></Field>
                <Field label="Pays de résidence"><Select defaultValue="SN"><option value="SN">🇸🇳  Sénégal</option><option value="CI">🇨🇮  Côte d'Ivoire</option></Select></Field>
                <Field label="Devise par défaut"><Select defaultValue="USD"><option>USD</option><option>EUR</option><option>XOF</option></Select></Field>
              </div>
              <div className="mt-5 flex justify-end"><Button loading={saving} onClick={save}>Enregistrer</Button></div>
            </div>
          </Card>
          <Card data-reveal>
            <CardHeader title="Sécurité" action={<ShieldCheck className="size-5 text-ink-mute" />} />
            <div className="divide-y divide-line px-5 pb-2 sm:px-6">
              <Toggle label="Double authentification" desc="Code requis à chaque connexion" defaultOn />
              <Toggle label="Confirmation des transferts" desc="Code requis au-delà de 1 000 $" defaultOn />
              <Toggle label="Connexion biométrique" desc="Sur l'application mobile" />
            </div>
          </Card>
          <Card data-reveal>
            <CardHeader title="Notifications" action={<Bell className="size-5 text-ink-mute" />} />
            <div className="divide-y divide-line px-5 pb-2 sm:px-6">
              <Toggle label="Statut des transferts" desc="E-mail et push à chaque changement" defaultOn />
              <Toggle label="Alertes de taux" desc="Quand un taux cible est atteint" />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card data-reveal className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><Plug className="size-5 text-ink-soft" /><h3 className="font-semibold">Intégration paiements</h3></div>
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-soft">Mode</span>
                <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold', IS_DEMO ? 'bg-warn-50 text-[#B7770F]' : 'bg-volt-50 text-volt-600')}>
                  {IS_DEMO ? <><FlaskConical className="size-3.5" />Démo</> : 'Production'}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Backend</span><span className="font-mono text-[12px]">{import.meta.env.VITE_API_URL ?? '/api'}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Fournisseur</span><span className="font-semibold">Bitnob (via Express)</span></div>
            </div>
            <p className="mt-4 rounded-xl bg-mist p-3 text-[12px] leading-relaxed text-ink-soft">
              Les clés API ne transitent jamais par le navigateur : le front appelle uniquement votre serveur Express, qui signe les requêtes vers Bitnob.
            </p>
            <PoweredBy className="mt-4" />
          </Card>
          <Card data-reveal className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><Globe2 className="size-5 text-ink-soft" /><h3 className="font-semibold">Langue & région</h3></div>
            <div className="mt-4 space-y-3">
              <Select defaultValue="fr"><option value="fr">Français</option><option value="en">English</option></Select>
              <Select defaultValue="dakar"><option value="dakar">Africa/Dakar (UTC+0)</option><option value="lagos">Africa/Lagos (UTC+1)</option></Select>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
