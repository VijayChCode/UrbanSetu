import * as tf from '@tensorflow/tfjs';
import { pipeline, env } from '@xenova/transformers';
import { CANDIDATE_LABELS } from './aiMappings';

// Configure transformers.js to use local cache and not block UI
env.allowLocalModels = false; // Downloads from HuggingFace Hub on first use
env.useBrowserCache = true;

let classifier = null;

/**
 * Loads the Zero-Shot Image Classification pipeline (CLIP)
 * Uses a quantized version for fast browser performance.
 */
export const loadModel = async () => {
    try {
        if (!classifier) {
            // 'Xenova/clip-vit-base-patch32' is a good balance of speed/accuracy
            classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
        }
        return classifier;
    } catch (e) {
        console.error("Failed to load AI model:", e);
        throw new Error("Failed to load AI model");
    }
};

/**
 * Audit an image for quality and content using Zero-Shot AI
 * @param {HTMLImageElement|string} imageSource - Image element or URL
 */
export const auditImage = async (imageSource) => {
    try {
        const pipe = await loadModel();

        // 1. Zero-Shot Classification (Understand concepts, not just objects)
        // src can be a URL or data URI. If it's an Image element, passed src.
        const input = imageSource.src || imageSource;

        const output = await pipe(input, CANDIDATE_LABELS);

        // Output format: [{ label: 'Bedroom', score: 0.95 }, ... ]
        // We take the top suggestion if confident
        const topMatch = output[0];
        const suggestions = topMatch.score > 0.25 ? [topMatch.label] : ['Unidentified'];

        // 2. Technical Quality (Blur & Brightness via TFJS)
        // We still need the raw pixels for this, so we ensure we have an image element
        let quality = { brightness: 'Unknown', contrast: 'Unknown', score: 0 };

        if (imageSource instanceof HTMLImageElement || imageSource instanceof HTMLCanvasElement) {
            quality = await checkTechnicalQuality(imageSource);
        } else if (typeof imageSource === 'string') {
            // If just a URL string passed, we might skip quality check or need to load it
            // For now, gracefully handle if we can't inspect pixels easily
        }

        return {
            predictions: output, // Return full analysis for debugging if needed
            quality,
            suggestions
        };
    } catch (error) {
        console.error('Image Audit Error:', error);
        return null;
    }
};

/**
 * Analyzes brightness and basic contrast using TFJS
 * Kept from previous implementation as CLIP doesn't do pixel-level stats
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
            brightness: brightness > 200 ? 'Too Bright' : brightness < 40 ? 'Too Dark' : 'Good',
            contrast: std < 20 ? 'Low Contrast' : 'Good',
            score: Math.min(100, Math.round((brightness / 255) * 50 + (std / 128) * 50))
        };
    } catch (err) {
        console.warn('Technical quality check failed:', err);
        return { brightness: 'Error', contrast: 'Error', score: 0 };
    }
};
