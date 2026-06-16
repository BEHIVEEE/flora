# Start full catalog enrichment (Windows)
# Usage: .\scripts\enrich.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Pharmacy Catalog Enrichment ===" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Gray
  npm install
}

New-Item -ItemType Directory -Force -Path "data\input", "data\output" | Out-Null

Write-Host "Running enrichment pipeline..." -ForegroundColor Green
npm run enrich:catalog
if ($LASTEXITCODE -ne 0) { throw "enrich:catalog failed" }

Write-Host ""
Write-Host "Done! Output files:" -ForegroundColor Cyan
Write-Host "  data\output\enriched_products.xlsx    (ALL products)"
Write-Host "  data\output\matched_products.xlsx"
Write-Host "  data\output\review_required.xlsx"
Write-Host "  data\output\unmatched_products.xlsx"
