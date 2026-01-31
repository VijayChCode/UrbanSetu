/**
 * extensive mapping of ImageNet/TensorFlow tags to Real Estate Room types.
 * Used by imageAuditor.js to categorize images.
 */
export const ROOM_IDENTIFICATION_MAP = [
    // LIVING ROOM
    { keywords: ['studio couch', 'sofa', 'couch', 'convertible', 'loveseat'], tag: 'Living Room' },
    { keywords: ['television', 'monitor', 'screen', 'home theater', 'entertainment center', 'remote control'], tag: 'Living Room' },
    { keywords: ['window shade', 'window screen', 'curtain', 'drapes'], tag: 'Living Room' },
    { keywords: ['rug', 'carpet', 'doormat', 'prayer rug', 'area rug'], tag: 'Living Room' },
    { keywords: ['vase', 'potter', 'table lamp', 'lampshade'], tag: 'Living Room' },
    { keywords: ['sliding door', 'folding chair', 'rocking chair'], tag: 'Living Room' },
    { keywords: ['piano', 'grand piano', 'upright'], tag: 'Living Room' },

    // BEDROOM
    { keywords: ['bed', 'four-poster', 'quilt', 'comforter', 'duvet', 'sheets', 'bedroom'], tag: 'Bedroom' },
    { keywords: ['pillow', 'cushion'], tag: 'Bedroom' },
    { keywords: ['wardrobe', 'closet', 'chiffonier', 'dresser', 'chest of drawers'], tag: 'Bedroom' },
    { keywords: ['crib', 'cradle', 'bassinet'], tag: 'Kids Room' },
    { keywords: ['bunk bed'], tag: 'Kids Room' },

    // KITCHEN & DINING
    { keywords: ['refrigerator', 'icebox'], tag: 'Kitchen' },
    { keywords: ['microwave', 'stove', 'oven', 'range', 'rotisserie'], tag: 'Kitchen' },
    { keywords: ['dishwasher', 'washer', 'washing machine'], tag: 'Kitchen / Utility' },
    { keywords: ['toaster', 'waffle iron', 'espresso', 'coffeepot', 'coffee mug', 'cup'], tag: 'Kitchen' },
    { keywords: ['frying pan', 'wok', 'dutch oven', 'pot', 'pan'], tag: 'Kitchen' },
    { keywords: ['plate rack', 'cabinet', 'cupboard'], tag: 'Kitchen' },
    { keywords: ['dining table', 'restaurant', 'plate', 'platter'], tag: 'Dining Room' },

    // BATHROOM
    { keywords: ['bathtub', 'tub', 'jacuzzi'], tag: 'Bathroom' },
    { keywords: ['shower', 'shower curtain'], tag: 'Bathroom' },
    { keywords: ['toilet', 'toilet seat', 'bidet'], tag: 'Washroom / Bathroom' },
    { keywords: ['washbasin', 'hand basin', 'sink'], tag: 'Bathroom' },
    { keywords: ['medicine chest', 'soap dispenser', 'toilet tissue', 'paper towel'], tag: 'Bathroom' },

    // STUDY / OFFICE
    { keywords: ['desk', 'desk', 'typewriter', 'laptop', 'notebook', 'computer'], tag: 'Study / Office' },
    { keywords: ['bookcase', 'bookshelf', 'library', 'binder', 'book'], tag: 'Study / Library' },
    { keywords: ['file', 'filing cabinet'], tag: 'Study / Office' },

    // OUTDOOR
    { keywords: ['patio', 'deck', 'porch'], tag: 'Balcony / Patio' },
    { keywords: ['picket fence', 'worm fence', 'fence'], tag: 'Garden / Exterior' },
    { keywords: ['greenhouse', 'flower pot'], tag: 'Garden' },
    { keywords: ['swimming pool', 'pool', 'scuba'], tag: 'Pool Area' },
    { keywords: ['umbrella', 'sunshade'], tag: 'Outdoor' },
    { keywords: ['mobile home', 'trailer truck'], tag: 'Exterior' },
    { keywords: ['tile roof', 'shingle', 'thatch'], tag: 'Exterior' },
    { keywords: ['lakeside', 'seashore', 'valley'], tag: 'View / Exterior' }
];
