#!/usr/bin/env python3
"""
Product matching CLI — match Dataset A (your website) to Dataset B (DataRequisite).

Usage:
  python main.py index --dataset-b path/to/datarequisite.csv
  python main.py match --dataset-a path/to/products.csv --dataset-b path/to/datarequisite.csv
  python main.py match --dataset-a products.csv --dataset-b drugs.csv --output results.csv --rebuild-index
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running from product-matcher/ without pip install
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from product_matcher.config import MatcherConfig
from product_matcher.logging_config import setup_logging
from product_matcher.pipeline import ProductMatchingPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scalable pharmacy product matching pipeline",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--config",
        default=str(ROOT / "config" / "settings.yaml"),
        help="Path to settings.yaml",
    )
    parser.add_argument(
        "--brand-aliases",
        default=str(ROOT / "config" / "brand_aliases.yaml"),
        help="Path to brand_aliases.yaml",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    parser.add_argument(
        "--no-semantic",
        action="store_true",
        help="Disable sentence-transformer semantic stage (faster, less accurate)",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    idx = sub.add_parser("index", help="Build/rebuild catalog index from Dataset B only")
    idx.add_argument("--dataset-b", required=True, help="Path to DataRequisite CSV")
    idx.add_argument("--rebuild", action="store_true", help="Force rebuild index")

    match = sub.add_parser("match", help="Run full matching pipeline")
    match.add_argument("--dataset-a", required=True, help="Path to your website products CSV")
    match.add_argument("--dataset-b", required=True, help="Path to DataRequisite CSV")
    match.add_argument("--output", help="Output CSV path")
    match.add_argument("--rebuild-index", action="store_true", help="Force rebuild catalog index")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = MatcherConfig.load(args.config, base_dir=ROOT)
    log_file = config.get("logging", "file")
    if log_file and not Path(log_file).is_absolute():
        log_file = str(ROOT / log_file)
    logger = setup_logging(args.log_level, log_file)

    if args.no_semantic:
        config.raw.setdefault("processing", {})["enable_semantic_stage"] = False

    pipeline = ProductMatchingPipeline(config, Path(args.brand_aliases))

    if args.command == "index":
        pipeline.build_index(args.dataset_b, force_rebuild=args.rebuild)
        logger.info("Index build complete.")
        return 0

    if args.command == "match":
        output = args.output
        if output and not Path(output).is_absolute():
            output = str(ROOT / output)

        def progress(done: int, total: int) -> None:
            if done % max(1, total // 20) == 0 or done == total:
                logger.info("Progress: %d/%d", done, total)

        pipeline.run(
            dataset_a_path=args.dataset_a,
            dataset_b_path=args.dataset_b,
            output_path=output,
            force_rebuild_index=args.rebuild_index,
            progress_callback=progress,
        )
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
