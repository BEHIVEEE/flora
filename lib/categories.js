// Production-ready category hierarchy for ChemistShop
// All categories are database-driven; this is only seed data.

export const CATEGORY_SEED = [
  // Main Categories
  {
    id: 'cat-allopathic',
    name: 'Allopathic Medicines',
    slug: 'allopathic-medicines',
    parentCategoryId: null,
    type: 'main',
    icon: 'Pill',
    description: 'FDA-approved allopathic medicines for all conditions',
    sortOrder: 1,
  },
  {
    id: 'cat-ayurvedic',
    name: 'Ayurvedic Medicines',
    slug: 'ayurvedic-medicines',
    parentCategoryId: null,
    type: 'main',
    icon: 'Leaf',
    description: 'Traditional Ayurvedic remedies and supplements',
    sortOrder: 2,
  },
  {
    id: 'cat-homeopathic',
    name: 'Homeopathic Medicines',
    slug: 'homeopathic-medicines',
    parentCategoryId: null,
    type: 'main',
    icon: 'Droplets',
    description: 'Gentle homeopathic treatments and dilutions',
    sortOrder: 3,
  },
  {
    id: 'cat-surgical',
    name: 'Surgical Items',
    slug: 'surgical-items',
    parentCategoryId: null,
    type: 'main',
    icon: 'Scissors',
    description: 'Essential surgical supplies and instruments',
    sortOrder: 4,
  },
  {
    id: 'cat-orthopedic',
    name: 'Orthopedic Products',
    slug: 'orthopedic-products',
    parentCategoryId: null,
    type: 'main',
    icon: 'Bone',
    description: 'Braces, supports and orthopedic care items',
    sortOrder: 5,
  },
  {
    id: 'cat-mobility',
    name: 'Mobility Aids',
    slug: 'mobility-aids',
    parentCategoryId: null,
    type: 'main',
    icon: 'Wheelchair',
    description: 'Walkers, wheelchairs and mobility equipment',
    sortOrder: 6,
  },
  {
    id: 'cat-medical-utilities',
    name: 'Medical Utilities',
    slug: 'medical-utilities',
    parentCategoryId: null,
    type: 'main',
    icon: 'Clipboard',
    description: 'Daily medical aids and utility products',
    sortOrder: 7,
  },
  {
    id: 'cat-life-saving',
    name: 'Life Saving Drugs',
    slug: 'life-saving-drugs',
    parentCategoryId: null,
    type: 'main',
    icon: 'HeartPulse',
    description: 'Critical care and emergency medications',
    sortOrder: 8,
  },
  {
    id: 'cat-cosmetics',
    name: 'Cosmetics',
    slug: 'cosmetics',
    parentCategoryId: null,
    type: 'main',
    icon: 'Sparkles',
    description: 'Beauty and personal care cosmetics',
    sortOrder: 9,
  },
  {
    id: 'cat-professional',
    name: 'Professional Healthcare Products',
    slug: 'professional-healthcare-products',
    parentCategoryId: null,
    type: 'main',
    icon: 'BriefcaseMedical',
    description: 'Products for clinics, hospitals and professionals',
    sortOrder: 10,
  },
  {
    id: 'cat-skincare',
    name: 'Skin Care',
    slug: 'skin-care',
    parentCategoryId: null,
    type: 'main',
    icon: 'Sun',
    description: 'Dermatologist-approved skincare products',
    sortOrder: 11,
  },
  {
    id: 'cat-pet-food',
    name: 'Pet Food',
    slug: 'pet-food',
    parentCategoryId: null,
    type: 'main',
    icon: 'Cat',
    description: 'Nutritious food for dogs, cats and pets',
    sortOrder: 12,
  },
  {
    id: 'cat-generic',
    name: 'Generic Medicines',
    slug: 'generic',
    parentCategoryId: null,
    type: 'main',
    icon: 'Package',
    description: 'Affordable unbranded generic formulations',
    sortOrder: 13,
  },

  // Subcategories / Brands under Orthopedic Products
  {
    id: 'brand-vi-ssco',
    name: 'Vissco',
    slug: 'vi-ssco',
    parentCategoryId: 'cat-orthopedic',
    type: 'brand',
    icon: null,
    description: 'Premium orthopedic supports by Vissco',
    sortOrder: 1,
  },
  {
    id: 'brand-tynor',
    name: 'Tynor',
    slug: 'tynor',
    parentCategoryId: 'cat-orthopedic',
    type: 'brand',
    icon: null,
    description: 'Trusted orthopedic braces by Tynor',
    sortOrder: 2,
  },
  {
    id: 'brand-lifeware',
    name: 'Lifeware',
    slug: 'lifeware',
    parentCategoryId: 'cat-orthopedic',
    type: 'brand',
    icon: null,
    description: 'Lifeware orthopedic solutions',
    sortOrder: 3,
  },
  {
    id: 'brand-braceon',
    name: 'Braceon',
    slug: 'braceon',
    parentCategoryId: 'cat-orthopedic',
    type: 'brand',
    icon: null,
    description: 'Advanced brace technology by Braceon',
    sortOrder: 4,
  },

  // Subcategories under Mobility Aids
  {
    id: 'sub-walker-chair',
    name: 'Walker Chair',
    slug: 'walker-chair',
    parentCategoryId: 'cat-mobility',
    type: 'sub',
    icon: null,
    description: 'Adjustable walker chairs for elderly and patients',
    sortOrder: 1,
  },

  // Subcategories under Medical Utilities
  {
    id: 'sub-commode-chair',
    name: 'Commode Chair / Stool',
    slug: 'commode-chair-stool',
    parentCategoryId: 'cat-medical-utilities',
    type: 'sub',
    icon: null,
    description: 'Portable commode chairs and stools',
    sortOrder: 1,
  },
  {
    id: 'sub-urine-pot',
    name: 'Urine Pot',
    slug: 'urine-pot',
    parentCategoryId: 'cat-medical-utilities',
    type: 'sub',
    icon: null,
    description: 'Male and female urine pots',
    sortOrder: 2,
  },

  // Brands under Pet Food
  {
    id: 'brand-pedigree',
    name: 'Pedigree',
    slug: 'pedigree',
    parentCategoryId: 'cat-pet-food',
    type: 'brand',
    icon: null,
    description: 'Pedigree pet nutrition',
    sortOrder: 1,
  },
  {
    id: 'brand-purepet',
    name: 'Purepet',
    slug: 'purepet',
    parentCategoryId: 'cat-pet-food',
    type: 'brand',
    icon: null,
    description: 'Purepet natural pet food',
    sortOrder: 2,
  },

  // Subcategories under Skin Care
  { id: 'sub-face-wash', name: 'Face Wash & Cleansers', slug: 'face-wash', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'Daily cleansers for all skin types', sortOrder: 1 },
  { id: 'sub-moisturizer', name: 'Moisturizers', slug: 'moisturizers', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'Hydrating creams and lotions', sortOrder: 2 },
  { id: 'sub-serum', name: 'Serums', slug: 'serums', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'Targeted treatment serums', sortOrder: 3 },
  { id: 'sub-sunscreen', name: 'Sunscreen', slug: 'sunscreen', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'SPF protection for all skin types', sortOrder: 4 },
  { id: 'sub-face-mask', name: 'Face Masks', slug: 'face-masks', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'Sheet masks and clay masks', sortOrder: 5 },
  { id: 'sub-anti-aging', name: 'Anti-Aging', slug: 'anti-aging', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'Wrinkle and fine line care', sortOrder: 6 },
  { id: 'sub-acne-care', name: 'Acne Care', slug: 'acne-care', parentCategoryId: 'cat-skincare', type: 'sub', icon: null, description: 'Acne and blemish treatment', sortOrder: 7 },

  // Brands under Skin Care
  { id: 'brand-cetaphil', name: 'Cetaphil', slug: 'cetaphil', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Gentle dermatologist-recommended skincare', sortOrder: 1 },
  { id: 'brand-minimalist', name: 'Minimalist', slug: 'minimalist', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Science-backed skincare actives', sortOrder: 2 },
  { id: 'brand-mamaearth', name: 'Mamaearth', slug: 'mamaearth', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Toxin-free natural skincare', sortOrder: 3 },
  { id: 'brand-sebamed', name: 'Sebamed', slug: 'sebamed', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'pH 5.5 balanced skincare', sortOrder: 4 },
  { id: 'brand-plum', name: 'Plum', slug: 'plum', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Vegan and cruelty-free skincare', sortOrder: 5 },
  { id: 'brand-the-derma-co', name: 'The Derma Co', slug: 'the-derma-co', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Dermatologist-formulated skincare', sortOrder: 6 },
  { id: 'brand-nivea', name: 'Nivea', slug: 'nivea', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Trusted moisturizers and body care', sortOrder: 7 },
  { id: 'brand-ponds', name: "Pond's", slug: 'ponds', parentCategoryId: 'cat-skincare', type: 'brand', icon: null, description: 'Daily face care essentials', sortOrder: 8 },
];

export function buildCategoryTree(categories) {
  const map = {};
  categories.forEach(c => { map[c.id] = { ...c, children: [] }; });
  const roots = [];
  Object.values(map).forEach(c => {
    if (c.parentCategoryId && map[c.parentCategoryId]) {
      map[c.parentCategoryId].children.push(c);
    } else {
      roots.push(c);
    }
  });
  // Sort by sortOrder
  const sort = arr => {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
    arr.forEach(c => sort(c.children));
  };
  sort(roots);
  return roots;
}

export function flattenCategoryTree(tree, depth = 0) {
  const flat = [];
  tree.forEach(node => {
    flat.push({ ...node, depth });
    if (node.children?.length) {
      flat.push(...flattenCategoryTree(node.children, depth + 1));
    }
  });
  return flat;
}

export function getCategoryBreadcrumb(categories, categoryId) {
  const map = Object.fromEntries(categories.map(c => [c.id, c]));
  const trail = [];
  let curr = map[categoryId];
  while (curr) {
    trail.unshift(curr);
    curr = curr.parentCategoryId ? map[curr.parentCategoryId] : null;
  }
  return trail;
}

export function getCategoryPath(categories, categoryId) {
  const map = Object.fromEntries(categories.map(c => [c.id, c]));
  const parts = [];
  let curr = map[categoryId];
  while (curr) {
    parts.unshift(curr.slug);
    curr = curr.parentCategoryId ? map[curr.parentCategoryId] : null;
  }
  return parts.join('/');
}
