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

const RESTRICTED_KEYWORDS = ['missile', 'projectile', 'weapon', 'gun', 'rifle', 'pistol', 'assault', 'tank', 'explosion', 'firearm', 'ammunition', 'grenade', 'war'];
const REAL_ESTATE_INDICATORS = ['room', 'house', 'building', 'home', 'apartment', 'living', 'kitchen', 'bedroom', 'bathroom', 'interior', 'furniture', 'exterior', 'facade', 'garden', 'pool', 'garage', 'dining', 'desk', 'office'];

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

        // 3. Sophisticated Classification
        const classification = determineClassification(predictions);

        return {
            predictions,
            quality,
            classification,
            isRealEstateRelated: classification.type === 'Real Estate',
            suggestions: classification.type === 'Real Estate' ? generateSuggestions(predictions) : []
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

    const topPrediction = predictions[0].className.toLowerCase();
    const allPredictions = predictions.map(p => p.className.toLowerCase()).join(' ');

    // Check for Restricted/Red-Flag Content
    const isRestricted = RESTRICTED_KEYWORDS.some(keyword => allPredictions.includes(keyword));
    if (isRestricted) {
        return { 
            type: 'Restricted', 
            category: 'Safety/Security',
            reason: 'Content identified as potentially hazardous or violating safety guidelines.',
            confidence: predictions[0].probability 
        };
    }

    // Check for Real Estate Relevance
    // We check if any of the REAL_ESTATE_INDICATORS appear in predictions OR if we found a room match
    const isRE = REAL_ESTATE_INDICATORS.some(keyword => allPredictions.includes(keyword)) || 
                 generateSuggestions(predictions).length > 0;
    
    if (isRE) {
        return { 
            type: 'Real Estate', 
            category: 'Property/Interior',
            reason: 'Content identified as relevant to real estate or property listings.',
            confidence: predictions[0].probability 
        };
    }

    // Check for Nature/Animals
    const natureKeywords = ['landscape', 'mountain', 'lake', 'ocean', 'forest', 'tree', 'flower', 'animal', 'bird', 'dog', 'cat'];
    if (natureKeywords.some(keyword => allPredictions.includes(keyword))) {
        return { 
            type: 'Nature/Animal', 
            category: 'Non-Real Estate',
            reason: 'Content identified as natural landscapes or animals.',
            confidence: predictions[0].probability 
        };
    }

    return { 
        type: 'General', 
        category: 'Miscellaneous',
        reason: 'General content without strong real estate or safety markers.',
        confidence: predictions[0].probability 
    };
};

/**
 * Analyzes brightness and basic contrast
 */
const checkTechnicalQuality = async (imageSource) => {
    try {
        const tensor = tf.browser.fromPixels(imageSource);

        // Calculate Mean Brightness
        const brightness = tf.mean(tensor).dataSync()[0];

        // Calculate Standard Deviation (for contrast)
        const std = tf.moments(tensor).variance.sqrt().dataSync()[0];

        tensor.dispose();

        return {
            brightness: brightness > 220 ? 'Overexposed' : brightness < 30 ? 'Underexposed' : 'Good',
            contrast: std < 15 ? 'Flat/Low Contrast' : 'Good',
            score: Math.min(100, Math.round((brightness / 255) * 40 + (std / 128) * 60)) // Weight contrast slightly higher for "quality"
        };
    } catch (err) {
        console.warn('Technical quality check failed:', err);
        return { brightness: 'Error', contrast: 'Error', score: 0 };
    }
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
