# FloraChemist Sync Bridge

Automatically pushes stock updates from your local medical software to the FloraChemist website.

## Setup (one time)

1. Install Node.js from https://nodejs.org (if not already installed)
2. Open this folder in Command Prompt and run:
   ```
   npm install
   ```
3. Open `run-sync.bat` and replace:
   - `C:\StockUpdates` → the folder your software drops files into
   - `YOUR_SYNC_API_KEY_HERE` → the key from your .env.local (SYNC_API_KEY)

## Usage

**Manual run:** Double-click `run-sync.bat`

**Automatic every hour (Windows Task Scheduler):**
1. Open **Task Scheduler** → Create Basic Task
2. Name: `FloraChemist Stock Sync`
3. Trigger: Daily → Repeat every **1 hour**
4. Action: Start a program → Browse to `run-sync.bat`
5. Done ✅

## How it works

1. Software drops a file (CSV / JSON / Excel) in `C:\StockUpdates\`
2. This script runs every hour, reads the file
3. Pushes stock updates to `https://www.florachemist.online/api/sync/stock`
4. Moves processed files to `C:\StockUpdates\processed\` so they aren't re-sent

## Supported CSV formats

### Modern Pharma & Generics (Recommended)
Your software exports with these columns:
```
Company, Product, Packing, Stock, MRP, PTR, SchPer
```

The script automatically maps:
- `Company` → Brand
- `Product` → Product Name
- `Packing` → Pack Size
- `Stock` → Available Quantity
- `MRP` → Maximum Retail Price
- `PTR` → Selling Price (Pharmacy Trade Rate)

### Custom column mapping

If your software uses different column names, edit the `columns` section in `sync-bridge.js`:

```javascript
columns: {
  id:        ['id', 'sku', 'item_code', 'code', 'product_id', 'product'],
  name:      ['name', 'product_name', 'item_name', 'medicine_name', 'description', 'product'],
  brand:     ['brand', 'manufacturer', 'company', 'mfr', 'company_name'],
  category:  ['category', 'cat', 'group', 'department', 'scheme_wise'],
  price:     ['price', 'sale_price', 'selling_price', 'rate', 'ptr'],
  mrp:       ['mrp', 'max_price', 'maximum_retail_price'],
  stock:     ['stock', 'qty', 'quantity', 'balance', 'closing_stock', 'available'],
  packSize:  ['pack_size', 'packsize', 'pack', 'packing', 'unit'],
},
```

Add your column names to the arrays. The script will use the first match it finds.

## Log file

Every sync run is logged to `sync-log.txt` in this folder.
