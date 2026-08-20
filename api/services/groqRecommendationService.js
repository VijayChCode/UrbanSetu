import path from 'path';
import { fileURLToPath } from 'url';
import { Groq } from 'groq-sdk';
import Listing from '../models/listing.model.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/**
 * Intelligent Recommendation Fallback using Groq LLM
 * Used when vector embeddings are missing or API fails
 */
export const getGroqListingsRecommendation = async (queryText, limit = 5) => {
    try {
        console.log(`🧠 Groq IA Recommender for: "${queryText}"`);

        // 1. Get a pool of candidates using basic fields to avoid token overflow
        // Try to filter by city if mentioned in query
        const queryLower = queryText.toLowerCase();

        // Find cities from common Indian cities list (can expand)
        const commonCities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'pune', 'hyderabad', 'chennai', 'kolkata', 'gurgaon', 'noida'];
        const detectedCity = commonCities.find(c => queryLower.includes(c));

        let queryCriteria = {
            visibility: 'public',
            availabilityStatus: 'available'
        };

        if (detectedCity) {
            // Priority 1: Direct city match
            queryCriteria.city = new RegExp(detectedCity, 'i');
        }

        let candidates = await Listing.find(queryCriteria)
            .limit(15)
            .select('name description city regularPrice bedrooms bathrooms type furnished parking imageUrls offer discountPrice address userRef isVerified');

        // If no city matches or not enough candidates, broaden search
        if (candidates.length < 5) {
            candidates = await Listing.find({
                visibility: 'public',
                availabilityStatus: 'available'
            })
                .limit(15)
                .select('name description city regularPrice bedrooms bathrooms type furnished parking imageUrls offer discountPrice address userRef isVerified');
        }

        if (candidates.length === 0) return [];

        // 2. Format candidates for Groq
        const candidatesText = candidates.map((c, i) =>
            `ID: ${i} | ${c.name} | ${c.city} | ${c.bedrooms}BHK | ${c.type} | ${c.regularPrice} INR | ${c.description.substring(0, 100)}...`
        ).join('\n');

        const systemPrompt = `
            You are a Real Estate Recommendation Expert. 
            User Query: "${queryText}"
            
            Compare the user query with the following 15 properties. 
            Rank them by semantic similarity and suitability.
            
            Return ONLY a valid JSON object with a key "ids" containing an array of indices (0-14).
            Example: { "ids": [2, 0, 5] }
            Do not include any other text.
        `;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Candidates:\n${candidatesText}` }
            ],
            model: GROQ_MODEL,
            temperature: 0.1,
            max_tokens: 100,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        console.log("🤖 Groq recommendation response:", content);

        let topIndices = [];
        try {
            const parsed = JSON.parse(content);
            topIndices = parsed.ids || [];
        } catch (e) {
            console.error("JSON parse failed, trying regex");
            const matches = content.match(/\d+/g);
            if (matches) topIndices = matches.map(Number);
        }

        // 3. Return the actual property objects
        const results = topIndices
            .filter(idx => idx >= 0 && idx < candidates.length)
            .map(idx => candidates[idx])
            .slice(0, limit);

        return results;

    } catch (error) {
        console.error("Groq Recommendation Error:", error);
        return [];
    }
};
