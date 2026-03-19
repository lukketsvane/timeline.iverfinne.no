# iverfinne.no

Personleg nettstad og portefølje der innhald blir skrive i Notion og publisert automatisk når **Status** er sett til **Ferdig**.

## Oversikt (flyt)
> **Publiseringsflyt**: Skriv i Notion → set **Status = Ferdig** → Make pollar kvart 15. minutt → nettstaden revaliderer og oppdaterer seg

Dette prosjektet er bygd for **ISR (Incremental Static Regeneration)**, der nettsida kan revalidere statiske sider utan full rebuild.

## Arkitektur
- **Rammeverk:** Next.js (App Router)
- **Innhaldskjelde:** Notion database via `@notionhq/client`
- **Publisering:** Berre element med **Status = Ferdig** blir publiserte
- **Revalidering:** Triggerast via `GET /api/revalidate?secret=...`
- **Synk:** Ein Make-automatisering pollar Notion-databasen kvart 15. minutt og triggar revalidering

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

## Synkronisering (Make)
Nettstaden er laga for å bli revalidert automatisk med Make.

### Scenario
**Namn:** `iverfinne.no – Notion → Revalidate`

**Modul 1 — Notion: Watch Data Source Items**
- Watch By: `Data Source`
- Trigger By: `updated time`
- Limit: `1`
- Where to start: `From now on`

**Modul 2 — HTTP: Make a request**
- Method: `GET`
- URL: `https://iverfinne.no/api/revalidate`
- Query:
	- `secret`: `REVALIDATION_SECRET`

**Scheduler:** `Every 15 minutes` (må vere slått på i scenarioet)

## Miljøvariablar
Opprett `.env.local`:

- `NOTION_API_KEY`  
  Intern integrasjonsnøkkel (Notion).
- `NOTION_DATABASE_ID`  
  ID til Notion-databasen / data source som blir lest.
- `REVALIDATION_SECRET`  
  Hemmeleg nøkkel som må matche både Vercel env og Make query string.

## Køyr lokalt