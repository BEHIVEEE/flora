# 🚀 Step-by-Step Deployment Guide: Product Enrichment System

This guide walks you through deploying and executing the Product Enrichment System on your Node.js and MySQL pharmacy platform.

---

## ⏱️ Estimated Setup Time: ~15 minutes

## 🔧 STEP 1: Configure Environment Variables

Open or update your project's `.env.local` file in the root directory. Add the following parameters:

```env
# MySQL Database Connection Details
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=chemistshop

# Cloudinary Integration (Verify these exist)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 📦 STEP 2: Install Node.js Dependencies

Open your terminal, navigate to the project root, and install the new required libraries:

```bash
# Install mysql2, fuse.js, and p-limit
npm install mysql2 fuse.js p-limit
```

*Note: The `xlsx` library is already present in your `package.json` dependencies and will be resolved automatically.*

---

## 📊 STEP 3: Setup MySQL Database Schema

Apply the database schema definitions and indexing structure. You can do this by running the SQL script in your database client (e.g., MySQL Workbench, phpMyAdmin, DBeaver) or running it via the command line:

```bash
# Execute schema migration script
mysql -u root -p chemistshop < schema/mysql_schema.sql
```

**What this creates:**
1. `products`: Main table storing the final active products (with updated description, composition, category, and Cloudinary image URL columns).
2. `catalog_products`: Staging table holding the full DataRequisite catalog entries (indexed on name and brand for high-performance blocking).
3. `enrichment_jobs`: Progress tracker table showing total records, matching progress, and downloaded image counts.
4. `enrichment_matches`: Audit staging area for pairings, confidence percentages, and manual review states.
5. `enrichment_logs`: Storage for real-time task logs visible on the Admin Dashboard console.

---

## ⚙️ STEP 4: Place and Preprocess Large Excel Files

Because the DataRequisite catalogs are very large (270MB+ each), loading them in raw Excel form directly into Node.js heap memory can cause Out of Memory (OOM) crashes. 

We resolve this by converting them into flat CSV files using the provided Python preprocessor script.

### 4.1 Verify Files are in the Root Folder
Make sure the following files are located in your project root:
- `ProductList.xls` (Prompt RMS export)
- `June 2026 DRUGS IMAGE URLS.xlsx` (Image URL mappings)
- `June 2026 DRUGS DATA PART 1 of 2.xlsx` (DataRequisite catalog part 1)
- `June 2026 DRUGS DATA PART 2 of 2.xlsx` (DataRequisite catalog part 2)

### 4.2 Run Python Preprocessor
Execute the pre-processing script to generate the optimized `.csv` files:

```bash
# Run the script using the local python virtual environment
.\product-matcher\.venv\Scripts\python preprocess_data.py
```

This will create the `data/` directory and populate it with:
- `data/ProductList.csv`
- `data/June_2026_DRUGS_IMAGE_URLS.csv`
- `data/June_2026_DRUGS_DATA_PART_1.csv`
- `data/June_2026_DRUGS_DATA_PART_2.csv`

---

## 🖥️ STEP 5: Run the Matching Pipeline

1. Start your local Node.js development server:
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to the admin dashboard:
   `http://localhost:3000/admin/enrichment`
3. Click the **"Start Matching"** button.
   - The system will start a background worker thread.
   - If `catalog_products` is empty, it will load the staging catalog, join the image URLs on `Product ID`, and save them to MySQL. (This is a fast, one-time initialization).
   - The dashboard will show a **live progress bar** and stream real-time logs (e.g., exact matches found, fuzzy match confidence scores, warnings).

---

## 🧐 STEP 6: Perform Manual Review

1. Any matches that fall between **80% and 90% confidence** will be flagged for manual review.
2. Navigate to the manual review page:
   `http://localhost:3000/admin/enrichment/review`
3. Compare the Prompt Product (Dataset A) and the suggested Catalog Product (Dataset B) side-by-side. You will see image thumbnail previews where available.
4. Click **"Approve"** to apply the match (it will download the image locally, upload it to Cloudinary, write the Cloudinary URL and texts to the `products` table, and flag the match as approved).
5. Click **"Reject"** to reject the suggestion.

---

## 📁 STEP 7: Download Reports

Once matching is complete, you can download the generated report CSV files directly from the dashboard:
1. `matched_products.csv`: Auto-approved matches ($\ge 90\%$ confidence) merged with image URLs.
2. `review_required.csv`: Matches requiring manual review ($80\%$ to $90\%$).
3. `unmatched_products.csv`: Unmatched / Rejected items ($< 80\%$).

Reports are generated at `public/reports/` inside the project.

---

## 🛠️ Troubleshooting

### 1. `Error: Out of Memory (OOM)`
* **Cause**: Excel files are too large and Node.js heap limit was reached before pre-processing.
* **Solution**: Ensure you run `preprocess_data.py` to convert files to CSV. If running matching itself requires more memory, start your server with expanded heap space:
  ```bash
  node --max-old-space-size=4096 node_modules/next/dist/bin/next dev
  ```

### 2. `Cloudinary Upload Failure`
* **Cause**: Missing or incorrect Cloudinary credentials in `.env.local`.
* **Solution**: Log into your Cloudinary console, copy the Cloud Name, API Key, and API Secret, and paste them into `.env.local`. Restart your dev server.

### 3. `Failed to download remote images`
* **Cause**: Remote image host is slow, blocked by CORS, or returning 404 errors.
* **Solution**: The downloader automatically retries failed downloads up to 3 times with exponential backoff. If it still fails, the system logs a warning and proceeds with enriching the description, composition, and category *without* blocking the pipeline.
