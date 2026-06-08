"""Multi-stage matching engine."""

from __future__ import annotations

import logging
from typing import Callable

import numpy as np
from rapidfuzz import fuzz

from product_matcher.attribute_extractor import ProductAttributes
from product_matcher.blocking import CatalogIndex, CatalogRecord
from product_matcher.scorer import ConfidenceScorer, MatchScore

logger = logging.getLogger("product_matcher.stages")


class MultiStageMatcher:
    """
    Stage 1: Exact normalized match
    Stage 2: Brand + quantity + strength structural match
    Stage 3: RapidFuzz fuzzy match on candidates
    Stage 4: Sentence-transformer semantic similarity
    Stage 5: Final confidence scoring
    """

    def __init__(
        self,
        index: CatalogIndex,
        scorer: ConfidenceScorer,
        max_candidates: int = 50,
        min_fuzzy_score: float = 75.0,
        min_semantic_score: float = 0.72,
        enable_semantic: bool = True,
        embed_fn: Callable[[list[str]], np.ndarray] | None = None,
    ):
        self.index = index
        self.scorer = scorer
        self.max_candidates = max_candidates
        self.min_fuzzy_score = min_fuzzy_score
        self.min_semantic_score = min_semantic_score
        self.enable_semantic = enable_semantic
        self.embed_fn = embed_fn

    def match(self, source_attrs: ProductAttributes) -> MatchScore | None:
        candidates = self.index.get_candidates(source_attrs, self.max_candidates)
        if not candidates:
            return None

        # Stage 1: Exact normalized match
        exact_ids = self.index.by_normalized.get(source_attrs.normalized_name, [])
        for pid in exact_ids:
            rec = self.index.records.get(pid)
            if rec:
                return self.scorer.compute(
                    source_attrs,
                    rec.attrs,
                    stage=1,
                    exact=True,
                    catalog_id=rec.product_id,
                    catalog_name=rec.raw_name,
                    image_urls=rec.image_urls,
                )

        # Stage 2: Brand + structural attributes
        stage2 = self._stage2_structural(source_attrs, candidates)
        if stage2 and stage2.confidence >= float(self.scorer.thresholds.get("manual_review", 90)):
            return stage2

        # Stage 3 & 4: Fuzzy + semantic on candidates
        return self._stage3_4_fuzzy_semantic(source_attrs, candidates)

    def _stage2_structural(
        self,
        source: ProductAttributes,
        candidates: list[CatalogRecord],
    ) -> MatchScore | None:
        if not source.brand_canonical:
            return None

        best: MatchScore | None = None
        for rec in candidates:
            if rec.attrs.brand_canonical != source.brand_canonical:
                continue
            # Require strength match when both present
            if source.strength and rec.attrs.strength and source.strength != rec.attrs.strength:
                continue
            score = self.scorer.compute(
                source,
                rec.attrs,
                stage=2,
                catalog_id=rec.product_id,
                catalog_name=rec.raw_name,
                image_urls=rec.image_urls,
            )
            if best is None or score.confidence > best.confidence:
                best = score
        return best

    def _stage3_4_fuzzy_semantic(
        self,
        source: ProductAttributes,
        candidates: list[CatalogRecord],
    ) -> MatchScore | None:
        query = source.normalized_name
        if not query:
            return None

        fuzzy_ranked: list[tuple[CatalogRecord, float]] = []
        for rec in candidates:
            target = rec.normalized_name
            # token_set_ratio handles word order and extra tokens well
            fuzzy = float(fuzz.token_set_ratio(query, target))
            if fuzzy >= self.min_fuzzy_score:
                fuzzy_ranked.append((rec, fuzzy))

        if not fuzzy_ranked:
            return None

        fuzzy_ranked.sort(key=lambda x: x[1], reverse=True)
        top_candidates = fuzzy_ranked[:10]

        # Stage 4: Semantic similarity on top fuzzy hits
        semantic_scores: dict[str, float] = {}
        if self.enable_semantic and self.embed_fn:
            texts = [source.normalized_name] + [r.normalized_name for r, _ in top_candidates]
            try:
                embeddings = self.embed_fn(texts)
                source_emb = embeddings[0]
                for i, (rec, _) in enumerate(top_candidates):
                    cand_emb = embeddings[i + 1]
                    sim = float(np.dot(source_emb, cand_emb) / (
                        np.linalg.norm(source_emb) * np.linalg.norm(cand_emb) + 1e-9
                    ))
                    semantic_scores[rec.product_id] = sim
            except Exception as exc:
                logger.warning("Semantic embedding failed: %s", exc)

        best: MatchScore | None = None
        for rec, fuzzy in top_candidates:
            sem = semantic_scores.get(rec.product_id, 0.0)
            if self.enable_semantic and semantic_scores and sem < self.min_semantic_score:
                continue
            score = self.scorer.compute(
                source,
                rec.attrs,
                stage=4 if semantic_scores else 3,
                fuzzy_score=fuzzy,
                semantic_score=sem,
                catalog_id=rec.product_id,
                catalog_name=rec.raw_name,
                image_urls=rec.image_urls,
            )
            if best is None or score.confidence > best.confidence:
                best = score

        return best
