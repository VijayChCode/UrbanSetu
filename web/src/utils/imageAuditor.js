import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

let model = null;

/**
 * Loads the MobileNet model if not already loaded
 */
export const loadModel = async () => {
    if (!model) {
        model = await mobilenet.load({
            version: 2,
            alpha: 1.0
        });
    }
    return model;
};

/**
 * Audit an image for quality and content
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} imageSource 
 */
export const auditImage = async (imageSource) => {
    try {
        const loadedModel = await loadModel();

        // 1. Content Prediction (What is in the image?) - Get Top 5 Classifications
        const predictions = await loadedModel.classify(imageSource, 5);

        // 2. Technical Quality (Blur & Brightness)
        const quality = await checkTechnicalQuality(imageSource);

        return {
            predictions,
            quality,
            suggestions: generateSuggestions(predictions)
        };
    } catch (error) {
        console.error('Image Audit Error:', error);
        return null;
    }
};

/**
 * Analyzes brightness and basic contrast
 */
const checkTechnicalQuality = async (imageSource) => {
    const tensor = tf.browser.fromPixels(imageSource);

    // Calculate Mean Brightness
    const brightness = tf.mean(tensor).dataSync()[0];

    // Calculate Standard Deviation (for contrast)
    const std = tf.moments(tensor).variance.sqrt().dataSync()[0];

    tensor.dispose();

    return {
        brightness: brightness > 200 ? 'Too Bright' : brightness < 40 ? 'Too Dark' : 'Good',
        contrast: std < 20 ? 'Low Contrast' : 'Good',
        score: Math.min(100, Math.round((brightness / 255) * 50 + (std / 128) * 50))
    };
};

/**
 * Map generic ImageNet tags to Real Estate specific room names
 */
const generateSuggestions = (predictions) => {
    const phraseMap = [
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

    const detectedRooms = predictions
        .map(p => {
            const className = p.className.toLowerCase();
            // Search through our map
            const match = phraseMap.find(entry =>
                entry.keywords.some(keyword => className.includes(keyword))
            );
            return match ? match.tag : null;
        })
        .filter(Boolean);

    // Filter duplicates
    return [...new Set(detectedRooms)];
};
