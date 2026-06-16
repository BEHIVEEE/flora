# Production Enrichment — FloraChemist

Production-ready matching and enrichment for **26,000 RMS products** against **700,000+ DataRequisite records**, with enrichment stored **separately from RMS data**.

## Architecture

```
Prompt RMS Export          DataRequisite DB           Image URLs
      │                          │                        │
      ▼                          ▼                        ▼
  products (RMS only)      dr_products              dr_images
  stock / MRP / name       composition etc.         image URLs
      │                          │                        │
      └──────────► MATCH ENGINE ◄─────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
   product_match_mapping   product_enrichment   match_audit
   (permanent links)       (metadata + images)  (audit trail)
            │            │
            └────► Excel reports + optional website publish
```

**RMS is never modified.** Stock and price continue to sync from Prompt RMS. Enrichment lives in `product_enrichment`.

## One-Command Setup

```powershell
cd enrichment-engine
npm install
cp .env.example .env
# Edit .env: MySQL, Cloudinary, optional WEBSITE_URL + SYNC_API_KEY

npm run migrate

# Drop 3 files into data/input/:
#   1. ProductList.csv (or .xlsx) — your ~26k catalog
#   2. DRUGS DATA *.csv/xlsx — medicine database
#   3. IMAGE URLS *.csv/xlsx — image URLs

npm run enrich:production
```

### Options

```powershell
npm run enrich:production -- --full      # rematch all (ignore existing mapping)
npm run enrich:production -- --publish   # push enrichment to website via sync API
npm run enrich:production -- --files-only  # Excel only, no MySQL
npm run enrich:production -- --inline    # force inline images (no Redis)
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `products` | RMS staging — stock, MRP, name, barcode (upserted from export) |
| `dr_products` | DataRequisite medicine database |
| `dr_images` | DataRequisite image URLs |
| `product_match_mapping` | Permanent RMS ↔ DR links (reuse on future runs) |
| `product_enrichment` | Composition, Rx, description, category, image URLs |
| `product_images` | Downloaded/uploaded image tracking |
| `match_audit` | Full match history |

## Matching Rules

| Confidence | Result |
|------------|--------|
| Barcode | 100% — auto matched |
| ≥ 95% | Matched |
| 85–94.99% | Review required |
| < 85% | Unmatched |

**Validation:** Matched + Review + Unmatched = 26,000 (enforced in `generateReports.js`).

## Incremental Runs

After the first full run:

1. Export fresh RMS from shop PC → replace file in `data/input/`
2. Run `npm run enrich:production`

The system will:
- **Upsert** RMS stock/MRP (never touch enrichment)
- **Skip** products already in `product_match_mapping`
- **Match** only new/changed products
- **Regenerate** Excel reports

## Website Integration (Vercel + MongoDB)

The live storefront reads **MongoDB**, not MySQL. After enrichment:

```powershell
npm run enrich:publish
# or: npm run enrich:production -- --publish
```

This pushes **description, category, image** via `POST /api/sync/products` — **never stock/price** (those sync separately from Prompt RMS via `sync-bridge`).

Set in `.env`:
```
WEBSITE_URL=https://www.florachemist.online
SYNC_API_KEY=your_key
```

## Performance Estimates

| Phase | First run | Subsequent |
|-------|-----------|------------|
| DR import | 4–6 hr (Excel) | 5–15 min (cached NDJSON) |
| Match 26k | 3–12 min | 1–4 min (mapping cache) |
| Images (inline) | 2–8 hr | only new matches |
| Reports | 1–2 min | 1–2 min |

**Hardware:** 8 GB RAM, 4+ CPU cores, SSD recommended.

**Expected match rate:** 30–40% auto-matched, 5–8% review, 55–65% unmatched (varies by catalog quality).

## Output Files

`data/output/`:
- `enriched_products.xlsx` — all 26k + enrichment columns
- `matched_products.xlsx`
- `review_required.xlsx`
- `unmatched_products.xlsx`
- `matching_debug_report.xlsx`

## Configurable Aliases

Edit without code changes:
- `config/brand_aliases.json`
- `config/form_synonyms.json`

## DOLO Validation

```powershell
node src/scripts/testDoloMatch.js
```

DOLO 250 SYRUP must match Dolo 250 Oral Suspension at >95%.
