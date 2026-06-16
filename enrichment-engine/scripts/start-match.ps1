# Start product matching pipeline (Windows)
# Usage: .\scripts\start-match.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Pharmacy Enrichment — Match Pipeline ===" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example — edit DB_PASSWORD before continuing." -ForegroundColor Yellow
    notepad .env
    Read-Host "Press Enter after saving .env"
  } else {
    throw ".env not found"
  }
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Gray
  npm install
}

New-Item -ItemType Directory -Force -Path "data\output" | Out-Null

# File-only mode (no MySQL) — pass -FilesOnly
param([switch]$FilesOnly)

if ($FilesOnly) {
  Write-Host "File-only matching (no MySQL)..." -ForegroundColor Green
  npm run match:files
  if ($LASTEXITCODE -ne 0) { throw "match:files failed" }
} else {
  Write-Host "Step 1/3: Database migrate..." -ForegroundColor Green
  npm run migrate
  if ($LASTEXITCODE -ne 0) {
    Write-Host "MySQL migrate failed. Use file-only mode instead:" -ForegroundColor Yellow
    Write-Host "  .\scripts\start-match.ps1 -FilesOnly"
    throw "migrate failed — is MySQL running?"
  }

  Write-Host "Step 2/3: Import CSV files (this may take 10-30 min)..." -ForegroundColor Green
  npm run import
  if ($LASTEXITCODE -ne 0) { throw "import failed" }

  Write-Host "Step 3/3: Run matching..." -ForegroundColor Green
  npm run match
  if ($LASTEXITCODE -ne 0) { throw "match failed" }
}

Write-Host ""
Write-Host "Done! Reports:" -ForegroundColor Cyan
Write-Host "  data\output\matched_products.xlsx"
Write-Host "  data\output\review_required.xlsx"
Write-Host "  data\output\unmatched_products.xlsx"
