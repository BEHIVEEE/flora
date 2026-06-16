-- schema/mysql_schema.sql
-- FloraChemist MySQL schema — RMS catalog + separate enrichment tables
-- Enrichment NEVER modifies RMS stock/price fields on the website MongoDB directly.

CREATE DATABASE IF NOT EXISTS chemistshop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chemistshop;

-- 1. RMS catalog staging (synced from Prompt RMS export — master for stock/MRP)
CREATE TABLE IF NOT EXISTS products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rms_id VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500),
    manufacturer VARCHAR(255),
    normalized_manufacturer VARCHAR(255),
    mrp DECIMAL(10, 2) DEFAULT 0.00,
    stock INT DEFAULT 0,
    pack_size VARCHAR(100),
    barcode VARCHAR(100),
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_barcode (barcode),
    INDEX idx_products_name_mfr (product_name, manufacturer),
    INDEX idx_products_rms_id (rms_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. DataRequisite medicine database staging
CREATE TABLE IF NOT EXISTS dr_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500),
    manufacturer VARCHAR(255),
    composition TEXT,
    description LONGTEXT,
    category VARCHAR(255),
    pack_size VARCHAR(100),
    barcode VARCHAR(100),
    prescription_required VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dr_barcode (barcode),
    INDEX idx_dr_norm_name (normalized_name(100)),
    INDEX idx_dr_manufacturer (manufacturer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. DataRequisite image staging
CREATE TABLE IF NOT EXISTS dr_images (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(500),
    normalized_name VARCHAR(500),
    manufacturer VARCHAR(255),
    image_url TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dr_img_norm (normalized_name(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Permanent match mapping — reuse on future runs
CREATE TABLE IF NOT EXISTS product_match_mapping (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    datarequisite_product_id BIGINT NOT NULL,
    confidence_score DECIMAL(5,2),
    match_method VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_id (product_id),
    INDEX idx_dr_product (datarequisite_product_id),
    CONSTRAINT fk_pmm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Enrichment payload (separate from RMS)
CREATE TABLE IF NOT EXISTS product_enrichment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    composition TEXT,
    prescription_required VARCHAR(50),
    description LONGTEXT,
    category VARCHAR(255),
    image_url TEXT,
    cloudinary_url TEXT,
    confidence_score DECIMAL(5,2),
    matched_product_name VARCHAR(500),
    matched_database_id BIGINT,
    match_method VARCHAR(100),
    review_status ENUM('auto_matched','review_required','rejected','approved') DEFAULT 'auto_matched',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pe_product (product_id),
    INDEX idx_pe_review (review_status),
    CONSTRAINT fk_pe_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Downloaded / uploaded images (multi-image support)
CREATE TABLE IF NOT EXISTS product_images (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    source_url TEXT,
    local_path VARCHAR(500),
    cloudinary_url TEXT,
    public_id VARCHAR(255),
    status ENUM('pending','downloaded','uploaded','failed') DEFAULT 'pending',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pi_product (product_id),
    CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Job tracking
CREATE TABLE IF NOT EXISTS enrichment_jobs (
    id VARCHAR(36) PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'queued',
    total_products INT DEFAULT 0,
    processed_products INT DEFAULT 0,
    matched_count INT DEFAULT 0,
    review_count INT DEFAULT 0,
    unmatched_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Match audit trail (all runs)
CREATE TABLE IF NOT EXISTS match_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT,
    rms_id VARCHAR(100),
    dr_product_id BIGINT,
    match_method VARCHAR(100),
    confidence DECIMAL(5,2),
    status ENUM('auto_matched','review_required','rejected','accepted','declined') DEFAULT 'rejected',
    rms_name VARCHAR(500),
    dr_name VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_product (product_id),
    INDEX idx_audit_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Match cache for incremental processing
CREATE TABLE IF NOT EXISTS match_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_key VARCHAR(255) NOT NULL,
    confidence DECIMAL(5,2) DEFAULT 0,
    match_method VARCHAR(50),
    status ENUM('auto_matched','review_required','rejected') NOT NULL,
    dr_snapshot JSON,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_key (product_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Brand aliases (configurable)
CREATE TABLE IF NOT EXISTS brand_aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alias VARCHAR(100) NOT NULL UNIQUE,
    brand VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
