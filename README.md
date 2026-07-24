# OddsClash ⚡

Social sports betting-prototype met **virtuele credits** (géén echt geld). Echte
accounts, server-side saldo/settlement via Supabase, en echte quoteringen uit
een live odds-API via een server-side proxy — met een volledige fallback naar
Demo Mode.

Gebouwd met **Vite + React 18**, **Tailwind CSS v4** (CSS-first config),
**Zustand**, **Supabase** (Postgres + Auth + Edge Functions) en **lucide-react**.

## Snel starten

```bash
npm install
npm run dev
```

Registreer met een e-mailadres + wachtwoord (geen bevestigingsmail nodig) — je
krijgt automatisch 1000 credits. Zonder odds-key draait de app in **Demo Mode**
met mock-odds; alle functionaliteit blijft werken.

### Live odds (optioneel)

De odds-API-key staat **niet** in de browser — hij leeft als secret bij de
Supabase Edge Function `odds-proxy`, zodat hij nooit in de client-bundle
terechtkomt en niet te stelen is uit de browser.

1. Haal een **gratis API-key** op bij [The Odds API](https://the-odds-api.com)
   (gratis tier: ~500 requests/maand).
2. Zet de key als server-side secret (Supabase CLI):

   ```bash
   supabase secrets set ODDS_API_KEY=<jouw-key> --project-ref dbpnxtuwditndnihtwvb
   ```

   Of via het Supabase-dashboard: Project Settings → Edge Functions → Secrets.
3. Geen herstart nodig — de eerstvolgende odds-aanvraag gebruikt de nieuwe key.
   De app schakelt automatisch naar live odds en toont het resterende quotum
   in de Dev Toolbar.

> `.env` staat in `.gitignore` — commit nooit een key.

## Architectuur

| Laag | Bestand | Verantwoordelijkheid |
| --- | --- | --- |
| Supabase-client | `src/services/supabase.js` | Auth, profiel, bets, leaderboard, leagues — alle server-RPC's. |
| Odds-abstractie | `src/services/oddsApi.js` | Roept de `odds-proxy` Edge Function aan (wisselbaar). |
| Odds-proxy | `supabase/functions/odds-proxy` | Server-side call naar The Odds API + gedeelde cache, key blijft hier. |
| Markt-normalisatie | `src/lib/markets.js` | Parseert de API-response → dynamische markten + beste odds. |
| Settlement (server) | Postgres-functies (`settle_open_bets`, `apply_bet_aggregate`, …) | Wikkelt bets autoritatief af — de client kan dit niet vervalsen. |
| State | `src/store.js` | Zustand: leest/schrijft via Supabase, houdt lokaal alleen de bet slip-selecties bij. |
| Demo-data | `src/data/mockData.js` | Fallback in exact API-formaat, incl. fictieve spelersmarkten. |

### Server is de bron van waarheid

Saldo, bets en settlement leven in Postgres achter Row Level Security: de
client kan zijn eigen saldo niet aanpassen (kolomrechten staan alleen
`username`/`avatar_color`-updates toe) en bets/legs zijn read-only voor de
client. Alles wat saldo muteert loopt via `SECURITY DEFINER`-functies
(`place_bet`, `settle_open_bets`, `force_bet`, `manual_settle_leg`,
`reset_account`) die zelf valideren (max 8 legs, max 1 per wedstrijd, geen
gestarte wedstrijden, saldo-check met rij-lock tegen dubbel inzetten).

### Gedeelde odds-cache (quotum-besparing)

De `odds-proxy` Edge Function cachet elke response 30 minuten in de
`cached_odds`-tabel — gedeeld door **alle** gebruikers, niet per browser zoals
een localStorage-cache zou doen. Dat is waar de echte quotum-winst vandaan
komt: 10 gebruikers die naar dezelfde competitie kijken kosten nog steeds maar
één API-call per 30 minuten, niet tien.

### Dynamische markten

De UI hardcodet **geen** marktenlijst. `MarketGroup` is één generiek component dat
elke marktstructuur rendert (2-weg, 3-weg, over/under met `point`, spelersmarkten
met `description`). Toont de API 4 markten? Dan 4 secties. 15? Dan 15.

### Realistische verwachting: spelersmarkten

Spelersmarkten (schoten, reddingen, doelpuntenmakers) zijn bij **gratis**
odds-API's voor voetbal zeer beperkt of afwezig — die feeds (Sportradar e.d.)
zijn betaald. De architectuur is er klaar voor en rendert ze automatisch zodra de
API ze levert. In de gratis tier zie je vooral 1X2, totals, BTTS en dubbele kans.

In **Demo Mode** leveren we wél fictieve spelersmarkten mee (`player_shots`,
`player_saves`) zodat de generieke renderer volledig getest kan worden. Deze
markten zijn niet automatisch af te wikkelen uit de eindstand en krijgen daarom
**handmatige settlement** in de Dev Toolbar (of via "Simuleer volgende uitslag").

## Kernregels

- Iedereen start met **1000 credits**. Op = op; enige weg terug is een reset in de
  Dev Toolbar. Saldo 0 zonder open bets → **Game Over**.
- **Max. 1 weddenschap per wedstrijd** — een combi bestaat altijd uit legs van
  verschillende wedstrijden. Een tweede selectie binnen dezelfde wedstrijd
  vervangt de bestaande (ongeacht de markt). Max 8 legs.
- Combi-odds = **exact het product** van de leg-odds. Eén verloren leg = hele
  combi verloren. Winst = inzet × (totale) odds.

## Dev Toolbar (tandwiel-icoon)

Quotum-indicator, Demo Mode-toggle, "Simuleer volgende uitslag", forceer
winst/verlies, handmatige settlement per leg en reset naar 1000 credits.
