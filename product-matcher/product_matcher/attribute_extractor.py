"""Extract structured attributes from product names."""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any

from product_matcher.brand_aliases import BrandAliasResolver
from product_matcher.preprocessing import (
    normalize_quantity,
    normalize_strength,
    normalize_text,
)

STRENGTH_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*"
    r"(mg|mcg|g|gm|kg|ml|l|iu|%|w/w|w/v)\b",
    re.I,
)

QUANTITY_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|kg|ml|l|iu)\b",
    re.I,
)

PACK_COUNT_RE = re.compile(
    r"(?:strip|pack|bottle|tube|jar|box|sachet)\s*(?:of\s+)?(\d+)\b",
    re.I,
)
PACK_COUNT_ALT_RE = re.compile(r"\b(\d+)\s*(tablet|capsule|tab|cap)s?\b", re.I)

FORM_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\btablet\s*er\b", re.I), "tablet er"),
    (re.compile(r"\btablet\b", re.I), "tablet"),
    (re.compile(r"\bcapsule\b", re.I), "capsule"),
    (re.compile(r"\bsyrup\b", re.I), "syrup"),
    (re.compile(r"\bsuspension\b", re.I), "suspension"),
    (re.compile(r"\binjection\b", re.I), "injection"),
    (re.compile(r"\bointment\b", re.I), "ointment"),
    (re.compile(r"\bcream\b", re.I), "cream"),
    (re.compile(r"\blotion\b", re.I), "lotion"),
    (re.compile(r"\bcleanser\b", re.I), "cleanser"),
    (re.compile(r"\bface wash\b", re.I), "face wash"),
    (re.compile(r"\bshampoo\b", re.I), "shampoo"),
    (re.compile(r"\bserum\b", re.I), "serum"),
    (re.compile(r"\btoner\b", re.I), "toner"),
    (re.compile(r"\bmoisturiz\w+\b", re.I), "moisturizer"),
    (re.compile(r"\bpowder\b", re.I), "powder"),
    (re.compile(r"\bgel\b", re.I), "gel"),
    (re.compile(r"\bspray\b", re.I), "spray"),
    (re.compile(r"\bsoap\b", re.I), "soap"),
    (re.compile(r"\bdrop\b", re.I), "drop"),
    (re.compile(r"\bpet food\b", re.I), "pet food"),
    (re.compile(r"\bdog food\b", re.I), "pet food"),
    (re.compile(r"\bcat food\b", re.I), "pet food"),
    (re.compile(r"\bsoftgel\b", re.I), "softgel"),
    (re.compile(r"\bsachet\b", re.I), "sachet"),
]


@dataclass
class ProductAttributes:
    raw_name: str
    normalized_name: str
    brand: str | None
    brand_canonical: str | None
    product_core: str
    strength: str | None
    quantity: str | None
    pack_size: str | None
    form: str | None
    block_key: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AttributeExtractor:
    def __init__(self, brand_resolver: BrandAliasResolver):
        self.brand_resolver = brand_resolver

    def extract(
        self,
        name: str,
        explicit_brand: str | None = None,
        extra_pack: str | None = None,
        extra_form: str | None = None,
    ) -> ProductAttributes:
        raw = name or ""
        normalized = self.brand_resolver.expand_brand_in_name(raw)
        brand, _ = self.brand_resolver.resolve_brand(raw, explicit_brand)

        strength = self._extract_strength(normalized)
        quantity = self._extract_quantity(normalized, strength)
        form = self._extract_form(normalized, extra_form)
        pack_size = self._extract_pack_size(normalized, extra_pack)
        product_core = self._extract_product_core(normalized, brand, strength, quantity, form, pack_size)
        block_key = self._build_block_key(brand, form, strength, normalized)

        return ProductAttributes(
            raw_name=raw,
            normalized_name=normalized,
            brand=brand,
            brand_canonical=brand,
            product_core=product_core,
            strength=strength,
            quantity=quantity,
            pack_size=pack_size,
            form=form,
            block_key=block_key,
        )

    def _extract_strength(self, text: str) -> str | None:
        matches = STRENGTH_RE.findall(text)
        if not matches:
            return None
        # Prefer mg/mcg/% strengths over container sizes
        priority = {"mg": 0, "mcg": 1, "%": 2, "iu": 3, "w/w": 4, "w/v": 5}
        best = sorted(matches, key=lambda m: priority.get(m[1].lower(), 99))[0]
        return normalize_strength(f"{best[0]}{best[1]}")

    def _extract_quantity(self, text: str, strength: str | None) -> str | None:
        for val, unit in QUANTITY_RE.findall(text):
            token = normalize_quantity(f"{val}{unit}")
            if strength and token == strength:
                continue
            # Container quantities (ml, g, kg) preferred
            if unit.lower() in {"ml", "l", "g", "gm", "kg"}:
                return token
        return None

    def _extract_form(self, text: str, extra: str | None) -> str | None:
        if extra:
            return normalize_text(extra)
        for pattern, form in FORM_PATTERNS:
            if pattern.search(text):
                return form
        return None

    def _extract_pack_size(self, text: str, extra: str | None) -> str | None:
        if extra:
            m = PACK_COUNT_RE.search(normalize_text(extra))
            if m:
                return m.group(1)
            m2 = PACK_COUNT_ALT_RE.search(normalize_text(extra))
            if m2:
                return m2.group(1)

        for pattern in (PACK_COUNT_RE, PACK_COUNT_ALT_RE):
            m = pattern.search(text)
            if m:
                return m.group(1)
        return None

    def _extract_product_core(
        self,
        text: str,
        brand: str | None,
        strength: str | None,
        quantity: str | None,
        form: str | None,
        pack_size: str | None,
    ) -> str:
        core = text
        if brand and core.startswith(brand):
            core = core[len(brand) :].strip()
        for token in (strength, quantity, form, pack_size):
            if token:
                core = re.sub(rf"\b{re.escape(str(token))}\b", " ", core, flags=re.I)
        core = re.sub(r"\bstrip\b|\bpack\b|\bbottle\b|\btube\b", " ", core, flags=re.I)
        return normalize_text(core)

    def _build_block_key(
        self,
        brand: str | None,
        form: str | None,
        strength: str | None,
        normalized: str,
    ) -> str:
        parts: list[str] = []
        if brand:
            parts.append(f"b:{brand}")
        if form:
            parts.append(f"f:{form}")
        if strength:
            parts.append(f"s:{strength}")
        if not brand:
            prefix = normalized[:3] if normalized else "unk"
            parts.append(f"p:{prefix}")
        return "|".join(parts) if parts else "unknown"
