import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const db = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pharmacy_catalog',
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0,
  timezone: '+00:00',
};

export const redis = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export const cloudinary = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  folder: process.env.CLOUDINARY_FOLDER || 'pharmacy_products',
};

export const files = {
  rms: process.env.RMS_FILE || './data/input/rms_products.xlsx',
  drugs: process.env.DRUGS_FILE || './data/input/drugs_data.xlsx',
  drugs2: process.env.DRUGS_FILE_2 || null,
  drugs3: process.env.DRUGS_FILE_3 || null,
  images: process.env.IMAGES_FILE || './data/input/drugs_images.xlsx',
  images2: process.env.IMAGES_FILE_2 || null,
};

export const output = {
  dir: process.env.OUTPUT_DIR || './data/output',
  imagesDir: process.env.IMAGES_DOWNLOAD_DIR || './data/images',
};

export const matching = {
  autoThreshold: Number(process.env.AUTO_MATCH_THRESHOLD) || 95,
  reviewThreshold: Number(process.env.REVIEW_THRESHOLD) || 85,
};

export const matchingPass2 = {
  autoThreshold: Number(process.env.PASS2_AUTO_MATCH_THRESHOLD) || 82,
  reviewThreshold: Number(process.env.PASS2_REVIEW_THRESHOLD) || 72,
};

export const matchingPass3 = {
  autoThreshold: Number(process.env.PASS3_AUTO_MATCH_THRESHOLD) || 75,
  reviewThreshold: Number(process.env.PASS3_REVIEW_THRESHOLD) || 65,
};

export const matchingPass4 = {
  autoThreshold: Number(process.env.PASS4_AUTO_MATCH_THRESHOLD) || 62,
  reviewThreshold: Number(process.env.PASS4_REVIEW_THRESHOLD) || 52,
};

export const processing = {
  batchSize: Number(process.env.BATCH_SIZE) || 2000,
  imageConcurrency: Number(process.env.IMAGE_CONCURRENCY) || 10,
  imageTimeoutMs: Number(process.env.IMAGE_TIMEOUT_MS) || 15000,
  imageRetryAttempts: Number(process.env.IMAGE_RETRY_ATTEMPTS) || 3,
  matchWorkers: Number(process.env.MATCH_WORKERS) || 0,
  useIndexCache: process.env.USE_INDEX_CACHE !== 'false',
  useMatchCache: process.env.USE_MATCH_CACHE !== 'false',
  webImageVerify: process.env.WEB_IMAGE_VERIFY !== 'false',
  webImageMinScore: Number(process.env.WEB_IMAGE_MIN_SCORE) || 42,
  webSearchConcurrency: Number(process.env.WEB_SEARCH_CONCURRENCY) || 3,
  googleCseKey: process.env.GOOGLE_CSE_API_KEY || '',
  googleCseCx: process.env.GOOGLE_CSE_CX || '',
};

export const dashboard = {
  port: Number(process.env.DASHBOARD_PORT) || 3001,
  secret: process.env.DASHBOARD_SECRET || 'changeme',
};

export const logging = {
  level: process.env.LOG_LEVEL || 'info',
  dir: process.env.LOG_DIR || './logs',
};

// Load brand aliases from JSON file if present, fallback to defaults
function loadBrandAliases() {
  const aliasFile = resolve(__dirname, '../../config/brand_aliases.json');
  if (existsSync(aliasFile)) {
    try {
      return JSON.parse(readFileSync(aliasFile, 'utf8'));
    } catch {
      // fall through to defaults
    }
  }
  return {
    him: 'himalaya',
    h: 'himalaya',
    hm: 'himalaya',
    mml: 'minimalist',
    me: 'mamaearth',
    mcf: 'mcaffeine',
    azp: 'azithromycin',
    dr: 'dr. reddy',
    drl: 'dr. reddy',
    cipla: 'cipla',
    sun: 'sun pharma',
    mankind: 'mankind',
    alkem: 'alkem',
    lupin: 'lupin',
    torrent: 'torrent',
    abbot: 'abbott',
    zydus: 'zydus',
    intas: 'intas',
    pfizer: 'pfizer',
    glenmark: 'glenmark',
    wockhardt: 'wockhardt',
    ipca: 'ipca',
    emami: 'emami',
    patanjali: 'patanjali',
    dabur: 'dabur',
    himalaya: 'himalaya',
    mamaearth: 'mamaearth',
    minimalist: 'minimalist',
  };
}

export const brandAliases = loadBrandAliases();

function loadFormSynonyms() {
  const synFile = resolve(__dirname, '../../config/form_synonyms.json');
  if (existsSync(synFile)) {
    try {
      return JSON.parse(readFileSync(synFile, 'utf8'));
    } catch {
      // fall through
    }
  }
  return {
    syrup: 'oral suspension',
    suspension: 'oral suspension',
    susp: 'oral suspension',
    tab: 'tablet',
    tabs: 'tablet',
    tablets: 'tablet',
    cap: 'capsule',
    caps: 'capsule',
    capsules: 'capsule',
    inj: 'injection',
    injections: 'injection',
    drops: 'drop',
    gel: 'gel',
    cream: 'cream',
    ointment: 'ointment',
    wash: 'cleanser',
    'face wash': 'cleanser',
  };
}

export const formSynonyms = loadFormSynonyms();
