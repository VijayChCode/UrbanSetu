import * as tf from '@tensorflow/tfjs';

const STORAGE_KEY = 'sentinel_interactions';
const MAX_INTERACTIONS = 12;

/**
 * Tracks a user interaction with a listing (view/click)
 * Stores essential features for client-side processing
 */
export const trackInteraction = (listing) => {
    if (!listing || !listing._id) return;

    try {
        let interactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        // Remove existing entry to move it to the front (recent bias)
        interactions = interactions.filter(i => i._id !== listing._id);

        // Only store necessary features for vectorization
        const interactionData = {
            _id: listing._id,
            city: listing.city?.toLowerCase() || '',
            type: listing.type || '',
            price: listing.offer ? listing.discountPrice : listing.regularPrice,
            bedrooms: Number(listing.bedrooms) || 0,
            bathrooms: Number(listing.bathrooms) || 0,
            parking: !!listing.parking,
            furnished: !!listing.furnished,
            timestamp: Date.now()
        };

        interactions.unshift(interactionData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(interactions.slice(0, MAX_INTERACTIONS)));
    } catch (error) {
        console.warn('Sentinel Live: Failed to track interaction', error);
    }
};

/**
 * Normalizes values for vectorization
 */
const normalize = (val, max) => (max > 0 ? val / max : 0);

/**
 * Converts a listing object into a feature tensor
 */
const vectorize = (listing, maxPrice, maxBeds, maxBaths) => {
    return [
        normalize(listing.price || (listing.offer ? listing.discountPrice : listing.regularPrice), maxPrice),
        normalize(Number(listing.bedrooms) || 0, maxBeds),
        normalize(Number(listing.bathrooms) || 0, maxBaths),
        listing.furnished ? 1 : 0,
        listing.parking ? 1 : 0,
    ];
};

/**
 * Uses TensorFlow.js to calculate similarity scores between user history and candidates
 */
export const getLiveRecommendations = async (allCandidates, limit = 4) => {
    try {
        const rawInteractions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (rawInteractions.length === 0 || !allCandidates || allCandidates.length === 0) {
            return [];
        }

        // Filter out candidates already in history
        const historyIds = new Set(rawInteractions.map(i => i._id));
        const filteredCandidates = allCandidates.filter(c => !historyIds.has(c._id));

        if (filteredCandidates.length === 0) return [];

        // Determine max values for normalization
        const combined = [...rawInteractions, ...filteredCandidates];
        const maxPrice = Math.max(...combined.map(l => l.price || (l.offer ? l.discountPrice : l.regularPrice)), 1);
        const maxBeds = Math.max(...combined.map(l => Number(l.bedrooms) || 0), 1);
        const maxBaths = Math.max(...combined.map(l => Number(l.bathrooms) || 0), 1);

        // Vectorize history and candidates
        const historyVectors = rawInteractions.map(l => vectorize(l, maxPrice, maxBeds, maxBaths));
        const candidateVectors = filteredCandidates.map(l => vectorize(l, maxPrice, maxBeds, maxBaths));

        // Create Tensors
        const historyTensor = tf.tensor2d(historyVectors);
        const candidateTensor = tf.tensor2d(candidateVectors);

        // Calculate Cosine Similarity
        // 1. Normalize vectors to unit length
        const normHistory = tf.div(historyTensor, tf.norm(historyTensor, 'euclidean', 1, true).add(1e-9));
        const normCandidates = tf.div(candidateTensor, tf.norm(candidateTensor, 'euclidean', 1, true).add(1e-9));

        // 2. Multiply (Dot Product)
        const similarities = tf.matMul(normCandidates, normHistory, false, true);

        // 3. Average similarity across history (Mean)
        const meanSimilarities = tf.mean(similarities, 1);
        const scores = await meanSimilarities.data();

        // Bonus scores for categorical matches (City, Type)
        const finalResults = filteredCandidates.map((listing, idx) => {
            let score = scores[idx];

            // Significant weight for matching city and type
            const recentInteraction = rawInteractions[0];
            if (listing.city?.toLowerCase() === recentInteraction.city?.toLowerCase()) score += 0.4;
            if (listing.type === recentInteraction.type) score += 0.3;

            return {
                ...listing,
                sentinelScore: score,
                isLiveMatch: true
            };
        });

        // Cleanup Tensors
        historyTensor.dispose();
        candidateTensor.dispose();
        normHistory.dispose();
        normCandidates.dispose();
        similarities.dispose();
        meanSimilarities.dispose();

        // Sort by score and return limited results
        return finalResults
            .sort((a, b) => b.sentinelScore - a.sentinelScore)
            .slice(0, limit);

    } catch (error) {
        console.error('Sentinel Live: Recommendation failed', error);
        return [];
    }
};
