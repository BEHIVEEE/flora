"""Load and validate configuration."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class MatcherConfig:
    raw: dict[str, Any] = field(default_factory=dict)
    base_dir: Path = field(default_factory=Path.cwd)

    @classmethod
    def load(cls, settings_path: str | Path, base_dir: Path | None = None) -> MatcherConfig:
        path = Path(settings_path)
        with path.open(encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        return cls(raw=raw, base_dir=base_dir or path.parent.parent)

    def get(self, *keys: str, default: Any = None) -> Any:
        node: Any = self.raw
        for key in keys:
            if not isinstance(node, dict) or key not in node:
                return default
            node = node[key]
        return node

    @property
    def batch_size(self) -> int:
        return int(self.get("processing", "batch_size", default=5000))

    @property
    def chunk_read_size(self) -> int:
        return int(self.get("processing", "chunk_read_size", default=50000))

    @property
    def max_candidates(self) -> int:
        return int(self.get("processing", "max_candidates_per_product", default=50))

    @property
    def enable_semantic(self) -> bool:
        return bool(self.get("processing", "enable_semantic_stage", default=True))

    @property
    def semantic_model(self) -> str:
        return str(self.get("processing", "semantic_model", default="all-MiniLM-L6-v2"))

    @property
    def scoring_weights(self) -> dict[str, float]:
        return dict(self.get("scoring", "weights", default={}))

    @property
    def thresholds(self) -> dict[str, float]:
        return dict(self.get("scoring", "thresholds", default={}))

    def resolve_path(self, *keys: str) -> Path:
        rel = self.get(*keys)
        if not rel:
            raise KeyError(".".join(keys))
        p = Path(rel)
        return p if p.is_absolute() else self.base_dir / p
