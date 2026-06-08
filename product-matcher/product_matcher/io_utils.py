"""CSV I/O with flexible column detection and chunked reading."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

logger = logging.getLogger("product_matcher.io")


def resolve_column(df: pd.DataFrame, preferred: str, fallbacks: list[str]) -> str | None:
    cols_lower = {c.lower().strip(): c for c in df.columns}
    for name in [preferred] + fallbacks:
        key = name.lower().strip()
        if key in cols_lower:
            return cols_lower[key]
    return None


def parse_image_urls(value: Any, separator: str = "|") -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    text = str(value).strip()
    if not text:
        return []
    parts = [p.strip() for p in text.split(separator)]
    return [p for p in parts if p.startswith("http")]


def read_csv_chunks(
    path: str | Path,
    chunk_size: int = 50000,
    usecols: list[str] | None = None,
) -> Iterator[pd.DataFrame]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")
    logger.info("Reading %s in chunks of %d", path, chunk_size)
    for chunk in pd.read_csv(path, chunksize=chunk_size, dtype=str, low_memory=False, usecols=usecols):
        yield chunk.fillna("")


def load_dataset_a(
    path: str | Path,
    id_col: str = "id",
    name_col: str = "name",
    brand_col: str = "brand",
) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, low_memory=False).fillna("")
    id_c = resolve_column(df, id_col, ["product_id", "product id", "Product ID", "id", "_id"])
    name_c = resolve_column(df, name_col, ["product_name", "product name", "Product Name", "name"])
    brand_c = resolve_column(df, brand_col, ["brand", "company", "marketer", "Brand"])

    if not id_c or not name_c:
        raise ValueError(
            f"Dataset A must have id and name columns. Found: {list(df.columns)[:20]}"
        )

    out = pd.DataFrame({
        "product_id": df[id_c].astype(str).str.strip(),
        "product_name": df[name_c].astype(str).str.strip(),
        "brand": df[brand_c].astype(str).str.strip() if brand_c else "",
    })
    out = out[out["product_name"] != ""].drop_duplicates(subset=["product_id"])
    logger.info("Loaded %d products from Dataset A", len(out))
    return out


def load_dataset_b(
    path: str | Path,
    id_col: str = "Product ID",
    name_col: str = "Product Name",
    image_col: str = "Image_Urls",
    brand_col: str = "Marketer",
    packaging_col: str = "Packaging Detail",
    form_col: str = "Product Form",
) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, low_memory=False).fillna("")
    id_c = resolve_column(df, id_col, ["product_id", "Product ID", "id"])
    name_c = resolve_column(df, name_col, ["product_name", "Product Name", "name"])
    img_c = resolve_column(df, image_col, ["Image_Urls", "image_urls", "imageUrl"])
    brand_c = resolve_column(df, brand_col, ["Marketer", "brand", "company"])
    pack_c = resolve_column(df, packaging_col, ["Packaging Detail", "packSize", "Package"])
    form_c = resolve_column(df, form_col, ["Product Form", "form"])

    if not id_c or not name_c:
        raise ValueError(
            f"Dataset B must have id and name columns. Found: {list(df.columns)[:20]}"
        )

    out = pd.DataFrame({
        "product_id": df[id_c].astype(str).str.strip(),
        "product_name": df[name_c].astype(str).str.strip(),
        "brand": df[brand_c].astype(str).str.strip() if brand_c else "",
        "packaging": df[pack_c].astype(str).str.strip() if pack_c else "",
        "form": df[form_c].astype(str).str.strip() if form_c else "",
        "image_urls_raw": df[img_c].astype(str).str.strip() if img_c else "",
    })
    out = out[out["product_name"] != ""].drop_duplicates(subset=["product_id"])
    logger.info("Loaded %d products from Dataset B", len(out))
    return out


def write_results_csv(rows: list[dict[str, Any]], output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    cols = [
        "my_product_id",
        "my_product_name",
        "matched_product_id",
        "matched_product_name",
        "image_url_1",
        "image_url_2",
        "image_url_3",
        "confidence_score",
        "match_stage",
        "review_status",
    ]
    for c in cols:
        if c not in df.columns:
            df[c] = ""
    df[cols].to_csv(path, index=False, encoding="utf-8-sig")
    logger.info("Wrote %d match results to %s", len(df), path)
