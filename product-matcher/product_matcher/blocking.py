"""Blocking and indexing for efficient candidate retrieval."""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from product_matcher.attribute_extractor import ProductAttributes

logger = logging.getLogger("product_matcher.blocking")


@dataclass
class CatalogRecord:
    product_id: str
    raw_name: str
    attrs: ProductAttributes
    image_urls: list[str]
    embedding: np.ndarray | None = None

    @property
    def normalized_name(self) -> str:
        return self.attrs.normalized_name


class CatalogIndex:
    """
    In-memory blocking index for Dataset B.
    Persists to disk as JSON + numpy embeddings for reuse across runs.
    """

    def __init__(self):
        self.records: dict[str, CatalogRecord] = {}
        self.by_normalized: dict[str, list[str]] = defaultdict(list)
        self.by_block: dict[str, list[str]] = defaultdict(list)
        self.by_brand: dict[str, list[str]] = defaultdict(list)

    def add(self, record: CatalogRecord) -> None:
        pid = record.product_id
        if pid in self.records:
            return
        self.records[pid] = record
        norm = record.normalized_name
        if norm:
            self.by_normalized[norm].append(pid)
        self.by_block[record.attrs.block_key].append(pid)
        if record.attrs.brand_canonical:
            self.by_brand[record.attrs.brand_canonical].append(pid)

    def get_candidates(
        self,
        attrs: ProductAttributes,
        max_candidates: int = 50,
    ) -> list[CatalogRecord]:
        """Retrieve blocked candidate set for a source product."""
        seen: set[str] = set()
        ordered_ids: list[str] = []

        def add_ids(ids: list[str]) -> None:
            for pid in ids:
                if pid not in seen:
                    seen.add(pid)
                    ordered_ids.append(pid)

        # Primary block
        add_ids(self.by_block.get(attrs.block_key, []))

        # Brand-only block (same brand, different form/strength)
        if attrs.brand_canonical:
            add_ids(self.by_brand.get(attrs.brand_canonical, []))

        # Name prefix fallback
        prefix = attrs.normalized_name[:3] if attrs.normalized_name else ""
        if prefix:
            for block_key, ids in self.by_block.items():
                if f"p:{prefix}" in block_key:
                    add_ids(ids)

        # Exact normalized (stage 1 shortcut)
        add_ids(self.by_normalized.get(attrs.normalized_name, []))

        if len(ordered_ids) > max_candidates:
            ordered_ids = ordered_ids[:max_candidates]

        return [self.records[pid] for pid in ordered_ids if pid in self.records]

    def save(self, index_dir: str | Path) -> None:
        path = Path(index_dir)
        path.mkdir(parents=True, exist_ok=True)

        meta: dict[str, Any] = {
            "records": {},
            "by_normalized": dict(self.by_normalized),
            "by_block": dict(self.by_block),
            "by_brand": dict(self.by_brand),
        }
        embedding_ids: list[str] = []
        embedding_rows: list[np.ndarray] = []

        for pid, rec in self.records.items():
            meta["records"][pid] = {
                "product_id": rec.product_id,
                "raw_name": rec.raw_name,
                "attrs": rec.attrs.to_dict(),
                "image_urls": rec.image_urls,
            }
            if rec.embedding is not None:
                embedding_ids.append(pid)
                embedding_rows.append(rec.embedding)

        with (path / "index_meta.json").open("w", encoding="utf-8") as f:
            json.dump(meta, f)

        if embedding_rows:
            np.savez_compressed(
                path / "embeddings.npz",
                ids=np.array(embedding_ids),
                embeddings=np.vstack(embedding_rows),
            )
        logger.info("Saved index with %d catalog records to %s", len(self.records), path)

    @classmethod
    def load(cls, index_dir: str | Path) -> CatalogIndex:
        path = Path(index_dir)
        meta_path = path / "index_meta.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Index not found at {meta_path}")

        with meta_path.open(encoding="utf-8") as f:
            meta = json.load(f)

        index = cls()
        emb_map: dict[str, np.ndarray] = {}
        emb_file = path / "embeddings.npz"
        if emb_file.exists():
            data = np.load(emb_file, allow_pickle=True)
            for pid, emb in zip(data["ids"], data["embeddings"]):
                emb_map[str(pid)] = emb

        from product_matcher.attribute_extractor import ProductAttributes

        for pid, rec_data in meta["records"].items():
            attrs_dict = rec_data["attrs"]
            attrs = ProductAttributes(**attrs_dict)
            record = CatalogRecord(
                product_id=rec_data["product_id"],
                raw_name=rec_data["raw_name"],
                attrs=attrs,
                image_urls=rec_data.get("image_urls", []),
                embedding=emb_map.get(pid),
            )
            index.records[pid] = record

        index.by_normalized = defaultdict(list, meta.get("by_normalized", {}))
        index.by_block = defaultdict(list, meta.get("by_block", {}))
        index.by_brand = defaultdict(list, meta.get("by_brand", {}))
        logger.info("Loaded index with %d catalog records from %s", len(index.records), path)
        return index
