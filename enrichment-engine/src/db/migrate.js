import 'dotenv/config';
import { getPool, closePool } from './pool.js';
import logger from '../logger/index.js';

const SCHEMA = `
-- RMS catalog staging (Prompt RMS export — stock/MRP/name only, never enrichment)
CREATE TABLE IF NOT EXISTS products (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  rms_id              VARCHAR(100) UNIQUE,
  name                VARCHAR(500) NOT NULL,
  normalized_name     VARCHAR(500),
  normalized_brand    VARCHAR(255),
  normalized_pack_size VARCHAR(100),
  manufacturer        VARCHAR(255),
  mrp                 DECIMAL(10,2),
  stock               INT DEFAULT 0,
  pack_size           VARCHAR(100),
  barcode             VARCHAR(100),
  last_processed_at   DATETIME,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_barcode            (barcode),
  INDEX idx_manufacturer       (manufacturer),
  INDEX idx_last_processed     (last_processed_at),
  INDEX idx_normalized_name    (normalized_name(100)),
  INDEX idx_normalized_brand   (normalized_brand(100)),
  INDEX idx_normalized_pack    (normalized_pack_size),
  FULLTEXT INDEX ft_name       (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enrichment data (separate from RMS — safe to update independently)
CREATE TABLE IF NOT EXISTS product_enrichment (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id            BIGINT NOT NULL,
  composition           TEXT,
  prescription_required VARCHAR(50),
  description           LONGTEXT,
  category              VARCHAR(255),
  image_url             TEXT,
  cloudinary_url        TEXT,
  confidence_score      DECIMAL(5,2),
  matched_product_name  VARCHAR(500),
  matched_database_id   BIGINT,
  match_method          VARCHAR(100),
  review_status         ENUM('auto_matched','review_required','rejected','approved') DEFAULT 'auto_matched',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pe_product_id (product_id),
  INDEX idx_pe_matched_db (matched_database_id),
  INDEX idx_pe_review_status (review_status),
  CONSTRAINT fk_pe_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product images (req #19: multi-image, #18: hash dedup, #21: quality filter)
CREATE TABLE IF NOT EXISTS product_images (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id      BIGINT NOT NULL,
  source_url      TEXT,
  local_path      VARCHAR(500),
  cloudinary_url  TEXT,
  public_id       VARCHAR(255),
  image_hash      VARCHAR(64),
  image_type      ENUM('front','back','ingredients','packaging','other') DEFAULT 'other',
  width           INT,
  height          INT,
  file_size       INT,
  status          ENUM('pending','downloaded','uploaded','failed','skipped_duplicate','skipped_quality') DEFAULT 'pending',
  sort_order      INT DEFAULT 0,
  error_msg       TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_id  (product_id),
  INDEX idx_status      (status),
  INDEX idx_image_hash  (image_hash),
  INDEX idx_source_url  (source_url(100)),
  CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Image hash dedup registry (req #18)
CREATE TABLE IF NOT EXISTS image_hash_registry (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  image_hash      VARCHAR(64) NOT NULL UNIQUE,
  cloudinary_url  TEXT NOT NULL,
  public_id       VARCHAR(255) NOT NULL,
  first_seen_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  use_count       INT DEFAULT 1,
  INDEX idx_hash (image_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Image quality failures (req #21)
CREATE TABLE IF NOT EXISTS image_failures (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id      BIGINT,
  source_url      TEXT,
  failure_reason  VARCHAR(255),
  failure_detail  TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_id    (product_id),
  INDEX idx_failure_reason (failure_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Brand aliases (req #17: alias learning)
CREATE TABLE IF NOT EXISTS brand_aliases (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  alias       VARCHAR(100) NOT NULL UNIQUE,
  brand       VARCHAR(200) NOT NULL,
  source      ENUM('manual','learned') DEFAULT 'manual',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alias (alias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Brand alias suggestions pending admin approval (req #17)
CREATE TABLE IF NOT EXISTS brand_alias_suggestions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  alias           VARCHAR(100) NOT NULL,
  suggested_brand VARCHAR(200) NOT NULL,
  detection_count INT DEFAULT 1,
  avg_confidence  DECIMAL(5,2),
  example_rms     VARCHAR(500),
  example_dr      VARCHAR(500),
  status          ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by     VARCHAR(100),
  reviewed_at     DATETIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alias_brand (alias, suggested_brand),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DataRequisite product database (enrichment source)
CREATE TABLE IF NOT EXISTS dr_products (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(500) NOT NULL,
  normalized_name VARCHAR(500),
  manufacturer    VARCHAR(255),
  description     MEDIUMTEXT,
  composition     MEDIUMTEXT,
  category        VARCHAR(255),
  pack_size       VARCHAR(100),
  barcode         VARCHAR(100),
  prescription_required VARCHAR(50),
  raw_data        JSON,
  INDEX idx_dr_barcode       (barcode),
  INDEX idx_dr_manufacturer  (manufacturer),
  INDEX idx_dr_norm_name     (normalized_name(100)),
  FULLTEXT INDEX ft_dr_name  (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DataRequisite image file
CREATE TABLE IF NOT EXISTS dr_images (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_name    VARCHAR(500),
  normalized_name VARCHAR(500),
  manufacturer    VARCHAR(255),
  image_url       TEXT NOT NULL,
  image_type      ENUM('front','back','ingredients','packaging','other') DEFAULT 'other',
  sort_order      INT DEFAULT 0,
  raw_data        JSON,
  INDEX idx_norm_name (normalized_name(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permanent match mapping — reuse on future runs instead of rematching
CREATE TABLE IF NOT EXISTS product_match_mapping (
  id                        BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id                BIGINT NOT NULL,
  datarequisite_product_id  BIGINT NOT NULL,
  confidence_score          DECIMAL(5,2),
  match_method              VARCHAR(100),
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_id (product_id),
  INDEX idx_dr_product (datarequisite_product_id),
  INDEX idx_confidence (confidence_score),
  CONSTRAINT fk_pmm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Match audit log
CREATE TABLE IF NOT EXISTS match_audit (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id          BIGINT,
  rms_id              VARCHAR(100),
  dr_product_id       BIGINT,
  match_method        VARCHAR(100),
  confidence          DECIMAL(5,2),
  status              ENUM('auto_matched','review_required','rejected','accepted','declined'),
  reviewer            VARCHAR(100),
  reviewed_at         DATETIME,
  rms_name            VARCHAR(500),
  dr_name             VARCHAR(500),
  rms_manufacturer    VARCHAR(255),
  dr_manufacturer     VARCHAR(255),
  rms_pack_size       VARCHAR(100),
  dr_pack_size        VARCHAR(100),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id),
  INDEX idx_status     (status),
  INDEX idx_method     (match_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job checkpoints for resume support (req #24)
CREATE TABLE IF NOT EXISTS job_checkpoints (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id          VARCHAR(100) NOT NULL,
  job_type        VARCHAR(100) NOT NULL,
  last_offset     INT DEFAULT 0,
  last_id         BIGINT DEFAULT 0,
  processed_count INT DEFAULT 0,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_job_id (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job logs for pipeline runs (req #24: resume support)
CREATE TABLE IF NOT EXISTS job_logs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id          VARCHAR(100) NOT NULL UNIQUE,
  job_type        VARCHAR(100),
  status          ENUM('running','completed','failed','cancelled') DEFAULT 'running',
  total           INT DEFAULT 0,
  processed       INT DEFAULT 0,
  success_count   INT DEFAULT 0,
  fail_count      INT DEFAULT 0,
  meta            JSON,
  started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at     DATETIME,
  INDEX idx_job_type (job_type),
  INDEX idx_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Match result cache (stage 11) — reuse prior matches without recomputing
CREATE TABLE IF NOT EXISTS match_cache (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_key     VARCHAR(255) NOT NULL,
  confidence      DECIMAL(5,2) DEFAULT 0,
  match_method    VARCHAR(50),
  status          ENUM('auto_matched','review_required','rejected') NOT NULL,
  dr_snapshot     JSON,
  reason          TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_key (product_key),
  INDEX idx_status (status),
  INDEX idx_match_method (match_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function migrate() {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    logger.info('Running migrations…');
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await conn.execute(stmt);
    }
    logger.info('Migrations complete');
  } finally {
    conn.release();
    await closePool();
  }
}

migrate().catch(err => {
  logger.error('Migration failed', { err: err.message });
  process.exit(1);
});
