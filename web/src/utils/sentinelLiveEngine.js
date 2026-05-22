import * as tf from '@tensorflow/tfjs';
import { authenticatedFetch } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const STORAGE_KEY_PREFIX = 'sentinel_interactions_';
const MAX_INTERACTIONS = 30; // Increased from 12 for richer preference learning
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — entries older than this are auto-pruned

// ─── DB Sync: Debounce timers per user ───
const _syncTimers = {};

// Interaction type weights — stronger signals get more influence
const INTERACTION_WEIGHTS = {
    wishlist: 3.0,   // "I want this" — strongest signal
    watchlist: 2.0,  // "I'm tracking this" — strong interest
    view: 1.0,       // Passive browsing — baseline signal
};

/**
 * Builds a user-scoped storage key for Sentinel interactions.
 * Each user gets their own isolated interaction history.
 * Returns null if no userId is provided (prevents ghost data for public users).
 */
const getStorageKey = (userId) => {
    if (!userId) return null;
    return `${STORAGE_KEY_PREFIX}${userId}`;
};

/**
 * Clears Sentinel interaction data for a specific user.
 * Call this on sign-out, account deletion, or data reset requests.
 */
export const clearSentinelData = (userId) => {
    const key = getStorageKey(userId);
    if (key) localStorage.removeItem(key);
    // Also clean up legacy global key if it exists (migration)
    localStorage.removeItem('sentinel_interactions');
};

/**
 * Clears ALL Sentinel interaction data from localStorage (all users).
 * Use this for force-logout scenarios where the userId is not available.
 */
export const clearAllSentinelData = () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        // Also clean up legacy global key
        localStorage.removeItem('sentinel_interactions');
    } catch { /* silent */ }
};

/**
 * Returns the raw interaction history for a given user.
 * Automatically prunes entries older than STALE_THRESHOLD_MS (7 days)
 * on every read to keep the data fresh and relevant.
 * @param {string} userId - The current user's ID
 * @returns {Array} Array of interaction objects sorted by most recent first
 */
export const getInteractionHistory = (userId) => {
    const key = getStorageKey(userId);
    if (!key) return [];
    try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        const now = Date.now();
        const fresh = raw.filter(item => {
            // Keep items that have no timestamp (legacy) or are within threshold
            if (!item.timestamp) return true;
            return (now - item.timestamp) < STALE_THRESHOLD_MS;
        });
        // Persist the pruned list back if any stale items were removed
        if (fresh.length !== raw.length) {
            localStorage.setItem(key, JSON.stringify(fresh));
        }
        return fresh;
    } catch {
        return [];
    }
};

/**
 * Explicitly prunes stale interactions (older than 7 days) for a user.
 * Can be called on app init or login for a proactive cleanup.
 * @param {string} userId - The current user's ID
 */
export const pruneStaleSentinelData = (userId) => {
    const key = getStorageKey(userId);
    if (!key) return;
    try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        const now = Date.now();
        const fresh = raw.filter(item => {
            if (!item.timestamp) return true;
            return (now - item.timestamp) < STALE_THRESHOLD_MS;
        });
        if (fresh.length !== raw.length) {
            localStorage.setItem(key, JSON.stringify(fresh));
        }
    } catch { /* silent */ }
};

// ─── Server Sync & Restore ───

/**
 * Debounced sync of localStorage interactions to the server (DB).
 * Called automatically after each trackInteraction.
 * Batches rapid interactions with a 2-second delay to avoid excessive API calls.
 * @param {string} userId - The current user's ID
 */
const syncToServer = (userId) => {
    if (!userId) return;

    // Clear any pending sync for this user
    if (_syncTimers[userId]) {
        clearTimeout(_syncTimers[userId]);
    }

    // Debounce: wait 2 seconds after last interaction before syncing
    _syncTimers[userId] = setTimeout(async () => {
        try {
            const key = getStorageKey(userId);
            if (!key) return;
            const interactions = JSON.parse(localStorage.getItem(key) || '[]');
            if (interactions.length === 0) return;

            await authenticatedFetch(`${API_BASE_URL}/api/sentinel/preferences/sync`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interactions })
            });
        } catch (error) {
            // Silent failure — localStorage is the primary store, DB is backup
            console.warn('Sentinel: Background sync to server failed', error);
        }
    }, 2000);
};

/**
 * Restores Sentinel interaction history from the server (DB) to localStorage.
 * Called on login / app-load so that returning users get their preferences back.
 * Merges server data with any existing local data (local takes priority for same IDs).
 * @param {string} userId - The current user's ID
 * @returns {boolean} true if data was restored, false if no server data or error
 */
export const restoreFromServer = async (userId) => {
    if (!userId) return false;

    try {
        const key = getStorageKey(userId);
        if (!key) return false;

        const res = await authenticatedFetch(`${API_BASE_URL}/api/sentinel/preferences`);
        if (!res.ok) return false;

        const data = await res.json();
        const serverInteractions = Array.isArray(data?.interactions) ? data.interactions : [];

        if (serverInteractions.length === 0) return false;

        // Get current local data
        const localInteractions = JSON.parse(localStorage.getItem(key) || '[]');

        if (localInteractions.length === 0) {
            // No local data — just restore from server directly
            localStorage.setItem(key, JSON.stringify(serverInteractions.slice(0, MAX_INTERACTIONS)));
            return true;
        }

        // Merge: local takes priority (it's more recent within this session)
        const localIds = new Set(localInteractions.map(i => i._id));
        const newFromServer = serverInteractions.filter(i => !localIds.has(i._id));
        const merged = [...localInteractions, ...newFromServer].slice(0, MAX_INTERACTIONS);
        localStorage.setItem(key, JSON.stringify(merged));
        return true;
    } catch (error) {
        console.warn('Sentinel: Failed to restore from server', error);
        return false;
    }
};

/**
 * Tracks a user interaction with a listing (view/click/wishlist/watchlist)
 * Stores essential features for client-side TF processing
 * @param {Object} listing - The listing object
 * @param {string} interactionType - 'view' | 'wishlist' | 'watchlist'
 * @param {string} userId - The current user's ID (required — no tracking without a user)
 */
export const trackInteraction = (listing, interactionType = 'view', userId = null) => {
    if (!listing || !listing._id || !userId) return;

    const storageKey = getStorageKey(userId);
    if (!storageKey) return;

    try {
        let interactions = JSON.parse(localStorage.getItem(storageKey) || '[]');

        // Check if this listing already exists in history
        const existingIndex = interactions.findIndex(i => i._id === listing._id);

        if (existingIndex !== -1) {
            const existing = interactions[existingIndex];
            // Upgrade interaction type if the new one is stronger
            const currentWeight = INTERACTION_WEIGHTS[existing.interactionType] || 1;
            const newWeight = INTERACTION_WEIGHTS[interactionType] || 1;

            // Remove existing entry to update it
            interactions.splice(existingIndex, 1);

            // Keep the stronger interaction type
            interactionType = newWeight >= currentWeight ? interactionType : existing.interactionType;
        }

        // Store enriched features for vectorization
        const interactionData = {
            _id: listing._id,
            city: listing.city?.toLowerCase() || '',
            state: listing.state?.toLowerCase() || '',
            type: listing.type || '',
            price: listing.offer ? listing.discountPrice : listing.regularPrice,
            bedrooms: Number(listing.bedrooms) || 0,
            bathrooms: Number(listing.bathrooms) || 0,
            area: Number(listing.area) || 0,
            parking: !!listing.parking,
            furnished: !!listing.furnished,
            // Amenities for composite scoring
            gym: !!listing.gym,
            swimmingPool: !!listing.swimmingPool,
            security: !!listing.security,
            wifi: !!listing.wifi,
            garden: !!listing.garden,
            lift: !!listing.lift,
            // Interaction metadata
            interactionType,
            timestamp: Date.now()
        };

        interactions.unshift(interactionData);
        localStorage.setItem(storageKey, JSON.stringify(interactions.slice(0, MAX_INTERACTIONS)));

        // Debounced background sync to DB (fire-and-forget)
        syncToServer(userId);
    } catch (error) {
        console.warn('Sentinel Live: Failed to track interaction', error);
    }
};

/**
 * Normalizes values for vectorization (0-1 range)
 */
const normalize = (val, max) => (max > 0 ? val / max : 0);

/**
 * Calculates a composite amenity score (0-1) from individual amenity booleans
 */
const getAmenityScore = (listing) => {
    const amenities = [
        !!listing.gym,
        !!listing.swimmingPool,
        !!listing.security,
        !!listing.wifi,
        !!listing.garden,
        !!listing.lift,
    ];
    return amenities.filter(Boolean).length / amenities.length;
};

/**
 * Converts a listing object into a 10-dimensional feature tensor
 * Expanded from 5 dims to capture richer preference patterns
 */
const vectorize = (listing, maxPrice, maxBeds, maxBaths, maxArea) => {
    return [
        normalize(listing.price || (listing.offer ? listing.discountPrice : listing.regularPrice), maxPrice),
        normalize(Number(listing.bedrooms) || 0, maxBeds),
        normalize(Number(listing.bathrooms) || 0, maxBaths),
        normalize(Number(listing.area) || 0, maxArea),
        listing.furnished ? 1 : 0,
        listing.parking ? 1 : 0,
        listing.type === 'rent' ? 1 : 0,     // Type encoding (rent vs sale)
        listing.type === 'sale' ? 1 : 0,     // Type encoding (sale vs rent)
        getAmenityScore(listing),              // Composite amenity score
        normalize(Number(listing.propertyAge) || 0, 50), // Property age (max 50 years)
    ];
};

/**
 * Calculates time-based recency decay weight
 * Recent interactions get exponentially higher influence
 * Half-life: ~24 hours (interactions from 24h ago get 50% weight)
 */
const getRecencyWeight = (timestamp) => {
    const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60);
    return Math.exp(-0.029 * hoursSince); // λ = ln(2)/24 ≈ 0.029
};

/**
 * Builds a frequency map for categorical values across all history
 * Returns proportional weights (0-1) based on how often each value appears
 */
const buildFrequencyMap = (interactions, field) => {
    const counts = {};
    let total = 0;
    interactions.forEach(item => {
        const val = (item[field] || '').toLowerCase();
        if (val) {
            counts[val] = (counts[val] || 0) + 1;
            total++;
        }
    });
    // Normalize to 0-1 proportions
    Object.keys(counts).forEach(key => {
        counts[key] = counts[key] / total;
    });
    return counts;
};

/**
 * Uses TensorFlow.js to calculate similarity scores between user history and candidates
 * Enhanced with: recency decay, interaction type weights, frequency-based categorical matching,
 * and a 10-dimensional feature vector
 * 
 * @param {Array} allCandidates - All available listing objects to score
 * @param {number} limit - Max number of results to return
 * @param {Array} additionalInteractions - Wishlist/Watchlist items (with _sentinelType tag)
 * @param {string} userId - The current user's ID (required — returns [] without it)
 */
export const getLiveRecommendations = async (allCandidates, limit = 4, additionalInteractions = [], userId = null) => {
    try {
        // Read user-scoped interaction history from localStorage
        let rawInteractions = [];
        if (userId) {
            const storageKey = getStorageKey(userId);
            rawInteractions = JSON.parse(localStorage.getItem(storageKey) || '[]');
        }

        // Merge with additional interactions (Wishlist/Watchlist) if provided
        if (additionalInteractions && additionalInteractions.length > 0) {
            const formattedAdditional = additionalInteractions.map(item => ({
                _id: item._id,
                city: item.city?.toLowerCase() || '',
                state: item.state?.toLowerCase() || '',
                type: item.type || '',
                price: item.offer ? item.discountPrice : item.regularPrice,
                bedrooms: Number(item.bedrooms) || 0,
                bathrooms: Number(item.bathrooms) || 0,
                area: Number(item.area) || 0,
                parking: !!item.parking,
                furnished: !!item.furnished,
                gym: !!item.gym,
                swimmingPool: !!item.swimmingPool,
                security: !!item.security,
                wifi: !!item.wifi,
                garden: !!item.garden,
                lift: !!item.lift,
                interactionType: item._sentinelType || 'wishlist', // Default to wishlist for externally-provided items
                timestamp: Date.now()
            }));

            // Combine: External items first (high priority), then local history
            rawInteractions = [...formattedAdditional, ...rawInteractions];

            // Deduplicate by ID (keep first occurrence = higher priority)
            const seen = new Set();
            rawInteractions = rawInteractions.filter(item => {
                if (seen.has(item._id)) return false;
                seen.add(item._id);
                return true;
            });
        }

        if (rawInteractions.length === 0 || !allCandidates || allCandidates.length === 0) {
            return [];
        }

        // Filter out candidates already in history
        const historyIds = new Set(rawInteractions.map(i => i._id));
        const filteredCandidates = allCandidates.filter(c => !historyIds.has(c._id));

        if (filteredCandidates.length === 0) return [];

        // Determine max values for normalization across both sets
        const combined = [...rawInteractions, ...filteredCandidates];
        const maxPrice = Math.max(...combined.map(l => l.price || (l.offer ? l.discountPrice : l.regularPrice) || 0), 1);
        const maxBeds = Math.max(...combined.map(l => Number(l.bedrooms) || 0), 1);
        const maxBaths = Math.max(...combined.map(l => Number(l.bathrooms) || 0), 1);
        const maxArea = Math.max(...combined.map(l => Number(l.area) || 0), 1);

        // Vectorize history and candidates
        const historyVectors = rawInteractions.map(l => vectorize(l, maxPrice, maxBeds, maxBaths, maxArea));
        const candidateVectors = filteredCandidates.map(l => vectorize(l, maxPrice, maxBeds, maxBaths, maxArea));

        // Build per-interaction weights (recency × interaction type)
        const interactionWeights = rawInteractions.map(item => {
            const recency = getRecencyWeight(item.timestamp || Date.now());
            const typeWeight = INTERACTION_WEIGHTS[item.interactionType] || 1.0;
            return recency * typeWeight;
        });

        // Normalize weights so they sum to 1 (for weighted average)
        const totalWeight = interactionWeights.reduce((a, b) => a + b, 0) || 1;
        const normalizedWeights = interactionWeights.map(w => w / totalWeight);

        // Create Tensors
        const historyTensor = tf.tensor2d(historyVectors);
        const candidateTensor = tf.tensor2d(candidateVectors);
        const weightsTensor = tf.tensor1d(normalizedWeights);

        // Calculate Cosine Similarity
        const normHistory = tf.div(historyTensor, tf.norm(historyTensor, 'euclidean', 1, true).add(1e-9));
        const normCandidates = tf.div(candidateTensor, tf.norm(candidateTensor, 'euclidean', 1, true).add(1e-9));

        // Dot product: each candidate against each history item
        const similarities = tf.matMul(normCandidates, normHistory, false, true); // shape: [candidates, history]

        // Weighted average similarity (instead of simple mean)
        const weightedSims = tf.matMul(similarities, weightsTensor.reshape([-1, 1])); // shape: [candidates, 1]
        const scores = await weightedSims.squeeze().data();

        // Build frequency maps for city and type from ALL history
        const cityFrequency = buildFrequencyMap(rawInteractions, 'city');
        const typeFrequency = buildFrequencyMap(rawInteractions, 'type');
        const stateFrequency = buildFrequencyMap(rawInteractions, 'state');

        // Score each candidate with categorical bonuses
        const finalResults = filteredCandidates.map((listing, idx) => {
            let score = scores[idx];

            // Frequency-weighted city bonus (proportional to how often user browses that city)
            const cityKey = (listing.city || '').toLowerCase();
            if (cityFrequency[cityKey]) {
                score += 0.4 * cityFrequency[cityKey];
            }

            // Frequency-weighted type bonus
            const typeKey = (listing.type || '').toLowerCase();
            if (typeFrequency[typeKey]) {
                score += 0.25 * typeFrequency[typeKey];
            }

            // State-level geo bonus (lighter than city — captures regional preference)
            const stateKey = (listing.state || '').toLowerCase();
            if (stateFrequency[stateKey]) {
                score += 0.15 * stateFrequency[stateKey];
            }

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
        weightedSims.dispose();
        weightsTensor.dispose();

        // Sort by score and return limited results
        return finalResults
            .sort((a, b) => b.sentinelScore - a.sentinelScore)
            .slice(0, limit);

    } catch (error) {
        console.error('Sentinel Live: Recommendation failed', error);
        return [];
    }
};
