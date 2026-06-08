"""Confidence scoring and review status assignment."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from product_matcher.attribute_extractor import ProductAttributes


@dataclass
class MatchScore:
    confidence: float
    review_status: str  # auto_accept | manual_review | rejected
    stage: int
    breakdown: dict[str, Any]
    catalog_id: str
    catalog_name: str
    image_urls: list[str]


class ConfidenceScorer:
    def __init__(
        self,
        weights: dict[str, float] | None = None,
        thresholds: dict[str, float] | None = None,
    ):
        self.weights = weights or {
            "exact_match": 1.0,
            "brand_match": 0.25,
            "strength_match": 0.20,
            "quantity_match": 0.15,
            "pack_match": 0.10,
            "form_match": 0.10,
            "fuzzy_score": 0.15,
            "semantic_score": 0.05,
        }
        self.thresholds = thresholds or {
            "auto_accept": 98,
            "manual_review": 90,
            "reject_below": 90,
        }

    def attribute_match_score(
        self,
        source: ProductAttributes,
        target: ProductAttributes,
    ) -> dict[str, float]:
        scores: dict[str, float] = {}

        scores["brand_match"] = 1.0 if (
            source.brand_canonical
            and target.brand_canonical
            and source.brand_canonical == target.brand_canonical
        ) else 0.0

        scores["strength_match"] = 1.0 if (
            source.strength and target.strength and source.strength == target.strength
        ) else (0.5 if not source.strength or not target.strength else 0.0)

        scores["quantity_match"] = 1.0 if (
            source.quantity and target.quantity and source.quantity == target.quantity
        ) else (0.5 if not source.quantity or not target.quantity else 0.0)

        scores["pack_match"] = 1.0 if (
            source.pack_size and target.pack_size and source.pack_size == target.pack_size
        ) else (0.5 if not source.pack_size or not target.pack_size else 0.0)

        scores["form_match"] = 1.0 if (
            source.form and target.form and source.form == target.form
        ) else (0.5 if not source.form or not target.form else 0.0)

        return scores

    def compute(
        self,
        source: ProductAttributes,
        target: ProductAttributes,
        stage: int,
        fuzzy_score: float = 0.0,
        semantic_score: float = 0.0,
        exact: bool = False,
        catalog_id: str = "",
        catalog_name: str = "",
        image_urls: list[str] | None = None,
    ) -> MatchScore:
        breakdown: dict[str, Any] = {"stage": stage}
        attr_scores = self.attribute_match_score(source, target)
        breakdown.update(attr_scores)

        if exact:
            confidence = 100.0
            breakdown["exact_match"] = 1.0
        elif stage == 2:
            # Structural match: require brand; weight attributes heavily
            if attr_scores["brand_match"] < 1.0:
                confidence = 0.0
            else:
                weighted = (
                    attr_scores["brand_match"] * self.weights.get("brand_match", 0.25)
                    + attr_scores["strength_match"] * self.weights.get("strength_match", 0.20)
                    + attr_scores["quantity_match"] * self.weights.get("quantity_match", 0.15)
                    + attr_scores["pack_match"] * self.weights.get("pack_match", 0.10)
                    + attr_scores["form_match"] * self.weights.get("form_match", 0.10)
                )
                total_w = sum(
                    self.weights.get(k, 0)
                    for k in ("brand_match", "strength_match", "quantity_match", "pack_match", "form_match")
                )
                confidence = (weighted / total_w * 100) if total_w else 0
                # Penalize missing strength when both should have it
                if source.strength and target.strength and source.strength != target.strength:
                    confidence = min(confidence, 85.0)
        else:
            # Fuzzy / semantic blended score
            breakdown["fuzzy_score"] = fuzzy_score / 100.0
            breakdown["semantic_score"] = semantic_score

            # Hard reject if brand mismatch when both known
            if (
                source.brand_canonical
                and target.brand_canonical
                and source.brand_canonical != target.brand_canonical
            ):
                confidence = min(fuzzy_score * 0.5, 75.0)
            else:
                attr_component = sum(
                    attr_scores[k] * self.weights.get(k, 0)
                    for k in ("brand_match", "strength_match", "quantity_match", "pack_match", "form_match")
                )
                attr_weight = sum(
                    self.weights.get(k, 0)
                    for k in ("brand_match", "strength_match", "quantity_match", "pack_match", "form_match")
                )
                attr_pct = (attr_component / attr_weight * 100) if attr_weight else 0

                confidence = (
                    fuzzy_score * self.weights.get("fuzzy_score", 0.15) / 0.15 * 0.55
                    + attr_pct * 0.30
                    + semantic_score * 100 * self.weights.get("semantic_score", 0.05) / 0.05 * 0.15
                )
                confidence = min(confidence, 97.5)  # cap non-exact below auto-accept

            # Strength mismatch penalty for pharma
            if source.strength and target.strength and source.strength != target.strength:
                confidence -= 15

        confidence = max(0.0, min(100.0, round(confidence, 2)))
        review_status = self._review_status(confidence)

        return MatchScore(
            confidence=confidence,
            review_status=review_status,
            stage=stage,
            breakdown=breakdown,
            catalog_id=catalog_id,
            catalog_name=catalog_name,
            image_urls=image_urls or [],
        )

    def _review_status(self, confidence: float) -> str:
        auto = float(self.thresholds.get("auto_accept", 98))
        review = float(self.thresholds.get("manual_review", 90))
        if confidence >= auto:
            return "auto_accept"
        if confidence >= review:
            return "manual_review"
        return "rejected"
