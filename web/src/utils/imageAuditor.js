import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { ROOM_IDENTIFICATION_MAP } from './aiMappings';

let model = null;

/**
 * Loads the MobileNet model if not already loaded
 */
export const loadModel = async () => {
    try {
        if (!model) {
            model = await mobilenet.load({
                version: 2,
                alpha: 1.0
            });
        }
        return model;
    } catch (e) {
        console.error("Failed to load MobileNet model:", e);
        throw new Error("Failed to load AI model");
    }
};

const RESTRICTED_KEYWORDS = [
    'missile', 'projectile', 'weapon', 'gun', 'rifle', 'pistol', 'assault', 'tank', 'explosion', 'firearm', 
    'ammunition', 'grenade', 'war', 'blood', 'gore', 'violence', 'nudity', 'explicit', 'drug', 'syringe'
];

const REAL_ESTATE_INDICATORS = [
    'room', 'house', 'building', 'home', 'apartment', 'living', 'kitchen', 'bedroom', 'bathroom', 
    'interior', 'furniture', 'exterior', 'facade', 'garden', 'pool', 'garage', 'dining', 'desk', 
    'office', 'staircase', 'window', 'floor', 'ceiling', 'door', 'balcony', 'terrace', 'lobby',
    'fireplace', 'basement', 'attic', 'closet', 'pantry', 'laundry'
];

/**
 * Audit an image for quality and content
 * @param {HTMLImageElement|HTMLCanvasElement|ImageData} imageSource 
 */
export const auditImage = async (imageSource) => {
    try {
        const loadedModel = await loadModel();

        // 1. Content Prediction (What is in the image?) - Get Top 8 Classifications for better context
        const predictions = await loadedModel.classify(imageSource, 8);

        // 2. Technical Quality (Blur, Brightness, Contrast, Sharpness)
        const quality = await checkTechnicalQuality(imageSource);

        // 3. Sophisticated Classification & Safety
        const classification = determineClassification(predictions);

        // 4. Privacy Risk Heuristic (Detecting humans/faces in tags)
        const privacyRisk = checkPrivacyRisk(predictions);

        // 5. Sentinel Score Calculation (0-100)
        const sentinelScore = calculateSentinelScore(quality, classification, privacyRisk);

        return {
            predictions,
            quality,
            classification,
            privacyRisk,
            sentinelScore,
            isRealEstateRelated: classification.type === 'Real Estate',
            suggestions: classification.type === 'Real Estate' ? generateSuggestions(predictions) : [],
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Image Audit Error:', error);
        return null;
    }
};

/**
 * Determines a sophisticated classification based on top predictions
 */
const determineClassification = (predictions) => {
    if (!predictions || predictions.length === 0) return { type: 'Unknown', confidence: 0 };

    const allPredictions = predictions.map(p => p.className.toLowerCase()).join(' ');

    // Check for Restricted/Red-Flag Content
    const isRestricted = RESTRICTED_KEYWORDS.some(keyword => allPredictions.includes(keyword));
    if (isRestricted) {
        return { 
            type: 'Restricted', 
            category: 'Safety/Security',
            status: 'Rejected',
            reason: 'Content identified as potentially hazardous, violent, or violating safety guidelines.',
            confidence: predictions[0].probability 
        };
    }

    // Check for Real Estate Relevance
    const suggestions = generateSuggestions(predictions);
    const isRE = REAL_ESTATE_INDICATORS.some(keyword => allPredictions.includes(keyword)) || suggestions.length > 0;
    
    if (isRE) {
        return { 
            type: 'Real Estate', 
            category: suggestions.length > 0 ? suggestions[0] : 'Property/Interior',
            status: 'Approved',
            reason: 'Relevant real estate content detected.',
            confidence: predictions[0].probability 
        };
    }

    // Check for Nature/Animals
    const natureKeywords = ['landscape', 'mountain', 'lake', 'ocean', 'forest', 'tree', 'flower', 'animal', 'bird', 'dog', 'cat'];
    if (natureKeywords.some(keyword => allPredictions.includes(keyword))) {
        return { 
            type: 'Nature/Animal', 
            category: 'Non-Real Estate',
            status: 'Flagged',
            reason: 'Image appears to be nature or animals rather than property.',
            confidence: predictions[0].probability 
        };
    }

    return { 
        type: 'General', 
        category: 'Miscellaneous',
        status: 'Neutral',
        reason: 'General content without strong real estate or safety markers.',
        confidence: predictions[0].probability 
    };
};

/**
 * Advanced Technical Quality Check
 * Includes Brightness, Contrast, and Blur Detection (Laplacian Variance)
 */
const checkTechnicalQuality = async (imageSource) => {
    try {
        return await tf.tidy(() => {
            const tensor = tf.browser.fromPixels(imageSource);
            
            // A. Calculate Mean Brightness
            const brightness = tf.mean(tensor).dataSync()[0];

            // B. Calculate Standard Deviation (for contrast)
            const moments = tf.moments(tensor);
            const std = moments.variance.sqrt().dataSync()[0];

            // C. Blur Detection (Laplacian Variance Heuristic)
            // We use a 3x3 Laplacian kernel to find edges
            const gray = tensor.mean(2).expandDims(2); // Convert to grayscale
            const laplacianKernel = tf.tensor4d([
                0,  1, 0,
                1, -4, 1,
                0,  1, 0
            ], [3, 3, 1, 1]);
            
            const edges = tf.conv2d(gray.toFloat(), laplacianKernel, 1, 'same');
            const edgeVar = tf.moments(edges).variance.dataSync()[0];

            // D. Scoring & Interpretation
            const isBlurry = edgeVar < 100; // Threshold for blurriness
            const sharpnessScore = Math.min(100, Math.round((edgeVar / 1000) * 100));

            return {
                brightness: brightness > 230 ? 'Overexposed' : brightness < 40 ? 'Underexposed' : 'Good',
                brightnessValue: Math.round(brightness),
                contrast: std < 20 ? 'Low' : 'Good',
                contrastValue: Math.round(std),
                sharpness: isBlurry ? 'Blurry' : sharpnessScore > 70 ? 'Sharp' : 'Acceptable',
                sharpnessValue: sharpnessScore,
                edgeVariance: Math.round(edgeVar),
                isHighQuality: !isBlurry && brightness >= 40 && brightness <= 230 && std >= 20
            };
        });
    } catch (err) {
        console.warn('Technical quality check failed:', err);
        return { brightness: 'Error', contrast: 'Error', sharpness: 'Error', isHighQuality: false };
    }
};

/**
 * Heuristic Privacy Risk Check
 * Detects if people or faces are likely present in the image
 */
const checkPrivacyRisk = (predictions) => {
    const privacyKeywords = ['person', 'human', 'man', 'woman', 'child', 'face', 'portrait', 'people', 'crowd'];
    const matches = predictions.filter(p => 
        privacyKeywords.some(key => p.className.toLowerCase().includes(key)) && p.probability > 0.25
    );

    if (matches.length > 0) {
        return {
            risk: 'High',
            reason: 'Human presence detected. Ensure you have permission to share people\'s faces.',
            detectedTags: matches.map(m => m.className)
        };
    }
    return { risk: 'Low', reason: 'No significant human presence detected.' };
};

/**
 * Calculates a final Sentinel Score (0-100)
 */
const calculateSentinelScore = (quality, classification, privacy) => {
    let score = 0;

    // 1. Technical Quality (40% weight)
    if (quality.sharpness === 'Sharp') score += 20;
    else if (quality.sharpness === 'Acceptable') score += 10;
    
    if (quality.brightness === 'Good') score += 10;
    if (quality.contrast === 'Good') score += 10;

    // 2. Relevance (40% weight)
    if (classification.type === 'Real Estate') {
        score += 40;
    } else if (classification.type === 'General') {
        score += 20;
    }

    // 3. Safety & Privacy (20% weight)
    if (classification.status === 'Rejected') {
        score = 0; // Immediate failure
    } else if (classification.status === 'Approved') {
        score += 10;
        if (privacy.risk === 'Low') score += 10;
    }

    return Math.min(100, score);
};

/**
 * Map generic ImageNet tags to Real Estate specific room names
 */
const generateSuggestions = (predictions) => {
    const detectedRooms = predictions
        .map(p => {
            const className = p.className.toLowerCase();
            // Search through our map
            const match = ROOM_IDENTIFICATION_MAP.find(entry =>
                entry.keywords.some(keyword => className.includes(keyword))
            );
            return match ? match.tag : null;
        })
        .filter(Boolean);

    // Filter duplicates
    return [...new Set(detectedRooms)];
};
