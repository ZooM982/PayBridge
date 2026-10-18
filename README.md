# PayBridge Africa — Front-end

Prototype fintech pour les paiements transfrontaliers des freelances et petites entreprises africaines, conçu pour s'appuyer sur l'infrastructure de paiement **Bitnob** (via un backend Node.js/Express).

> ⚠️ **Mode démo** : toutes les données sont fictives. Les références commencent par `DEMO-`, les taux et frais sont indicatifs, et aucune transaction réelle n'est exécutée.

## Stack

- **React 18 + Vite 6**
- **Tailwind CSS v4** (tokens dans `src/index.css` via `@theme`)
- **GSAP 3** + `@gsap/react` (apparitions, compteurs, graphique, timeline, tiroirs, transitions d'étapes)
- **Lucide** pour les icônes · **React Router** (HashRouter)

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
SINGLE=1 npm run build   # build en un seul index.html (pratique pour une démo hors-ligne)
```

## Parcours de démo (< 2 min)

1. **Dashboard** → solde, volume, indicateurs réussis / en attente / échoués, graphique 7j/14j/30j.
2. Clic sur **Nouveau transfert** (ou un bénéficiaire dans « Envoi rapide »).
3. Choisir pays, montant, bénéficiaire → le calculateur affiche frais, taux et montant reçu en direct → **Continuer**.
4. **Vérification** : récapitulatif complet → **Confirmer**.
5. **Confirmation** : statut animé, timeline *Créé → En traitement → Confirmé* (progression simulée en ~6 s), référence copiable.
6. **Historique** : le nouveau transfert apparaît en tête ; filtres, recherche, export CSV, détail en tiroir.

Astuce jury : un montant se terminant par `.13` (ex. `120.13`) simule un refus du fournisseur pour montrer l'état d'erreur.

## Structure

```
src/
├── components/
│   ├── ui/            Button, Card, Field/Select/Input, StatusBadge, Drawer, Toaster, Misc (Avatar, Flag, Logo, DemoTag…)
│   ├── layout/        AppLayout (sidebar, topbar, nav mobile), PageHeader
│   ├── charts/        AreaChart (SVG pur, animé GSAP)
│   ├── Timeline.jsx   Créé → En traitement → Confirmé
│   └── TxParts.jsx    Ligne de transaction + tiroir de détail
├── pages/             Dashboard, NewTransfer, Confirmation, History, Beneficiaries, Settings
├── context/AppStore.jsx   État global (solde, transferts, bénéficiaires, toasts, SSE statuts)
├── services/api.js        Couche API unique : mock (démo) ou backend Express
├── data/demo.js           Données de démonstration (déterministes) + motifs/banques
├── hooks/useMotion.js     useReveal, useCountUp (GSAP)
└── lib/format.js          Formatage monétaire FR, calcul de devis

server/                    Backend Express + Bitnob (HMAC signé, SSE, webhooks)
```

## Design system

| Token | Valeur | Usage |
|---|---|---|
| `night` | `#0B1220` | Sidebar, cartes premium, texte principal |
| `volt` | `#00D68F` | Action principale, succès, accents |
| `white` | `#FFFFFF` | Cartes |
| `mist` | `#F3F5F7` | Fond d'application |
| `warn` / `danger` / `info` | `#F5A524` / `#F04452` / `#3B82F6` | Statuts |

Police Inter, rayon de carte 20 px, chiffres tabulaires pour tous les montants, focus visible vert, `prefers-reduced-motion` respecté.

## Brancher le backend Express + Bitnob

Le backend **existe maintenant** : voir le dossier [`server/`](server/README.md).

```bash
cd server
npm install
npm run dev          # http://localhost:4000 (mode SIMULATION sans clés, BITNOB avec clés)
cp .env.example .env # puis renseigner BITNOB_CLIENT_ID / BITNOB_CLIENT_SECRET
```

1. Créer un compte sandbox sur **app.bitnob.com** → Settings > API Keys (Client ID + Secret).
2. Copier `.env.example` en `.env` racine et passer `VITE_DATA_MODE=api`.
3. Le proxy Vite redirige déjà `/api` vers `http://localhost:4000` en développement.
4. Statuts temps réel : le front consomme `GET /api/events` (SSE), alimenté par les
   **webhooks Bitnob** (`POST /api/webhooks/bitnob`) + un polling de secours toutes les 20 s.
5. Flux payout côté serveur (dans `POST /api/transfers`) : `quotes → initialize → finalize`
   avec `payment_reason`, bénéficiaire (`destination_type: bank | mobile_money`) et
   verification du titulaire par **Account Lookup** en amont.

**Ne jamais exposer les clés Bitnob dans le front.** Aucun logo officiel Bitnob n'est utilisé : seule la mention texte « Powered by Bitnob » apparaît.
# PayBridge
