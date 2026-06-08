"""Text normalization and unit standardization."""

from __future__ import annotations

import re
import unicodedata

# Unit normalization patterns (order matters: longer tokens first)
UNIT_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bkilograms?\b", re.I), "kg"),
    (re.compile(r"\bgrams?\b", re.I), "g"),
    (re.compile(r"\bgm\b", re.I), "g"),
    (re.compile(r"\bgms\b", re.I), "g"),
    (re.compile(r"\bkilograms?\b", re.I), "kg"),
    (re.compile(r"\bliters?\b", re.I), "l"),
    (re.compile(r"\blitre?s?\b", re.I), "l"),
    (re.compile(r"\bmls?\b", re.I), "ml"),
    (re.compile(r"\bmilliliters?\b", re.I), "ml"),
    (re.compile(r"\bmilligrams?\b", re.I), "mg"),
    (re.compile(r"\bmicrograms?\b", re.I), "mcg"),
    (re.compile(r"\biu\b", re.I), "iu"),
    (re.compile(r"\btablets?\b", re.I), "tablet"),
    (re.compile(r"\btabs?\b", re.I), "tablet"),
    (re.compile(r"\bcapsules?\b", re.I), "capsule"),
    (re.compile(r"\bcaps?\b", re.I), "capsule"),
    (re.compile(r"\bsoftgels?\b", re.I), "softgel"),
    (re.compile(r"\bsoft gelatin capsules?\b", re.I), "softgel"),
    (re.compile(r"\bsachets?\b", re.I), "sachet"),
    (re.compile(r"\bstrip\b", re.I), "strip"),
    (re.compile(r"\bstrips?\b", re.I), "strip"),
    (re.compile(r"\bbottles?\b", re.I), "bottle"),
    (re.compile(r"\btubes?\b", re.I), "tube"),
    (re.compile(r"\bjar\b", re.I), "jar"),
    (re.compile(r"\bpacks?\b", re.I), "pack"),
    (re.compile(r"\bpouches?\b", re.I), "pouch"),
]

# Form normalization
FORM_ALIASES: dict[str, str] = {
    "tab": "tablet",
    "tabs": "tablet",
    "cap": "capsule",
    "caps": "capsule",
    "syr": "syrup",
    "susp": "suspension",
    "inj": "injection",
    "oint": "ointment",
    "crm": "cream",
    "lot": "lotion",
    "cln": "cleanser",
    "clns": "cleanser",
    "pwd": "powder",
    "sol": "solution",
    "drops": "drop",
    "drop": "drop",
    "gel": "gel",
    "spray": "spray",
    "shampoo": "shampoo",
    "soap": "soap",
    "serum": "serum",
    "toner": "toner",
    "moisturizer": "moisturizer",
    "moisturiser": "moisturizer",
    "face wash": "face wash",
    "facewash": "face wash",
    "pet food": "pet food",
    "dog food": "pet food",
    "cat food": "pet food",
}

# Characters to strip (keep alphanumeric, space, %, +, /, .)
SPECIAL_CHARS_RE = re.compile(r"[^\w\s%+/.\-]", re.UNICODE)
MULTI_SPACE_RE = re.compile(r"\s+")
PACK_OF_RE = re.compile(r"\bpack\s+of\s+(\d+)\b", re.I)
STRIP_OF_RE = re.compile(r"\bstrip\s+of\s+(\d+)\b", re.I)


def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def normalize_units(text: str) -> str:
    result = text
    for pattern, replacement in UNIT_REPLACEMENTS:
        result = pattern.sub(replacement, result)
    for alias, canonical in FORM_ALIASES.items():
        result = re.sub(rf"\b{re.escape(alias)}\b", canonical, result, flags=re.I)
    return result


def normalize_text(text: str) -> str:
    """Full normalization pipeline for matching."""
    if not text or not isinstance(text, str):
        return ""

    result = strip_accents(text).lower().strip()
    result = SPECIAL_CHARS_RE.sub(" ", result)
    result = normalize_units(result)
    result = PACK_OF_RE.sub(r"pack \1", result)
    result = STRIP_OF_RE.sub(r"strip \1", result)
    result = MULTI_SPACE_RE.sub(" ", result).strip()
    return result


def normalize_strength(value: str | None) -> str | None:
    """Normalize strength tokens like 500mg, 2.5%, 1000 iu."""
    if not value:
        return None
    v = normalize_text(value)
    v = v.replace(" ", "")
    return v or None


def normalize_quantity(value: str | None) -> str | None:
    """Normalize quantity like 30 g, 100 ml, 3 kg."""
    if not value:
        return None
    v = normalize_text(value)
    v = re.sub(r"(\d+)\s*([a-z%]+)", r"\1\2", v)
    return v or None
