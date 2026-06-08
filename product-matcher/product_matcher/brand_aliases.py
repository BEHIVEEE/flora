"""Configurable brand abbreviation expansion."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import yaml

from product_matcher.preprocessing import normalize_text


class BrandAliasResolver:
    """Resolve abbreviations and detect canonical brand names."""

    def __init__(
        self,
        aliases: dict[str, str] | None = None,
        multi_word_brands: Iterable[str] | None = None,
    ):
        self.aliases: dict[str, str] = {
            normalize_text(k): normalize_text(v) for k, v in (aliases or {}).items()
        }
        self.multi_word_brands: list[str] = sorted(
            {normalize_text(b) for b in (multi_word_brands or [])},
            key=len,
            reverse=True,
        )

    @classmethod
    def from_yaml(cls, path: str | Path) -> BrandAliasResolver:
        with Path(path).open(encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return cls(
            aliases=data.get("aliases", {}),
            multi_word_brands=data.get("multi_word_brands", []),
        )

    def expand_token(self, token: str) -> str:
        key = normalize_text(token)
        return self.aliases.get(key, key)

    def resolve_brand(
        self,
        product_name: str,
        explicit_brand: str | None = None,
    ) -> tuple[str | None, str]:
        """
        Return (canonical_brand, brand_source).
        brand_source is 'explicit', 'multi_word', 'alias', 'token', or 'unknown'.
        """
        if explicit_brand:
            brand = normalize_text(explicit_brand)
            expanded = self.aliases.get(brand, brand)
            return expanded, "explicit"

        normalized = normalize_text(product_name)
        if not normalized:
            return None, "unknown"

        for mw in self.multi_word_brands:
            if normalized.startswith(mw + " ") or normalized == mw:
                return mw, "multi_word"

        tokens = normalized.split()
        if not tokens:
            return None, "unknown"

        first = tokens[0]
        if first in self.aliases:
            return self.aliases[first], "alias"

        # Two-token abbreviation e.g. "dot key"
        if len(tokens) >= 2:
            two = f"{tokens[0]} {tokens[1]}"
            if two in self.multi_word_brands:
                return two, "multi_word"

        # First token might already be full brand
        if len(first) >= 3:
            return first, "token"

        return None, "unknown"

    def expand_brand_in_name(self, product_name: str) -> str:
        """Replace leading abbreviation with full brand in normalized name."""
        brand, source = self.resolve_brand(product_name)
        if not brand or source == "unknown":
            return normalize_text(product_name)

        normalized = normalize_text(product_name)
        tokens = normalized.split()
        if not tokens:
            return normalized

        if source == "multi_word":
            for mw in self.multi_word_brands:
                if normalized.startswith(mw):
                    rest = normalized[len(mw) :].strip()
                    return f"{brand} {rest}".strip()

        if tokens[0] in self.aliases or source == "alias":
            rest = " ".join(tokens[1:])
            return f"{brand} {rest}".strip()

        return normalized
