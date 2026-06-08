-- PostgreSQL schema for product matching pipeline
-- Optional but recommended for 700k+ products and incremental re-runs.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Canonical preprocessed catalog (Dataset B)
CREATE TABLE IF NOT EXISTS catalog_products (
    product_id          VARCHAR(64) PRIMARY KEY,
    raw_name            TEXT NOT NULL,
    normalized_name     TEXT NOT NULL,
    brand               VARCHAR(255),
    brand_canonical     VARCHAR(255),
    product_core        TEXT,
    strength            VARCHAR(64),
    quantity            VARCHAR(64),
    pack_size           VARCHAR(64),
    form                VARCHAR(64),
    block_key           VARCHAR(512) NOT NULL,
    image_urls          TEXT[],
    embedding           BYTEA,              -- numpy float32 bytes (optional)
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_block_key ON catalog_products (block_key);
CREATE INDEX IF NOT EXISTS idx_catalog_brand ON catalog_products (brand_canonical);
CREATE INDEX IF NOT EXISTS idx_catalog_normalized ON catalog_products (normalized_name);
CREATE INDEX IF NOT EXISTS idx_catalog_normalized_trgm ON catalog_products USING gin (normalized_name gin_trgm_ops);

-- Source products pending match (Dataset A)
CREATE TABLE IF NOT EXISTS source_products (
    product_id          VARCHAR(64) PRIMARY KEY,
    raw_name            TEXT NOT NULL,
    raw_brand           VARCHAR(255),
    normalized_name     TEXT,
    brand_canonical     VARCHAR(255),
    strength            VARCHAR(64),
    quantity            VARCHAR(64),
    pack_size           VARCHAR(64),
    form                VARCHAR(64),
    block_key           VARCHAR(512),
    match_status        VARCHAR(32) DEFAULT 'pending',  -- pending | matched | rejected | review
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_status ON source_products (match_status);
CREATE INDEX IF NOT EXISTS idx_source_block_key ON source_products (block_key);

-- Match results
CREATE TABLE IF NOT EXISTS match_results (
    id                  BIGSERIAL PRIMARY KEY,
    source_product_id   VARCHAR(64) NOT NULL REFERENCES source_products(product_id),
    catalog_product_id  VARCHAR(64) REFERENCES catalog_products(product_id),
    matched_name        TEXT,
    image_url_1         TEXT,
    image_url_2         TEXT,
    image_url_3         TEXT,
    confidence_score    NUMERIC(5,2) NOT NULL,
    match_stage         SMALLINT,
    review_status       VARCHAR(16) NOT NULL,  -- auto_accept | manual_review | rejected
    score_breakdown     JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source_product_id)
);

CREATE INDEX IF NOT EXISTS idx_match_confidence ON match_results (confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_review ON match_results (review_status);

-- Blocking index (optional materialized lookup)
CREATE TABLE IF NOT EXISTS block_index (
    block_key           VARCHAR(512) NOT NULL,
    catalog_product_id  VARCHAR(64) NOT NULL REFERENCES catalog_products(product_id),
    PRIMARY KEY (block_key, catalog_product_id)
);

CREATE INDEX IF NOT EXISTS idx_block_key ON block_index (block_key);

-- Run metadata for audit
CREATE TABLE IF NOT EXISTS matcher_runs (
    run_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    finished_at         TIMESTAMPTZ,
    source_count        INTEGER,
    catalog_count       INTEGER,
    matched_count       INTEGER,
    auto_accept_count   INTEGER,
    review_count        INTEGER,
    rejected_count      INTEGER,
    config_snapshot     JSONB,
    notes               TEXT
);
