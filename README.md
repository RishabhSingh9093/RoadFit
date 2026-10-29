# RoadFit

Road intelligence and car matching, rebuilt from five recovered RoadFit files.

## Application

- Responsive React dashboard with a road network view and explainable road DNA.
- Server-side OpenStreetMap map API and Overpass integration, with explicit demo mode, request deadlines, and a 10-minute bounded cache.
- Actual unsupervised K-means clustering of road widths; no API key required.
- Budget, seat, and fuel filters plus transparent heuristic car ranking.
- Catalog search, three-car comparison, JSON export, and persisted per-user analyses in Cloudflare D1.
- ChatGPT sign-in through Sites. Every saved-data operation checks identity; queries are scoped to the current user.

## Run

Node >=22.13 required. Run `npm ci`, `npm run db:generate` only if the schema changes, then `npm run build`. Apply the generated SQL under drizzle/ to the local DB with:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_<generated-name>.sql
npm run dev
```

Visit http://127.0.0.1:5180 (the default development port). Local account sign-in is simulated by the starter. Production uses platform authentication. Hosted migrations are applied by Sites deployment.

## API

- POST /api/analyse: `{mode:"live"|"demo",lat,lng,radius:500|1000|1500,budget,seats,fuel,name}`. Returns road profile, ranked matches, provenance, preferences, and timestamp.
- GET /api/catalog: recovered catalog plus provenance.
- GET /api/saved: current user's latest 50 saved analyses.
- POST /api/saved: `{name,payload}`. Requires authentication.
- DELETE /api/saved?id=...: deletes only the current user's matching record.

## Analysis of the recovered code

Original app.py provided a Flask hello/test endpoint and a road-analysis endpoint. road_dna.py fetched OSM roads and clustered widths with sklearn, but failed for empty/small samples, assumed width tags were directly numeric, and lacked explicit HTTP status handling. route_analyser.py ended after nearest-node lookup and never computed a route. car_scorer.py only loaded data and referenced a location inconsistent with the recovered file tree. No frontend, dependency manifest, authentication, persistence, or finished car recommender was recovered.

The new implementation ports the road-width clustering concept to a Worker-compatible TypeScript server, retains all recovered car data exactly, and replaces the incomplete application with a complete vertical slice. The original recovered files remain in the sibling RoadFit-recovery folder untouched. Route navigation is not presented as a feature because it was never implemented and width estimates cannot establish safe passage.

## Model and data limits

AI means K-means unsupervised machine learning; there is no generative AI chatbot. Match ranking is a heuristic, not a trained car preference model or a probability. Compactness and maneuverability matter more when the narrower road cluster is common. Mileage and resale scores are from the recovered dataset. Clusters are relative within each sampled area, not fixed narrow/wide thresholds. Samples count road ways, not length-weighted roadway coverage.

OSM widths may be missing, so per-road-type fallback widths are used and their proportion is shown. They do not measure usable road clearance or account for parked cars, obstacles, or traffic. Live mode does not silently substitute demo data on failure. The returned profile records the provider and retrieval time. A 500 m request first uses the small-area map API. Larger areas try Overpass first and fall back to bounded map exports. OSM ways are rebuilt from their nodes, filtered to drivable road types, and clipped to the selected radius. Ways explicitly tagged access=no or motor_vehicle=no are excluded. Dense responses over 12 MB are rejected rather than exhausting server memory. Each original way is counted once; the longest connected section inside the circle is displayed.

Car prices and specifications come from the recovered June 2026 catalog and are historical, unverified examples. Verify current manufacturer specifications and prices independently. Vehicle illustrations are generic vector drawings, not model photographs.

## Verification

`node tests/engine.cjs` covers width units, malformed widths, empty/small samples, clustering, ranking constraints, upstream failure, and live provenance. `node tests/api-smoke.mjs` requires the local dev server and checks request validation, anonymous access rejection, and authenticated D1 save/list/delete. It also probes live OSM availability and reports the result without substituting demo data.

TypeScript validation and production build passed. Browser QA covered mobile and desktop breakpoints, preference changes, empty matches, catalog search, and car comparison. After the live-road fix, API and browser verification succeeded for Indiranagar, Bengaluru at a 500 m radius: 186 live roads, 182 with estimated widths. Provider: OpenStreetMap map API. The primary Overpass provider was at capacity and the Private.coffee provider timed out; those outages no longer block the tested small-area request. Unit tests additionally cover node reconstruction, circle-boundary crossing, road exclusions, cache reuse, and provider fallback.

Public providers are listed in the [OpenStreetMap Overpass documentation](https://wiki.openstreetmap.org/wiki/Overpass_API). The server uses the official [small-area map endpoint](https://wiki.openstreetmap.org/wiki/API_0.6), the main Overpass endpoint, and the Private.coffee endpoint, with a 20-second deadline per provider. In-memory caches are per server instance and are bounded to 30 areas. The main OSM API is for modest small-area exports, not bulk production analytics; a larger public deployment should use a dedicated OSM data service.
