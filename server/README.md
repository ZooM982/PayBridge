# PayBridge Server — Express + Bitnob

Backend du prototype PayBridge Africa : unique détenteur des clés Bitnob, il expose
au front le contrat documenté dans `src/services/api.js` et signe chaque requête
Bitnob en **HMAC-SHA256** (doc : https://bitnob.dev/api-reference/authentication).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:4000
```

Deux modes, choisis par la présence des clés dans `.env` (`cp .env.example .env`) :

| Mode | Condition | Comportement |
|---|---|---|
| **SIMULATION** | pas de `BITNOB_CLIENT_ID/SECRET` | Même contrat d'API, quotes/taux/statuts simulés — parfait pour la démo sans compte |
| **LIVE** | clés configurées | Appels réels signés HMAC vers `https://api.bitnob.com` |

## Flux payout Bitnob implémenté

`POST /api/transfers` enchaîne côté serveur (jamais exposé au front) :

1. `POST /api/payouts/quotes` — quote (`quote_id`, `fees`, `settlement_amount`, `expires_at`)
2. `POST /api/payouts/:quoteId/initialize` — bénéficiaire + `payment_reason` + `callback_url`
3. `POST /api/payouts/:quoteId/finalize` — déclenchement (avant l'expiration de la quote)
4. Suivi : **webhooks** `POST /api/webhooks/bitnob` (`payouts.initialized`, `payouts.processing`,
   `payouts.withdrawal.success`, `payouts.withdrawal.expired`) + **polling** de secours
   `GET /api/payouts/:id` toutes les 20 s.
5. Le front reçoit les changements de statut via le flux **SSE** `GET /api/events`.

## Routes

```
GET  /api/health                        { ok, mode }
GET  /api/wallet                        { balance, currency }        ← balances
GET  /api/rates                         { updatedAt, rates }         ← exchange-rates
GET  /api/banks/:country                { banks: [{code, name}] }    ← payouts/banks
GET  /api/account-lookup?country&accountNumber&bankCode&method
                                        titulaire du compte          ← payouts/account-lookup
POST /api/quotes                        { amount, fee, rate, received, expiresAt }
POST /api/transfers                     Transfer (flux complet ci-dessus)
GET  /api/transfers • /:id              Transfer(s)
GET  /api/beneficiaries • POST          Beneficiary(s)
GET  /api/events                        SSE { id, status }
POST /api/webhooks/bitnob               raw body + signature
```

## Notes

- Store **en mémoire** (`store.js`) : brancher Postgres/SQLite pour la production.
- La signature des webhooks (`x-bitnob-signature`) suit l'implémentation
  `sha256=<hex>` d'un HMAC du corps brut avec `BITNOB_WEBHOOK_SECRET` — à
  ajuster si la doc finalise un header différent.
- `PUBLIC_BASE_URL` permet de générer l'URL `callback_url` passée à Initialize.
