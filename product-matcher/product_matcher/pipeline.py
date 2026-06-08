"""End-to-end matching pipeline orchestration."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd
from tqdm import tqdm

from product_matcher.attribute_extractor import AttributeExtractor
from product_matcher.blocking import CatalogIndex, CatalogRecord
from product_matcher.brand_aliases import BrandAliasResolver
from product_matcher.config import MatcherConfig
from product_matcher.io_utils import load_dataset_a, load_dataset_b, parse_image_urls, write_results_csv
from product_matcher.scorer import ConfidenceScorer
from product_matcher.stages import MultiStageMatcher

logger = logging.getLogger("product_matcher.pipeline")


class EmbeddingModel:
    """Lazy-loaded sentence-transformer for semantic stage."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", batch_size: int = 256):
        self.model_name = model_name
        self.batch_size = batch_size
        self._model = None

    def _load(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading embedding model: %s", self.model_name)
            self._model = SentenceTransformer(self.model_name)

    def encode(self, texts: list[str]) -> np.ndarray:
        self._load()
        embeddings = self._model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return np.asarray(embeddings, dtype=np.float32)

    def encode_catalog(self, index: CatalogIndex) -> None:
        """Pre-compute embeddings for all catalog records."""
        ids = list(index.records.keys())
        texts = [index.records[i].normalized_name for i in ids]
        logger.info("Encoding %d catalog products for semantic matching", len(texts))
        for start in tqdm(range(0, len(texts), self.batch_size), desc="Catalog embeddings"):
            batch_ids = ids[start : start + self.batch_size]
            batch_texts = texts[start : start + self.batch_size]
            embs = self.encode(batch_texts)
            for pid, emb in zip(batch_ids, embs):
                index.records[pid].embedding = emb


class ProductMatchingPipeline:
    def __init__(self, config: MatcherConfig, brand_aliases_path: Path):
        self.config = config
        self.brand_resolver = BrandAliasResolver.from_yaml(brand_aliases_path)
        self.extractor = AttributeExtractor(self.brand_resolver)
        self.scorer = ConfidenceScorer(
            weights=config.scoring_weights,
            thresholds=config.thresholds,
        )
        self.embedding_model: EmbeddingModel | None = None
        if config.enable_semantic:
            self.embedding_model = EmbeddingModel(
                model_name=config.semantic_model,
                batch_size=int(config.get("processing", "embedding_batch_size", default=256)),
            )

    def build_index(
        self,
        dataset_b_path: str | Path,
        force_rebuild: bool = False,
    ) -> CatalogIndex:
        index_dir = self.config.resolve_path("paths", "index_dir")
        if not force_rebuild and (index_dir / "index_meta.json").exists():
            logger.info("Loading existing catalog index from %s", index_dir)
            return CatalogIndex.load(index_dir)

        logger.info("Building catalog index from %s", dataset_b_path)
        df = load_dataset_b(
            dataset_b_path,
            id_col=self.config.get("input", "dataset_b", "id_column", default="Product ID"),
            name_col=self.config.get("input", "dataset_b", "name_column", default="Product Name"),
            image_col=self.config.get("input", "dataset_b", "image_column", default="Image_Urls"),
            brand_col=self.config.get("input", "dataset_b", "brand_column", default="Marketer"),
        )

        index = CatalogIndex()
        for _, row in tqdm(df.iterrows(), total=len(df), desc="Indexing catalog"):
            attrs = self.extractor.extract(
                row["product_name"],
                explicit_brand=row.get("brand") or None,
                extra_pack=row.get("packaging") or None,
                extra_form=row.get("form") or None,
            )
            images = parse_image_urls(row.get("image_urls_raw", ""))
            index.add(
                CatalogRecord(
                    product_id=row["product_id"],
                    raw_name=row["product_name"],
                    attrs=attrs,
                    image_urls=images,
                )
            )

        if self.embedding_model and self.config.enable_semantic:
            self.embedding_model.encode_catalog(index)

        index.save(index_dir)
        return index

    def run(
        self,
        dataset_a_path: str | Path,
        dataset_b_path: str | Path,
        output_path: str | Path | None = None,
        force_rebuild_index: bool = False,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> pd.DataFrame:
        start = time.time()
        index = self.build_index(dataset_b_path, force_rebuild=force_rebuild_index)

        embed_fn = None
        if self.embedding_model:

            def embed_fn(texts: list[str]) -> np.ndarray:
                return self.embedding_model.encode(texts)

        matcher = MultiStageMatcher(
            index=index,
            scorer=self.scorer,
            max_candidates=self.config.max_candidates,
            min_fuzzy_score=float(self.config.get("processing", "min_fuzzy_score", default=75)),
            min_semantic_score=float(self.config.get("processing", "min_semantic_score", default=0.72)),
            enable_semantic=self.config.enable_semantic,
            embed_fn=embed_fn,
        )

        df_a = load_dataset_a(
            dataset_a_path,
            id_col=self.config.get("input", "dataset_a", "id_column", default="id"),
            name_col=self.config.get("input", "dataset_a", "name_column", default="name"),
            brand_col=self.config.get("input", "dataset_a", "brand_column", default="brand"),
        )

        results: list[dict[str, Any]] = []
        batch_size = self.config.batch_size
        total = len(df_a)

        stats = {"auto_accept": 0, "manual_review": 0, "rejected": 0, "unmatched": 0}

        for batch_start in range(0, total, batch_size):
            batch = df_a.iloc[batch_start : batch_start + batch_size]
            for _, row in batch.iterrows():
                attrs = self.extractor.extract(
                    row["product_name"],
                    explicit_brand=row.get("brand") or None,
                )
                match = matcher.match(attrs)

                if match and match.review_status != "rejected":
                    urls = match.image_urls
                    result = {
                        "my_product_id": row["product_id"],
                        "my_product_name": row["product_name"],
                        "matched_product_id": match.catalog_id,
                        "matched_product_name": match.catalog_name,
                        "image_url_1": urls[0] if len(urls) > 0 else "",
                        "image_url_2": urls[1] if len(urls) > 1 else "",
                        "image_url_3": urls[2] if len(urls) > 2 else "",
                        "confidence_score": match.confidence,
                        "match_stage": match.stage,
                        "review_status": match.review_status,
                    }
                    stats[match.review_status] = stats.get(match.review_status, 0) + 1
                else:
                    result = {
                        "my_product_id": row["product_id"],
                        "my_product_name": row["product_name"],
                        "matched_product_id": "",
                        "matched_product_name": "",
                        "image_url_1": "",
                        "image_url_2": "",
                        "image_url_3": "",
                        "confidence_score": 0,
                        "match_stage": 0,
                        "review_status": "rejected",
                    }
                    stats["unmatched"] += 1

                results.append(result)

            done = min(batch_start + batch_size, total)
            if progress_callback:
                progress_callback(done, total)
            logger.info(
                "Processed %d / %d (%.1f%%)",
                done,
                total,
                done / total * 100,
            )

        out_path = output_path or self.config.resolve_path("paths", "output_dir") / "match_results.csv"
        write_results_csv(results, out_path)

        elapsed = time.time() - start
        logger.info(
            "Matching complete in %.1fs | auto_accept=%d manual_review=%d rejected/unmatched=%d",
            elapsed,
            stats.get("auto_accept", 0),
            stats.get("manual_review", 0),
            stats.get("rejected", 0) + stats.get("unmatched", 0),
        )

        return pd.DataFrame(results)
