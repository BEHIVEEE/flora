# Pharmacy Enrichment Engine

Production-ready Node.js system for matching and enriching ~26,000 pharmacy products against a 700,000+ medicine database.

## Quick Start (No MySQL Required)

```powershell
cd enrichment-engine
npm install

# Place 3 files in data/input/:
#   1. ProductList.xlsx      (your ~26k catalog)
#   2. DRUGS DATA *.xlsx     (700k+ medicine database, 1+ files)
#   3. IMAGE URLS *.xlsx     (image URLs)

npm run enrich:catalog
```

**Output:** `data/output/enriched_products.xlsx` (ALL 26k products + enrichment fields)

---

## Performance Estimates

Based on production runs with ~26,768 RMS × ~744,000 DR products:

| Metric | Expected |
|--------|----------|
| **Auto-matched** | **30–40%** (~8,000–10,000 products) |
| **Review required** | **5–8%** (~1,300–2,000 products) |
| **Unmatched** | **55–65%** (~14,000–17,000 products) |
| **Processing time** | **15–90 min** (catalog load + match + reports) |
| **RAM** | **8 GB** recommended (`--max-old-space-size=8192`) |
| **CPU** | 4+ cores; single-threaded matching, I/O bound on Excel load |
| **Disk** | ~2 GB free for logs + output |

> Match rate depends on naming consistency between your catalog and the medicine database. OTC/cosmetics (Cetaphil, Himalaya) match well when OTC catalog is included.

**Validation:** Matched + Review + Unmatched always equals total product count (hard-checked at end of run).

---

## Output Files

| File | Contents |
|------|----------|
| `enriched_products.xlsx` | **ALL products** — original columns + Composition, Prescription Required, Description, Category, Image URLs, Match Confidence |
| `matched_products.xlsx` | Auto-matched only (≥95% confidence) |
| `review_required.xlsx` | Borderline matches (85–94%) with top 5 suggestions |
| `unmatched_products.xlsx` | No match (<85%) with closest candidate + reason |
| `matching_debug_report.xlsx` | Summary stats + unmatched analysis |

---

## Matching Engine Features

- **Barcode match** (100% confidence)
- **Brand alias expansion** (`config/brand_aliases.json`)
- **Pharmaceutical synonyms** (`config/form_synonyms.json`) — syrup ↔ oral suspension, tab ↔ tablet
- **Structured parsing** — brand, strength, dosage form, pack size
- **Weighted scoring** — brand 40%, strength 25%, pack 15%, manufacturer 10%, form 5%, name 5%
- **Multi-index candidate reduction** — brand, mfg, strength, pack (max 500 candidates, never full scan)
- **Parallel fuzzy scoring** — Worker Threads score candidates; index stays in main process
- **NDJSON index cache** — `data/cache/dr_products.ndjson.gz` (fast reload vs Excel)
- **Match cache** — `data/cache/match_cache.json` / MySQL `match_cache` table
- **Image lookup by matched DR identity** (product ID / name+brand) — not independent fuzzy image matching

Thresholds: ≥95% auto · 85–94% review · <85% unmatched

---


```
enrichment-engine/
├── config/
│   └── brand_aliases.json       # Editable brand alias map
├── data/
│   ├── input/                   # Place your Excel files here
│   ├── output/                  # Generated reports
│   └── images/                  # Temp downloaded images
├── logs/                        # Rotating log files
└── src/
    ├── config/index.js          # All config, reads .env
    ├── db/
    │   ├── migrate.js           # Run once: create all tables
    │   └── pool.js              # MySQL pool + batch helpers
    ├── logger/index.js          # Winston + rotating file logs
    ├── normalizer/index.js      # Name/brand/pack normalization
    ├── matcher/
    │   ├── engine.js            # Indexes, scoring, candidate reduction
    │   ├── parallelMatcher.js   # Worker-thread parallel batches
    │   ├── indexCache.js        # DR index disk cache
    │   ├── matchCache.js        # Match result cache
    │   └── imageIndex.js        # Identity-based image lookup
    ├── reader/
    │   ├── excelReader.js       # Streaming Excel reader
    │   └── columnMaps.js        # Column header mappings
    ├── reporter/
    │   └── excelWriter.js       # Output Excel reports
    ├── queues/index.js          # BullMQ queue definitions
    ├── workers/
    │   ├── imageDownloadWorker.js
    │   ├── cloudinaryWorker.js
    │   ├── mysqlUpdateWorker.js
    │   ├── matchingQueueWorker.js
    │   └── index.js             # Worker process entry
    ├── dashboard/
    │   ├── server.js            # Express + Socket.IO dashboard
    │   ├── statsService.js
    │   └── public/index.html    # Dashboard UI
    └── scripts/
        ├── importFiles.js       # Import all 3 Excel files to DB
        ├── runMatching.js       # Run matching engine
        ├── runEnrichment.js     # Queue enrichment jobs
        └── fullPipeline.js      # Run all 3 steps in order
```

## Prerequisites

- Node.js 18+
- MySQL 8+
- Redis 7+
- Cloudinary account

## Setup

### 1. Install dependencies

```bash
cd enrichment-engine
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your MySQL, Redis, Cloudinary credentials
```

### 3. Place input files

```
data/input/rms_products.xlsx       # Your RMS master catalog
data/input/drugs_data.xlsx         # DataRequisite product database
data/input/drugs_images.xlsx       # DataRequisite image file
```

> The system auto-detects column headers. Edit `src/reader/columnMaps.js` if your headers differ.

### 4. Run database migrations

```bash
npm run migrate
```

### 5. Run the full pipeline

```bash
# Terminal 1 — Start workers
npm run worker

# Terminal 2 — Run pipeline
npm run full-pipeline
```

Or run steps individually:

```bash
npm run import    # Import Excel files to DB
npm run match     # Run matching engine + generate reports
npm run enrich    # Queue enrichment jobs (workers must be running)
```

### 6. Start dashboard

```bash
npm run dashboard
# Open http://localhost:3001
# Bull Board: http://localhost:3001/queues
```

## Output Reports

| File | Contents |
|------|----------|
| `data/output/matched_products.xlsx` | Auto-matched products with description/composition |
| `data/output/review_required.xlsx` | Products needing manual review, top 5 suggestions |
| `data/output/unmatched_products.xlsx` | Unmatched products with reason |

## Matching Logic

| Priority | Method | Confidence | Action |
|----------|--------|------------|--------|
| 1 | Barcode | 100% | Auto accept |
| 2 | Brand alias expansion | — | Pre-process |
| 3 | Name normalization | — | Pre-process |
| 4 | Exact (brand+name+pack) | 99% | Auto accept |
| 5 | Fuzzy (Fuse.js) ≥ 95% | 95-98% | Auto accept |
| 5 | Fuzzy 85-95% | 85-94% | Manual review |
| 5 | Fuzzy < 85% | < 85% | Reject |

## Configuring Brand Aliases

### Option A: Edit JSON file (no restart needed for new imports)
```bash
# Edit config/brand_aliases.json
```

### Option B: Via Dashboard API
```bash
# Add alias
curl -X POST http://localhost:3001/api/aliases \
  -H 'Content-Type: application/json' \
  -d '{"alias":"hm","brand":"himalaya"}'

# Delete alias
curl -X DELETE http://localhost:3001/api/aliases/hm
```

### Option C: Direct MySQL insert
```sql
INSERT INTO brand_aliases (alias, brand) VALUES ('hm', 'himalaya')
ON DUPLICATE KEY UPDATE brand = 'himalaya';
```

Cache invalidates automatically every 60 seconds.

## Performance

- Streams Excel files — handles 100k+ rows with constant memory
- Batch inserts/updates — 500-1000 rows per query
- BullMQ workers with concurrency controls
- 10 concurrent image downloads (configurable)
- Processes 27,000 products in ~3-5 minutes on standard hardware

## Manual Review Workflow

```bash
# Get review-required matches
GET /api/matches?status=review_required

# Accept a match
POST /api/matches/:id/accept
{"reviewer": "yourname"}

# Decline a match
POST /api/matches/:id/decline
{"reviewer": "yourname"}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_NAME` | Database name | pharmacy_catalog |
| `REDIS_HOST` | Redis host | 127.0.0.1 |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | — |
| `AUTO_MATCH_THRESHOLD` | Auto-accept confidence % | 95 |
| `REVIEW_THRESHOLD` | Review queue threshold % | 85 |
| `BATCH_SIZE` | DB batch size | 500 |
| `IMAGE_CONCURRENCY` | Parallel downloads | 10 |
