# Product Matcher — Scalable E-Pharmacy Image Matching Pipeline

Match 700,000+ website products (Dataset A) to DataRequisite catalog entries (Dataset B) and retrieve image URLs with confidence scoring designed to **minimize false matches**.

## Architecture

```
Dataset A (CSV)          Dataset B (CSV)
      │                        │
      ▼                        ▼
 Preprocessing            Preprocessing
 Brand alias expand       Brand alias expand
 Attribute extraction     Attribute extraction
      │                        │
      │                   Catalog Index
      │                   (blocking + embeddings)
      │                        │
      └──────── Matching ──────┘
                    │
         Stage 1: Exact normalized match
         Stage 2: Brand + strength + quantity + form
         Stage 3: RapidFuzz fuzzy (blocked candidates only)
         Stage 4: Sentence-transformer semantic similarity
         Stage 5: Weighted confidence scoring
                    │
                    ▼
              match_results.csv
```

### Blocking (no O(n²) comparisons)

Each catalog product is indexed by a composite **block key**:

```
b:{brand}|f:{form}|s:{strength}|p:{name_prefix}
```

When matching a source product, only candidates in the same block (plus same-brand fallback) are evaluated — typically **10–50 candidates** instead of 700,000.

### Confidence thresholds

| Score | Status | Action |
|-------|--------|--------|
| 98–100 | `auto_accept` | Safe to apply images automatically |
| 90–97 | `manual_review` | Human verification recommended |
| < 90 | `rejected` | Do not use — no match exported |

---

## Windows Setup (Step-by-Step)

### 1. Install Python 3.10 or 3.11

1. Download from [python.org](https://www.python.org/downloads/windows/)
2. During install, check **"Add Python to PATH"**
3. Verify in PowerShell:

```powershell
python --version
```

### 2. Open project folder

```powershell
cd C:\flora-main\flora-main\product-matcher
```

### 3. Create virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If script execution is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### 4. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

First run downloads the `all-MiniLM-L6-v2` model (~90 MB) for semantic matching.

### 5. Prepare your CSV files

**Dataset A** (your website) — minimum columns:

| Column | Required | Notes |
|--------|----------|-------|
| `id` or `product_id` | Yes | Unique product ID |
| `name` or `product_name` | Yes | Raw product name |
| `brand` | No | Improves accuracy; extracted from name if missing |

**Dataset B** (DataRequisite) — uses your DRUGS export:

| Column | Required |
|--------|----------|
| `Product ID` | Yes |
| `Product Name` | Yes |
| `Image_Urls` | Yes (pipe-separated URLs) |
| `Marketer`, `Packaging Detail`, `Product Form` | Optional (improves matching) |

### 6. Configure brand aliases

Edit `config/brand_aliases.yaml` to add abbreviations used in your inventory:

```yaml
aliases:
  him: himalaya
  min: minimalist
  ctp: cetaphil
```

### 7. Build catalog index (Dataset B)

Run once, or when DataRequisite data changes:

```powershell
python main.py index --dataset-b "C:\path\to\DRUGS.csv"
```

Index is saved to `data/index/` for fast re-runs.

### 8. Run matching

```powershell
python main.py match `
  --dataset-a "C:\path\to\my_products.csv" `
  --dataset-b "C:\path\to\DRUGS.csv" `
  --output "data\output\match_results.csv"
```

**Faster run (skip semantic stage):**

```powershell
python main.py match --dataset-a products.csv --dataset-b DRUGS.csv --no-semantic
```

**Force rebuild index:**

```powershell
python main.py match --dataset-a products.csv --dataset-b DRUGS.csv --rebuild-index
```

### 9. Review output

Output CSV columns:

- `my_product_id`, `my_product_name`
- `matched_product_id`, `matched_product_name`
- `image_url_1`, `image_url_2`, `image_url_3`
- `confidence_score`, `match_stage`, `review_status`

Filter in Excel or Power BI:

- Import only `review_status = auto_accept` for production image updates
- Review `manual_review` rows before applying

---

## Export products from MongoDB (optional)

If your Flora site stores products in MongoDB:

```powershell
pip install pymongo
python scripts/export_mongo_products.py --uri "mongodb://localhost:27017" --db flora --out data\my_products.csv
```

---

## PostgreSQL (optional, production)

For incremental runs and audit trails at scale:

1. Install PostgreSQL 15+
2. Create database and user
3. Apply schema:

```powershell
psql -U postgres -d product_matcher -f schema\postgres_schema.sql
```

4. Set `database.enabled: true` in `config/settings.yaml`
5. Use `product_matcher.db.PostgresStore` in custom scripts to persist results

---

## Performance tips (700k products)

| Setting | Recommendation |
|---------|----------------|
| `batch_size` | 5000 (default) |
| `max_candidates_per_product` | 50 |
| `enable_semantic_stage` | `true` for accuracy; `false` for 3–5× speed |
| Index rebuild | Only when Dataset B changes |
| RAM | 8 GB minimum; 16 GB recommended with semantic stage |
| GPU | Optional — PyTorch uses CUDA if available |

Expected throughput (approximate, CPU):

- Index build (700k B): 30–90 minutes
- Matching (700k A vs indexed B): 2–6 hours with semantic; 45–90 min without

---

## Tuning for accuracy

1. **Expand `brand_aliases.yaml`** — most false matches come from unrecognized abbreviations
2. **Raise `min_fuzzy_score`** to 80+ in `settings.yaml` for stricter fuzzy stage
3. **Raise `min_semantic_score`** to 0.78+ for stricter semantic gate
4. **Never auto-apply** `manual_review` matches without spot checks
5. Add your distributor-specific abbreviations (e.g. invoice codes) to aliases

---

## Project structure

```
product-matcher/
├── main.py                    # CLI entry point
├── requirements.txt
├── config/
│   ├── settings.yaml          # Pipeline configuration
│   └── brand_aliases.yaml     # Brand abbreviation dictionary
├── product_matcher/
│   ├── preprocessing.py       # Normalization & units
│   ├── brand_aliases.py       # Alias expansion
│   ├── attribute_extractor.py # Brand, strength, form, pack
│   ├── blocking.py            # Index & candidate retrieval
│   ├── stages.py              # 5-stage matcher
│   ├── scorer.py              # Confidence scoring
│   ├── pipeline.py            # Orchestration
│   ├── io_utils.py            # CSV I/O
│   └── db.py                  # PostgreSQL (optional)
├── schema/postgres_schema.sql
├── scripts/export_mongo_products.py
└── data/
    ├── index/                 # Cached catalog index
    └── output/                # Match results
```

---

## Logs

Logs are written to `logs/matcher.log` and stdout. Use `--log-level DEBUG` for troubleshooting.

---

## License

Internal use for Flora e-pharmacy product image enrichment.
