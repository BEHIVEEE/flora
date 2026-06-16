/**
 * Column maps for each input file.
 * Keys = internal field names, values = possible Excel column headers (case-insensitive).
 * Add alternate headers as needed to handle variations between file versions.
 */

export const RMS_COLUMN_MAP = {
  name:         ['Product Name', 'Item Name', 'product name'],
  manufacturer: ['Manufacturer', 'Company', 'Brand', 'company'],
  mrp:          ['MRP', 'Price'],
  stock:        ['Stock', 'TotalStock', 'Quantity'],
  pack_size:    ['Pack Size', 'Packing', 'Pack'],
  barcode:      ['Barcode', 'EAN'],
  rms_id:       ['Product ID', 'Product Code', 'ID'],
  category:     ['Category'],
};

export const DRUGS_COLUMN_MAP = {
  name:         ['Product Name', 'Name'],
  manufacturer: ['Manufacturer', 'Marketer', 'Brand', 'Company'],
  description:  ['Description', 'Introduction', 'Product Description'],
  composition:  ['Composition'],
  category:     ['Category', 'medicine_type'],
  pack_size:    ['Packaging Detail', 'Pack Size', 'Packing', 'Qty'],
  barcode:      ['Barcode', 'Product ID'],
  prescription_required: ['prescription_required', 'Prescription Required', 'Rx Required'],
};

/** Slim map for matching — omits description to cut heap on 700k+ rows */
export const DRUGS_MATCH_COLUMN_MAP = {
  name:         DRUGS_COLUMN_MAP.name,
  manufacturer: DRUGS_COLUMN_MAP.manufacturer,
  composition:  DRUGS_COLUMN_MAP.composition,
  category:     DRUGS_COLUMN_MAP.category,
  pack_size:    DRUGS_COLUMN_MAP.pack_size,
  barcode:      DRUGS_COLUMN_MAP.barcode,
  prescription_required: DRUGS_COLUMN_MAP.prescription_required,
};

export const IMAGES_COLUMN_MAP = {
  product_id:    ['Product ID', 'product_id', 'ID'],
  product_name:  ['Product Name', 'Name'],
  manufacturer:  ['Manufacturer', 'Marketer', 'Brand'],
  image_url:     ['Image URL', 'Image_Urls', 'image_url'],
  sort_order:    ['Sort Order'],
};

// Alternative header names for flexible file support
export const RMS_COLUMN_MAP_ALT = {
  name:         'Item Name',
  manufacturer: 'Brand',
  mrp:          'Price',
  stock:        'Quantity',
  pack_size:    'Pack',
  barcode:      'EAN',
  rms_id:       'ID',
  category:     'Category',
};

export const DRUGS_COLUMN_MAP_ALT = {
  name:         'Name',
  manufacturer: 'Brand',
  description:  'Product Description',
  composition:  'Ingredients',
  category:     'Product Category',
  pack_size:    'Pack',
  barcode:      'EAN Code',
};

export const IMAGES_COLUMN_MAP_ALT = {
  product_name:  'Name',
  manufacturer:  'Brand',
  image_url:     'URL',
  sort_order:    'Order',
};
