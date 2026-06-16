/**
 * Auto-detect input files from data/input/ folder.
 */
import { readdirSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';

const DATA_EXT = ['.csv', '.xlsx', '.xls'];

function listDataFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => DATA_EXT.some(ext => f.toLowerCase().endsWith(ext)))
    .map(f => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function matches(name, patterns) {
  const n = name.toLowerCase();
  return patterns.some(p => n.includes(p));
}

/**
 * Detect RMS, DR catalog files, and image files from an input directory.
 * Returns paths relative to enrichment-engine root or absolute.
 */
export function detectInputFiles(inputDir) {
  const absDir = resolve(inputDir);
  const files = listDataFiles(absDir);

  const rms = files.find(f =>
    matches(f, ['productlist', 'product_list', 'product list', 'rms', 'website', 'master catalog'])
    && !matches(f, ['image', 'drug', 'medicine', 'otc'])
  ) || files.find(f =>
    matches(f, ['product']) && !matches(f, ['image', 'drug', 'medicine', 'otc'])
  );

  const images = files.filter(f => matches(f, ['image url', 'image_url', 'images', 'image urls']));

  const drugs = files.filter(f => {
    if (matches(f, ['image'])) return false;
    if (f === rms) return false;
    return matches(f, ['drug', 'medicine', 'otc', 'data requisite', 'datarequisite', 'catalog', 'database']);
  });

  // Fallback: if only 3 files, assign by exclusion
  if (files.length === 3 && !rms) {
    const sorted = [...files].sort((a, b) => statSync(a).size - statSync(b).size);
    return {
      rms: sorted[0],
      drugs: [sorted[1]],
      images: [sorted[2]],
    };
  }

  return {
    rms: rms || null,
    drugs: drugs.length ? drugs : [],
    images: images.length ? images : [],
  };
}

export function applyDetectedFiles(detected, filesConfig) {
  if (detected.rms) filesConfig.rms = detected.rms;
  if (detected.drugs.length) {
    filesConfig.drugs = detected.drugs[0];
    filesConfig.drugs2 = detected.drugs[1] || null;
    filesConfig.drugs3 = detected.drugs[2] || null;
  }
  if (detected.images.length) {
    filesConfig.images = detected.images[0];
    filesConfig.images2 = detected.images[1] || null;
  }
  return filesConfig;
}
