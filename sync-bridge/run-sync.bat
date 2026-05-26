@echo off
:: FloraChemist Sync Bridge
:: Double-click this file OR add it to Windows Task Scheduler to run every hour

set SYNC_FOLDER=C:\StockUpdates
set WEBSITE_URL=https://www.florachemist.online
set SYNC_API_KEY=YOUR_SYNC_API_KEY_HERE

cd /d "%~dp0"
node sync-bridge.js
