# Optimize 404 Fallback: Cloudflare Worker met Origin Probe

## Context

De huidige 404-fallback chain is: Client → Cloudflare → origin server → unpkg.com → terug.

Gemeten TTFB (warm, na DNS-cache):

- **kjanat.com**: ~155-175ms
- **kajkowalski.nl**: ~165-200ms

**Afgevallen opties:**

- **Cloudflare Custom Error Rules** — vereist Pro zone plan, lost origin round trip niet op
- **jsDelivr als CDN** — serveert `.html` als `text/plain` + `nosniff`, browser rendert niet als HTML
- **DNS API lookup vanuit Worker** — geen inherited permissions, vereist expliciet API token
- **Hardcoded subdomein-lijst** — niet houdbaar bij meerdere domeinen en services

## Plan: Cloudflare Worker met Origin Probe + Cache

### Hoe het werkt

1. Worker ontvangt request voor een subdomein
2. Worker checkt cache: "is deze hostname eerder als 404-fallback geïdentificeerd?"
   - **Ja** → serveer 404 pagina direct uit Static Assets (~5-15ms)
   - **Nee** → probe origin (`fetch(request)`)
3. Origin response komt terug:
   - Heeft marker header → hostname is onbekend, cache dit, serveer static 404
   - Geen marker header → echte service, passthrough response naar client

**Na eerste request per hostname**: alle 404-subdomeinen worden direct vanuit de edge geserveerd. Geen subdomein-lijst nodig, geen API tokens, werkt automatisch voor alle domeinen.

### Stap 1: Traefik marker header toevoegen

Voeg aan de bestaande fallback-404 middleware een custom response header toe zodat de Worker het kan herkennen:

**Bestand**: reverse proxy fallback config

- Nieuwe middleware `fallback-marker` met marker header
- Toevoegen aan de fallback router middlewares

### Stap 2: Worker project aanmaken in `kjanat/404` repo

**`worker/wrangler.toml`**:

- Static assets uit `dist/` folder (hergebruik Vite build output)
- Routes voor alle geconfigureerde domeinen (wildcard + apex)
- Workers Paid plan

**`worker/src/index.ts`**:

- Check Cache API voor hostname → als cached als "fallback", serveer static 404
- Anders: `fetch(request)` naar origin
- Inspecteer response op marker header
- Als gevonden: cache hostname als "fallback" (TTL bijv. 5 min), serveer static 404
- Als niet gevonden: passthrough origin response ongewijzigd

### Stap 3: CI/CD — `publish.yml` uitbreiden

Bestaande workflow (triggered op GitHub Release) uitbreiden:

1. Na `bun bd` build: `dist/` wordt zowel naar npm gepublished als Worker static assets
2. `npx wrangler deploy` vanuit `worker/`
3. Vereist `CLOUDFLARE_API_TOKEN` secret (Workers deploy rechten)

### Stap 4: Traefik fallback behouden

Origin fallback blijft als safety net bij Workers outage.

## Bestanden te wijzigen

| Bestand                         | Locatie                     | Actie                          |
| ------------------------------- | --------------------------- | ------------------------------ |
| `fallback-404.yml`              | Reverse proxy config        | Marker header toevoegen        |
| `worker/wrangler.toml`          | `kjanat/404` repo           | Nieuw                          |
| `worker/src/index.ts`           | `kjanat/404` repo           | Nieuw                          |
| `.github/workflows/publish.yml` | `kjanat/404` repo           | Wrangler deploy stap toevoegen |

## Performance verwachting

| Scenario                   | Eerste request        | Herhaalde requests                  |
| -------------------------- | --------------------- | ----------------------------------- |
| Onbekend subdomein (404)   | ~170ms (origin probe) | **~5-15ms** (cached, static assets) |
| Bekend subdomein (service) | ~170ms (passthrough)  | ~170ms (altijd passthrough)         |

## Verificatie

1. Origin marker: `curl -sI https://test123.<domain>` → moet marker header tonen
2. Worker eerste request: TTFB ~170ms (origin probe)
3. Worker cached request: TTFB ~5-15ms
4. Bekende services: geen marker header, normale response
5. HTTP status onbekend subdomein: 404
6. Verificatie over alle geconfigureerde domeinen
