# iverfinne.no

Personleg nettstad og portefølje der innhald blir skrive i Notion og publisert automatisk når **Status** er sett til **Ferdig**.

## Oversikt (flyt)
> **Publiseringsflyt**: Skriv i Notion → set **Status = Ferdig** → nettstaden hentar endringar i bakgrunnen ved besøk (ISR)

Dette prosjektet er bygd for **ISR (Incremental Static Regeneration)**, der nettsida kan revalidere statiske sider utan full rebuild.

## Arkitektur
- **Rammeverk:** Next.js (App Router)
- **Innhaldskjelde:** Notion database via `@notionhq/client`
- **Publisering:** Berre element med **Status = Ferdig** blir publiserte
- **Oppdatering:** Automatisk, basert på besøk og fem minutt lange cache-vindauge
- **Ved feil:** Siste vellukka data blir behaldne; 429, 5xx og nettverksfeil får avgrensa nye forsøk
- **Manuell oppdatering:** Valfri `POST /api/revalidate` med `Authorization: Bearer <REVALIDATION_SECRET>`

## Datamodell (Notion)
Notion-databasen må ha desse eigenskapane for at innhald skal kunne visast på nettstaden:

| Eigenskap | Type | Merknad |
| :--- | :--- | :--- |
| **Namn** | title | Hovudtittel for innhaldet |
| **Status** | status | Må vere **Ferdig** for publisering |
| **Type** | select | `Skriving` · `Bok` · `Prosjekt` · `Lenkje` · `Bilete` · `Interaktiv` · `Presentasjon` |
| **Dato** | date | Publiseringsdato |
| **Slug** | text | URL-venleg slug, t.d. `mitt-innlegg`. Blir automatisk generert frå tittel om tom |
| **Samandrag** | text | Kort samandrag for førehandsvising (valfritt) |
| **Merkelappar** | multi_select | Kategorisering, t.d. `design`, `ai`, `d3js` (valfritt) |

### Om `Slug`
- `Slug` bør vere stabil over tid når innlegget først er publisert.
- Dersom feltet er tomt, blir slug generert frå tittelen (tilrådd for enkel flyt).

## Automatisk publisering utan Make

Skriv i Notion og set **Status = Ferdig**. Sida oppdaterer seg med Next.js sitt eksisterande mellomlager (ISR). Ingen ny teneste, cron-jobb, database, API-nøkkel eller abonnement er nødvendig.

- Ved eit besøk etter at eit femminutts cache-vindauge har gått ut, blir ei oppdatering starta i bakgrunnen. Den besøkande kan først sjå førre versjon.
- Fleire lag med mellomlager kan gjere at ei endring brukar om lag **5–15 minutt ved jamne besøk** på å nå alle visingar. Dette er ingen tidsfrist eller periodisk bakgrunnsjobb: utan besøk startar oppdateringa ved neste besøk. Notion-feil kan forseinke henne ytterlegare.
- Berre opna innlegg får full tekst henta og konvertert. Eit besøk lastar ikkje lenger ned alle tekstane.
- Uendra sider gjenbruker mediedata, og Notion-kall blir køyrde gjennom éi kø per serverinstans med minst 400 ms mellom startane. Dette er ikkje ein global sperre på tvers av Vercel-instansar; 429-handteringa trengst framleis.
- `Retry-After` blir respektert fullt ut. Er ventetida for lang for førespurnaden, blir oppdateringa avbroten utan eit for tidleg nytt forsøk.
- Ei mislukka innhenting blir ikkje lagra som ei tom eller delvis innhaldsliste. Eit bygg utan tilgjengeleg Notion-data feilar, slik at eksisterande utrulling blir ståande.
- Biletfiler har eige mellomlager; utskifting av eit bilete med same URL kan ta lengre tid. Første innhenting utan nokon lagra versjon krev at Notion er tilgjengeleg.

### Overgang frå Make

Etter at utrullinga er vellukka, slå av tidsplanen for `iverfinne.no – Notion → Revalidate` i Make. Det gamle GET-endepunktet er framleis kompatibelt, men markerer innhald som forelda i staden for å tømme heile nettsida. `POST /api/notion-webhook` er ein kompatibilitetsrute for eksisterande kall med delt hemmelegheit; dette oppsettet registrerer ingen ny native Notion-webhook.

### Kontroll og testing

Køyr `node --test tests/notion-sync.test.cjs` frå `iverfinne.no/` etter installasjon. Testane simulerer rate limits, Retry-After, nettverksfeil og fleire resultatsider utan å kontakte Notion. Eksisterande Vercel Git-integrasjon byggjer endringar frå GitHub. Det blir ikkje brukt ein ny deploy-teneste.

## Miljøvariablar
Opprett `.env.local`:

- `NOTION_API_KEY`  
  Intern integrasjonsnøkkel (Notion).
- `NOTION_DATABASE_ID`  
  ID til Notion-databasen / data source som blir lest.
- `REVALIDATION_SECRET`  
  Valfri hemmelegheit for manuelle oppdateringskall. Automatisk publisering treng henne ikkje.

## Køyr lokalt

```sh
cd iverfinne.no
npm ci --legacy-peer-deps
npm run dev
```

`--legacy-peer-deps` er nødvendig med den eksisterande kombinasjonen av React 19 og Framer Motion 11. Denne endringa oppgraderer ingen pakkar.
