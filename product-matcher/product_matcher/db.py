"""Optional PostgreSQL integration."""

from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from typing import Any, Iterator

logger = logging.getLogger("product_matcher.db")

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


class PostgresStore:
    def __init__(self, dsn: str):
        if not HAS_PSYCOPG2:
            raise RuntimeError("psycopg2-binary is required for PostgreSQL support")
        self.dsn = dsn

    @contextmanager
    def connection(self) -> Iterator[Any]:
        conn = psycopg2.connect(self.dsn)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_schema(self, schema_path: str) -> None:
        with open(schema_path, encoding="utf-8") as f:
            sql = f.read()
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
        logger.info("PostgreSQL schema initialized")

    def upsert_catalog_batch(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        sql = """
            INSERT INTO catalog_products (
                product_id, raw_name, normalized_name, brand, brand_canonical,
                product_core, strength, quantity, pack_size, form, block_key, image_urls
            ) VALUES (
                %(product_id)s, %(raw_name)s, %(normalized_name)s, %(brand)s, %(brand_canonical)s,
                %(product_core)s, %(strength)s, %(quantity)s, %(pack_size)s, %(form)s, %(block_key)s, %(image_urls)s
            )
            ON CONFLICT (product_id) DO UPDATE SET
                raw_name = EXCLUDED.raw_name,
                normalized_name = EXCLUDED.normalized_name,
                brand = EXCLUDED.brand,
                brand_canonical = EXCLUDED.brand_canonical,
                product_core = EXCLUDED.product_core,
                strength = EXCLUDED.strength,
                quantity = EXCLUDED.quantity,
                pack_size = EXCLUDED.pack_size,
                form = EXCLUDED.form,
                block_key = EXCLUDED.block_key,
                image_urls = EXCLUDED.image_urls,
                updated_at = NOW()
        """
        with self.connection() as conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_batch(cur, sql, rows, page_size=1000)

    def upsert_match_batch(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        sql = """
            INSERT INTO match_results (
                source_product_id, catalog_product_id, matched_name,
                image_url_1, image_url_2, image_url_3,
                confidence_score, match_stage, review_status, score_breakdown
            ) VALUES (
                %(source_product_id)s, %(catalog_product_id)s, %(matched_name)s,
                %(image_url_1)s, %(image_url_2)s, %(image_url_3)s,
                %(confidence_score)s, %(match_stage)s, %(review_status)s, %(score_breakdown)s
            )
            ON CONFLICT (source_product_id) DO UPDATE SET
                catalog_product_id = EXCLUDED.catalog_product_id,
                matched_name = EXCLUDED.matched_name,
                image_url_1 = EXCLUDED.image_url_1,
                image_url_2 = EXCLUDED.image_url_2,
                image_url_3 = EXCLUDED.image_url_3,
                confidence_score = EXCLUDED.confidence_score,
                match_stage = EXCLUDED.match_stage,
                review_status = EXCLUDED.review_status,
                score_breakdown = EXCLUDED.score_breakdown,
                created_at = NOW()
        """
        for row in rows:
            row["score_breakdown"] = json.dumps(row.get("score_breakdown", {}))
        with self.connection() as conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_batch(cur, sql, rows, page_size=1000)
