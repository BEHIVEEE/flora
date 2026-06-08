#!/usr/bin/env python3
"""
Optional helper: export MongoDB products collection to CSV for Dataset A.

Requires: pip install pymongo python-dotenv

Usage:
  python scripts/export_mongo_products.py --uri mongodb://localhost:27017 --db flora --out data/my_products.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export MongoDB products to CSV")
    parser.add_argument("--uri", default="mongodb://localhost:27017", help="MongoDB connection URI")
    parser.add_argument("--db", default="flora", help="Database name")
    parser.add_argument("--collection", default="products", help="Collection name")
    parser.add_argument("--out", required=True, help="Output CSV path")
    args = parser.parse_args()

    try:
        from pymongo import MongoClient
    except ImportError as exc:
        raise SystemExit("Install pymongo: pip install pymongo") from exc

    client = MongoClient(args.uri)
    coll = client[args.db][args.collection]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fields = ["id", "name", "brand", "packSize", "category"]
    count = 0
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for doc in coll.find({}, {"_id": 0, "id": 1, "name": 1, "brand": 1, "packSize": 1, "category": 1}):
            writer.writerow({
                "id": doc.get("id", ""),
                "name": doc.get("name", ""),
                "brand": doc.get("brand", ""),
                "packSize": doc.get("packSize", ""),
                "category": doc.get("category", ""),
            })
            count += 1

    print(f"Exported {count} products to {out_path}")


if __name__ == "__main__":
    main()
