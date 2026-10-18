import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCode } from 'qrcode'
import {
  UserPlus, Search, Send, Smartphone, Landmark, Users, BadgeCheck, QrCode, Pencil, Trash2, Zap, Bitcoin, Copy, ScanLine, X,
} from 'lucide-react'
import { useStore } from '../context/AppStore'
import { api } from '../services/api'
import { useReveal } from '../hooks/useMotion'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { Avatar, EmptyState, Flag, Skeleton } from '../components/ui/Misc'
import { Drawer } from '../components/ui/Drawer'
import { PageHeader } from '../components/layout/PageHeader'
import { COUNTRIES } from '../data/demo'
import { country, cn, money } from '../lib/format'
import {
  CHANNEL_KINDS, channelsOf, channelTitle, channelAccount, channelError, encodeShare, decodeShare, detectChannel, scanQrFile,
} from '../lib/channels'

const RECEIVERS = COUNTRIES.filter((c) => !['FR', 'US'].includes(c.code))
const CRYPTO_CHAINS = ['TRON', 'ETHEREUM', 'BITCOIN']
/** Opérateurs mobile money proposés (doit rester synchrone avec le <Select>). */
const MOBILE_PROVIDERS = ['Wave', 'Orange Money', 'MTN MoMo', 'M-Pesa']
/** Canal mobile neuf : l'opérateur par défaut est posé DANS l'état.
 *  Sinon `build.label` reste `undefined` alors que le <Select> affiche « Wave » :
 *  l'Account Lookup partait avec un `bankCode` vide et le backend répondait 400. */
const newMobileBuild = () => ({ kind: 'mobile', label: MOBILE_PROVIDERS[0] })
/** Code opérateur/banque envoyé au lookup — jamais vide, le backend l'exige. */
const bankCodeOf = (value, fallback) => {
  const code = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_')
  return code || fallback
}
/** L'Account Lookup Bitnob n'est exposé que sur certains corridors (NG/GH) : ailleurs
 *  l'API renvoie une erreur de validation. On l'explique au lieu d'afficher la
 *  réponse brute de Bitnob — le canal reste ajoutable sans vérification. */
const lookupMessage = (err, country) => {
  const raw = String(err?.message ?? '')
  if (/unable to verify|validation|not supported|not found/i.test(raw) || !raw) {
    return `Vérification du titulaire non disponible pour ce corridor (${country}). Vous pouvez ajouter le canal sans vérification.`
  }
  return raw
}

const KIND_ICON = { mobile: Smartphone, bank: Landmark, crypto: Bitcoin, lightning: Zap }

/** Puce compacte d'un canal. */
function ChannelChip({ ch, defaultBadge }) {
  const Icon = KIND_ICON[ch.kind] ?? Users
  return (
    <div className="flex items-center gap-2 rounded-xl bg-mist px-3 py-2 text-[13px]">
      <Icon className="size-4 shrink-0 text-ink-soft" />
      <span className="truncate font-semibold">{channelTitle(ch)}</span>
      {defaultBadge && ch.isDefault && <span className="shrink-0 rounded-md bg-night px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Défaut</span>}
      <span className="ml-auto truncate font-mono text-[12px] text-ink-mute">{channelAccount(ch)}</span>
    </div>
  )
}

/** Partage QR : encode le bénéficiaire + ses canaux en payload PBA1. */
function QrShareDrawer({ open, onClose, beneficiary }) {
  const { toast } = useStore()
  const [src, setSrc] = useState(null)
  const payload = beneficiary ? encodeShare(beneficiary) : null
  useEffect(() => {
    if (!open || !beneficiary) return
    QRCode.toDataURL(payload, { margin: 2, width: 440, color: { dark: '#0B1220', light: '#FFFFFF' } })
      .then(setSrc).catch(() => setSrc(null))
  }, [open, payload])
  return (
    <Drawer open={open} onClose={onClose} title="Partager par QR"
      footer={<Button className="w-full" icon={Copy} onClick={() => { navigator.clipboard?.writeText(payload); toast({ title: 'Payload copié', text: 'Collez-le sur un autre appareil.', tone: 'info' }) }}>Copier le payload</Button>}>
      <div className="flex flex-col items-center text-center">
        <Avatar name={beneficiary?.name ?? ''} size="lg" />
        <p className="mt-3 font-semibold">{beneficiary?.name}</p>
        <p className="text-[13px] text-ink-mute">Ce QR contient ses canaux de réception (démo : canal par défaut).</p>
        <div className="mt-5 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          {src ? <img src={src} alt="QR du bénéficiaire" className="size-56 rounded-xl" /> : <div className="grid size-56 place-items-center rounded-xl bg-mist text-[12px] text-ink-mute">Génération…</div>}
        </div>
      </div>
    </Drawer>
  )
}

/** Éditeur d'un canal (onglet mobile / banque / crypto / lightning). */
function ChannelBuilder({ build, set, banks, check, setCheck }) {
  const kind = build.kind
  if (kind === 'mobile') return (
    <div className="grid gap-2">
      <Field label="Opérateur" htmlFor="chp">
        <Select id="chp" value={build.label ?? ''} onChange={(e) => set({ ...build, label: e.target.value })}>
          {MOBILE_PROVIDERS.map((p) => <option key={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label="Numéro de téléphone" htmlFor="cha" hint="Format international ex. +221 77 000 00 00">
        <Input id="cha" value={build.account ?? ''} inputMode="tel" onChange={(e) => set({ ...build, account: e.target.value })} placeholder="+221 77 000 00 00" />
      </Field>
      <VerifyRow state={check} onVerify={check.onVerify} label="Vérifier" />
    </div>
  )
  if (kind === 'bank') return (
    <div className="grid gap-2">
      <Field label="Banque" htmlFor="chb">
        <Select id="chb" value={build.bankCode ?? ''} onChange={(e) => {
          const b = banks.find((x) => x.code === e.target.value)
          set({ ...build, bankCode: e.target.value, label: b?.name ?? build.label })
        }}>
          {banks.length === 0 && <option value="">Chargement…</option>}
          {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="Numéro de compte (IBAN / RIB)" htmlFor="chba">
        <Input id="chba" value={build.account ?? ''} onChange={(e) => set({ ...build, account: e.target.value })} placeholder="SN08 0000 0000 0000" />
      </Field>
      <VerifyRow state={check} onVerify={check.onVerify} label="Vérifier le titulaire" />
    </div>
  )
  if (kind === 'crypto') return (
    <div className="grid gap-2">
      <Field label="Réseau" htmlFor="chc">
        <Select id="chc" value={build.chain ?? 'TRON'} onChange={(e) => set({ ...build, chain: e.target.value, asset: e.target.value === 'BITCOIN' ? 'BTC' : 'USDT' })}>
          {CRYPTO_CHAINS.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Adresse du portefeuille" htmlFor="chca" hint={build.chain === 'TRON' ? 'Adresse TRC20 (commence par T…)' : build.chain === 'ETHEREUM' ? 'Adresse ERC20 (0x…)' : 'Adresse Bitcoin (bc1…)'}>
        <Input id="chca" className="font-mono text-[13px]" value={build.account ?? ''} onChange={(e) => set({ ...build, account: e.target.value.trim() })} placeholder="TNn9Y2BMF7kZ1p5V4rd4KkzXQmE8UXpVvT" />
      </Field>
      <VerifyRow state={check} onVerify={check.onVerify} label="Valider l'adresse" />
    </div>
  )
  return (
    <div className="grid gap-2">
      <Field label="Facture BOLT11 / LNURL" htmlFor="chl" hint="Encode le montant, la destination et l'expiration du paiement">
        <Input id="chl" className="font-mono text-[13px]" value={build.account ?? ''} onChange={(e) => set({ ...build, account: e.target.value.trim() })} placeholder="lnbc1000000n1…" />
      </Field>
      <VerifyRow state={check} onVerify={check.onVerify} label="Décoder la facture" />
    </div>
  )
}

/** Ligne de vérification partagée (Account Lookup / Validate / Decode). */
function VerifyRow({ state, onVerify, label }) {
  return (
    <>
      <div>
        <Button type="button" variant="outline" className="w-full" onClick={onVerify} loading={state.state === 'loading'} disabled={state.state === 'verified'}>
          {state.state === 'verified' ? <><BadgeCheck className="size-4" /> Canal vérifié</> : label}
        </Button>
      </div>
      {state.state === 'verified' && (
        <p className="flex items-center gap-1.5 rounded-xl bg-volt-50 px-3 py-2 text-[12px] font-semibold text-volt-600">
          <BadgeCheck className="size-4 shrink-0" /> {state.holder ?? 'Vérifié par le rail de paiement.'}
        </p>
      )}
      {state.state === 'error' && (
        <p className="rounded-xl bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger">{state.message}</p>
      )}
    </>
  )
}

function AddDrawer({ open, onClose, defaultCountry, beneficiary }) {
  const nav = useNavigate()
  const { addBeneficiary, updateBeneficiary, toast } = useStore()
  const editing = Boolean(beneficiary)
  const [name, setName] = useState('')
  const [ctry, setCtry] = useState('SN')
  const [channels, setChannels] = useState([])
  const [build, setBuild] = useState(newMobileBuild)
  const [banks, setBanks] = useState([])
  const [check, setCheck] = useState({ state: 'idle', holder: null, message: null, onVerify: () => {} })
  const [paste, setPaste] = useState('')
  const [pasted, setPasted] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(beneficiary?.name ?? '')
    setCtry(beneficiary?.country ?? defaultCountry ?? 'SN')
    setChannels(beneficiary ? [...channelsOf(beneficiary)] : [])
    setBuild(newMobileBuild())
    setPasted(null)
    setPaste('')
    setCheck({ state: 'idle', holder: null, message: null, onVerify: () => {} })
  }, [open, beneficiary, defaultCountry])

  useEffect(() => {
    if (!open) return
    api.getBanks(ctry).then((r) => setBanks(r.banks ?? [])).catch(() => setBanks([]))
  }, [open, ctry])

  /** Vérification du canal courant selon son rail (Account Lookup / Validate / Decode). */
  const verifyChannel = () => {
    setCheck({ state: 'loading' })
    const task = build.kind === 'mobile'
      ? api.lookupAccount({ country: ctry, accountNumber: build.account, bankCode: bankCodeOf(build.label, 'MOBILE_MONEY'), method: 'mobile' })
        .then((r) => ({ holder: `Titulaire : ${r.accountName}` }))
      : build.kind === 'bank'
        ? api.lookupAccount({ country: ctry, accountNumber: build.account, bankCode: bankCodeOf(build.bankCode, 'DEFAULT'), method: 'bank' })
          .then((r) => ({ holder: `Titulaire : ${r.accountName}` }))
        : build.kind === 'crypto'
          ? api.validateAddress({ address: build.account, chain: (build.chain ?? 'TRON').toLowerCase() })
            .then((r) => ({ holder: r.valid ? `Adresse valide · ${build.chain}` : null }))
          : api.decodeLightning({ request: build.account })
            .then((r) => ({ holder: r.isExpired ? 'Facture expirée' : `${r.amountSat.toLocaleString('fr-FR')} sats · ${r.description}` }))
    task
      .then((r) => setCheck({ state: r.holder ? 'verified' : 'error', holder: r.holder, message: r.holder ? null : 'Aucun canal valide côté rail de paiement.', onVerify: verifyChannel }))
      .catch((e) => setCheck({
        state: 'error',
        holder: null,
        message: build.kind === 'mobile' || build.kind === 'bank' ? lookupMessage(e, ctry) : e.message,
        onVerify: verifyChannel,
      }))
  }
  const setBuildSafe = (next) => { setBuild(next); setCheck({ state: 'idle', onVerify: verifyChannel }) }

  const addChannel = () => {
    const err = channelError(build)
    if (err) { setCheck({ state: 'error', holder: null, message: err, onVerify: verifyChannel }); return }
    const ch = { id: `tmp-${Date.now()}`, ...build, isDefault: channels.length === 0 }
    setChannels((s) => [...s, ch])
    setBuild(newMobileBuild())
    setCheck({ state: 'idle', onVerify: verifyChannel })
  }

  /** Décodage d'un payload PayBridge / BOLT11 / adresse crypto (coller ou image QR). */
  const importPayload = async (raw) => {
    const text = raw ?? paste
    const res = detectChannel(text)
    if (!res?.beneficiary && !res?.channel) {
      setPasted({ ok: false, message: 'Contenu non reconnu (attendu : payload PBA1, BOLT11/LNURL ou adresse on-chain).' })
      return
    }
    if (res.beneficiary) {
      if (!editing && !name) setName(res.beneficiary.name)
      if (!beneficiary) setCtry(res.beneficiary.country ?? ctry)
      setChannels(res.beneficiary.channels.map((c, i) => ({ id: `imp-${Date.now()}-${i}`, ...c, isDefault: channels.length === 0 ? true : !!c.isDefault })))
      setPasted({ ok: true, message: `Bénéficiaire « ${res.beneficiary.name} » importé avec ${res.beneficiary.channels.length} canal(aux).` })
      return
    }
    setBuild({ ...res.channel })
    if (!channels.length && CHANNEL_KINDS[res.channel.kind]) { /* reste sur le builder pour compléter */ }
    setPasted({ ok: true, message: `Canal détecté : ${CHANNEL_KINDS[res.channel.kind].label}. Complétez puis « Ajouter ce canal ».` })
  }

  const save = async () => {
    if (!editing) {
      if (name.trim().length < 3) { toast({ title: 'Nom requis', text: 'Indiquez le nom complet.', tone: 'error' }); return }
    }
    if (!channels.length) { toast({ title: 'Canal requis', text: 'Ajoutez au moins un canal de réception.', tone: 'error' }); return }
    setSaving(true)
    try {
      const first = channels[0]
      const base = {
        name: (name || beneficiary?.name).trim(),
        country: ctry,
        channels,
        // champs de compat (histoires/profil) dérivés du canal par défaut
        method: first.kind,
        provider: channelTitle(first),
        account: channelAccount(first),
        ...(first.bankCode ? { bankCode: first.bankCode } : {}),
      }
      const b = editing ? await updateBeneficiary(beneficiary.id, { ...beneficiary, ...base }) : await addBeneficiary(base)
      setSaving(false); onClose()
      toast({ title: editing ? 'Bénéficiaire mis à jour' : 'Bénéficiaire ajouté', text: `${b.name} · ${channels.length} canal(aux)` })
      if (!editing) nav(`/transferts?beneficiary=${b.id}`)
    } catch (e) {
      setSaving(false)
      toast({ title: 'Enregistrement impossible', text: e.message, tone: 'error' })
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'Ajouter un canal' : 'Ajouter un bénéficiaire'}
      footer={<div className="flex gap-2">
        <Button variant="outline" className="flex-1" loading={saving} onClick={() => save(false)}>Enregistrer</Button>
        {!editing && <Button className="flex-1" icon={Send} loading={saving} onClick={() => save(true)}>Enregistrer et envoyer</Button>}
      </div>}>
      <div className="space-y-4">
        {/* Zone d'import par QR / payload */}
        <div className="rounded-2xl border border-dashed border-line p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><ScanLine className="size-4" /> Importer depuis un QR</p>
          <div className="mt-2 flex gap-2">
            <Input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Payload PBA1… · lnbc… · 0x… · bc1… · T…" className="flex-1 font-mono text-[12px]" />
            <Button type="button" variant="outline" icon={QrCode} onClick={() => fileRef.current?.click()}>Image</Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const text = await scanQrFile(f); if (text) { setPaste(text); importPayload(text) } else setPasted({ ok: false, message: 'Aucun QR lisible dans cette image.' }) }} />
          </div>
          <Button type="button" size="sm" variant="dark" className="mt-2" icon={ScanLine} onClick={() => importPayload()}>Décoder</Button>
          {pasted && (
            <p className={cn('mt-2 rounded-xl px-3 py-2 text-[12px] font-medium', pasted.ok ? 'bg-volt-50 text-volt-600' : 'bg-danger-50 text-danger')}>
              {pasted.message}
            </p>
          )}
        </div>

        <Field label="Nom complet" htmlFor="bn" >
          <Input id="bn" value={editing ? (beneficiary?.name ?? '') : name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Fatou Sow" autoFocus disabled={editing} />
        </Field>
        <Field label="Pays (canaux fiat)" htmlFor="bc">
          <Select id="bc" value={ctry} onChange={(e) => setCtry(e.target.value)} disabled={editing}>{RECEIVERS.map((c) => <option key={c.code} value={c.code}>{c.flag}  {c.name}</option>)}</Select>
        </Field>

        {/* Canaux existants */}
        {channels.length > 0 && (
          <div className="space-y-2">
            <span className="label block">Canaux de réception ({channels.length})</span>
            {channels.map((ch) => (
              <div key={ch.id} className="relative pr-8">
                <ChannelChip ch={ch} defaultBadge />
                <button aria-label="Supprimer le canal" onClick={() => setChannels((s) => s.filter((x) => x.id !== ch.id))}
                  className="absolute right-0 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:bg-mist hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Kanal builder */}
        <div className="rounded-2xl border border-line p-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de canal">
            {Object.entries(CHANNEL_KINDS).map(([k, m]) => (
              <button key={k} role="radio" aria-checked={build.kind === k} onClick={() => setBuildSafe({ kind: k })}
                className={cn('flex items-center gap-2 rounded-xl border p-2.5 text-[13px] font-semibold transition-all',
                  build.kind === k ? 'border-volt bg-volt-50/60 ring-4 ring-volt/10' : 'border-line hover:border-ink-mute')}>
                {(() => { const Icon = KIND_ICON[k]; return <Icon className="size-4" /> })()}{m.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ChannelBuilder build={build} set={setBuildSafe} banks={banks} check={{ ...check, onVerify: verifyChannel }} setCheck={setCheck} />
          </div>
          <Button type="button" size="sm" className="mt-3 w-full" icon={UserPlus} onClick={addChannel}>Ajouter ce canal</Button>
        </div>
      </div>
    </Drawer>
  )
}

export default function Beneficiaries() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { beneficiaries, transfers, loading } = useStore()
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('all')
  const [shareTarget, setShareTarget] = useState(null)
  const open = params.get('new') === '1'
  const editId = params.get('addChannel')
  const scope = useReveal([loading])

  const list = useMemo(() => beneficiaries.filter((b) => {
    const has = (k) => channelsOf(b).some((c) => c.kind === k)
    if (method === 'mobile' && !has('mobile') && !has('bank')) return false
    if (method === 'bank' && !has('bank')) return false
    if (method === 'crypto' && !has('crypto') && !has('lightning')) return false
    return `${b.name} ${country(b.country)?.name ?? ''} ${b.provider ?? ''}`.toLowerCase().includes(q.toLowerCase())
  }), [beneficiaries, q, method])
  const sentTo = (id) => transfers.filter((t) => t.beneficiaryId === id && t.status === 'completed').reduce((a, t) => a + t.amount, 0)
  const editedBeneficiary = beneficiaries.find((b) => b.id === editId)

  return (
    <div ref={scope}>
      <PageHeader eyebrow="Bénéficiaires" title="Vos bénéficiaires" subtitle="Mobile Money, banque, crypto et Lightning — plusieurs canaux par bénéficiaire."
        action={<Button icon={UserPlus} onClick={() => setParams({ new: '1' })}>Ajouter un bénéficiaire</Button>} />

      <div data-reveal className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, un pays…" aria-label="Rechercher un bénéficiaire" className="field pl-11" />
        </div>
        <div className="flex rounded-xl border border-line bg-white p-1">
          {[['all', 'Tous'], ['mobile', 'Mobile Money'], ['bank', 'Banque'], ['crypto', 'Crypto & Lightning']].map(([k, l]) => (
            <button key={k} onClick={() => setMethod(k)} aria-pressed={method === k}
              className={cn('flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors sm:flex-none', method === k ? 'bg-night text-white' : 'text-ink-soft hover:text-ink')}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52 rounded-[var(--radius-card)]" />)}</div>
      ) : !list.length ? (
        <Card><EmptyState icon={Users} title={beneficiaries.length ? 'Aucun résultat' : 'Aucun bénéficiaire'}
          text={beneficiaries.length ? 'Modifiez votre recherche.' : 'Ajoutez votre premier bénéficiaire pour envoyer un paiement.'}
          action={<Button icon={UserPlus} onClick={() => setParams({ new: '1' })}>Ajouter</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => (
            <Card data-reveal key={b.id} className="group p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
              <div className="flex items-start gap-3">
                <div className="relative"><Avatar name={b.name} size="lg" /><Flag code={b.country} className="absolute -bottom-1 -right-1" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.name}</p>
                  <p className="text-[13px] text-ink-mute">{country(b.country)?.name}</p>
                </div>
                <button aria-label="Partager par QR" onClick={() => setShareTarget(b)}
                  className="grid size-8 place-items-center rounded-lg text-ink-mute hover:bg-mist hover:text-ink"><QrCode className="size-4" /></button>
                <button aria-label="Ajouter un canal" onClick={() => setParams({ addChannel: b.id })}
                  className="grid size-8 place-items-center rounded-lg text-ink-mute hover:bg-mist hover:text-ink"><Pencil className="size-4" /></button>
              </div>
              <div className="mt-4 space-y-1.5">
                {channelsOf(b).slice(0, 3).map((ch) => <ChannelChip key={ch.id} ch={ch} defaultBadge />)}
                {channelsOf(b).length > 3 && <p className="text-[11px] text-ink-mute">+{channelsOf(b).length - 3} autre(s) canal(x)</p>}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[12px] text-ink-mute">Envoyé : <b className="tabular text-ink">{money(sentTo(b.id))}</b></span>
                <Button size="sm" variant="dark" icon={Send} onClick={() => nav(`/transferts?beneficiary=${b.id}`)}>Envoyer</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddDrawer open={open} onClose={() => setParams({})} defaultCountry={params.get('country')} />
      <AddDrawer open={Boolean(editId) && !!editedBeneficiary} onClose={() => setParams({})} beneficiary={editedBeneficiary} />
      <QrShareDrawer open={Boolean(shareTarget)} onClose={() => setShareTarget(null)} beneficiary={shareTarget} />
    </div>
  )
}
