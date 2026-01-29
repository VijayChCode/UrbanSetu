import Listing from "../models/listing.model.js";

/**
 * AI Tool: Search Properties
 * Purpose: Allows the AI to query the database for listings based on user criteria.
 */
export const searchProperties = async ({
    searchTerm = '',
    minPrice,
    maxPrice,
    type,
    city,
    bedrooms,
    limit = 5
}) => {
    try {
        const query = {};

        // Basic Text Search
        if (searchTerm) {
            query.name = { $regex: searchTerm, $options: 'i' };
        }

        // Filters
        if (type && type !== 'all') query.type = type;
        if (city) query.city = { $regex: city, $options: 'i' };

        // Price Range
        if (minPrice || maxPrice) {
            query.regularPrice = {};
            if (minPrice) {
                const min = Number(minPrice);
                if (!isNaN(min)) query.regularPrice.$gte = min;
            }
            if (maxPrice) {
                const max = Number(maxPrice);
                if (!isNaN(max)) query.regularPrice.$lte = max;
            }
        }

        // Bedrooms
        if (bedrooms) {
            const bhk = Number(bedrooms);
            if (!isNaN(bhk)) query.bedrooms = bhk;
        }

        // Visibility Enforcement (Public only)
        query.visibility = 'public';
        query.isVerified = true;

        // Execute Query
        const listings = await Listing.find(query)
            .select('name city type regularPrice bedrooms bathrooms area address')
            .limit(limit)
            .lean();

        if (listings.length === 0) {
            return JSON.stringify({
                found: false,
                message: "No properties found matching the criteria."
            });
        }

        return JSON.stringify({
            found: true,
            count: listings.length,
            listings: listings.map(l => ({
                id: l._id,
                name: l.name,
                price: l.regularPrice,
                location: `${l.address}, ${l.city}`,
                details: `${l.bedrooms}BHK, ${l.bathrooms} Bath, ${l.area} sqft`
            }))
        });

    } catch (error) {
        console.error("Tool Error (searchProperties):", error);
        return JSON.stringify({ error: "Failed to search properties." });
    }
};

/**
 * Registry of all available tools
 */
export const toolRegistry = {
    search_properties: searchProperties
};

/**
 * Tool Definitions for the AI System Prompt (JSON Schema)
 */
export const toolDefinitions = [
    {
        type: "function",
        function: {
            name: "search_properties",
            description: "Search for real estate properties (apartments, houses, villas) based on location, price, and other criteria.",
            parameters: {
                type: "object",
                properties: {
                    searchTerm: {
                        type: "string",
                        description: "Keywords to search for (e.g., 'Modern apartment', 'Beach house')"
                    },
                    city: {
                        type: "string",
                        description: "City name (e.g., 'Mumbai', 'Bangalore')"
                    },
                    minPrice: {
                        type: "number",
                        description: "Minimum price in INR"
                    },
                    maxPrice: {
                        type: "number",
                        description: "Maximum price in INR"
                    },
                    type: {
                        type: "string",
                        enum: ["sale", "rent", "all"],
                        description: "Type of listing: for sale or rent"
                    },
                    bedrooms: {
                        type: "number",
                        description: "Number of bedrooms required"
                    }
                },
                required: []
            }
        }
    }
];
