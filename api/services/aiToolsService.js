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

        // Price Range - check both regular and discount prices
        if (minPrice || maxPrice) {
            const priceQuery = [];
            
            if (minPrice) {
                const min = Number(minPrice);
                if (!isNaN(min)) {
                    priceQuery.push({ regularPrice: { $gte: min } });
                    priceQuery.push({ discountPrice: { $gte: min } });
                }
            }
            
            if (maxPrice) {
                const max = Number(maxPrice);
                if (!isNaN(max)) {
                    priceQuery.push({ regularPrice: { $lte: max } });
                    priceQuery.push({ discountPrice: { $lte: max } });
                }
            }

            if (priceQuery.length > 0) {
                query.$or = priceQuery;
            }
        }

        // Bedrooms
        if (bedrooms) {
            const bhk = Number(bedrooms);
            if (!isNaN(bhk)) query.bedrooms = bhk;
        }

        // Visibility Enforcement (Public only)
        query.visibility = 'public';
        
        // Execute Query - Try verified first
        let listings = await Listing.find({ ...query, isVerified: true })
            .select('name city type regularPrice discountPrice offer imageUrls bedrooms bathrooms area address propertyNumber landmark state pincode isVerified userRef description')
            .limit(limit)
            .lean();

        // If no verified results, try unverified but warn the AI
        let unverifiedNote = "";
        if (listings.length === 0) {
            listings = await Listing.find(query)
                .select('name city type regularPrice discountPrice offer imageUrls bedrooms bathrooms area address propertyNumber landmark state pincode isVerified userRef description')
                .limit(limit)
                .lean();
            if (listings.length > 0) {
                unverifiedNote = "Note: These properties are pending verification.";
            }
        }

        if (listings.length === 0) {
            return JSON.stringify({
                found: false,
                message: `No properties found in ${city || 'the requested criteria'}.`
            });
        }

        const propertySummary = listings.map(l => `- "${l.name}" (ID: ${l._id.toString()}) in ${l.city}`).join('\n');

        return JSON.stringify({
            found: true,
            unverifiedNote,
            count: listings.length,
            summary: propertySummary,
            listings: listings.map(l => ({
                _id: l._id.toString(),
                id: l._id.toString(), // Alias
                name: l.name,
                type: l.type,
                price: l.discountPrice || l.regularPrice,
                regularPrice: l.regularPrice,
                discountPrice: l.discountPrice,
                offer: l.offer,
                imageUrls: l.imageUrls,
                bedrooms: l.bedrooms,
                bathrooms: l.bathrooms,
                area: l.area,
                address: l.address,
                city: l.city,
                state: l.state,
                propertyNumber: l.propertyNumber,
                landmark: l.landmark,
                pincode: l.pincode,
                isVerified: l.isVerified,
                userRef: l.userRef?.toString(),
                description: l.description
            }))
        });

    } catch (error) {
        console.error("Tool Error (searchProperties):", error);
        return JSON.stringify({ error: "Failed to search properties." });
    }
};

/**
 * AI Tool: Get Property Details
 * Purpose: Allows the AI to fetch full details for a specific property by its ID.
 */
export const getPropertyDetails = async ({ propertyId }) => {
    try {
        if (!propertyId) return JSON.stringify({ error: "Property ID is required." });

        const listing = await Listing.findById(propertyId).lean();

        if (!listing) {
            return JSON.stringify({
                found: false,
                message: "Property not found."
            });
        }

        return JSON.stringify({
            found: true,
            property: listing
        });

    } catch (error) {
        console.error("Tool Error (getPropertyDetails):", error);
        return JSON.stringify({ error: "Failed to fetch property details." });
    }
};

/**
 * AI Tool: Get User Listings (Owned Properties)
 * Purpose: Allows the AI to fetch properties owned by the current logged-in user.
 */
export const getUserListings = async ({ userId }) => {
    try {
        if (!userId) {
            return JSON.stringify({
                found: false,
                message: "User is not logged in. Personalized recommendations of their own properties are unavailable."
            });
        }

        const listings = await Listing.find({ userRef: userId })
            .select('name city type regularPrice discountPrice offer imageUrls bedrooms bathrooms area address propertyNumber landmark state pincode isVerified availabilityStatus userRef description')
            .lean();

        if (listings.length === 0) {
            return JSON.stringify({
                found: false,
                message: "This user has not created any property listings yet."
            });
        }

        const propertySummary = listings.map(l => `- "${l.name}" (ID: ${l._id.toString()}) [Status: ${l.availabilityStatus || 'Available'}]`).join('\n');

        return JSON.stringify({
            found: true,
            count: listings.length,
            summary: propertySummary,
            listings: listings.map(l => ({
                _id: l._id.toString(),
                id: l._id.toString(),
                name: l.name,
                type: l.type,
                price: l.discountPrice || l.regularPrice,
                regularPrice: l.regularPrice,
                discountPrice: l.discountPrice,
                offer: l.offer,
                imageUrls: l.imageUrls,
                bedrooms: l.bedrooms,
                bathrooms: l.bathrooms,
                area: l.area,
                address: l.address,
                city: l.city,
                state: l.state,
                propertyNumber: l.propertyNumber,
                landmark: l.landmark,
                pincode: l.pincode,
                isVerified: l.isVerified,
                availabilityStatus: l.availabilityStatus,
                userRef: l.userRef?.toString(),
                description: l.description
            }))
        });

    } catch (error) {
        console.error("Tool Error (getUserListings):", error);
        return JSON.stringify({ error: "Failed to fetch your properties." });
    }
};

/**
 * Registry of all available tools
 */
export const toolRegistry = {
    search_properties: searchProperties,
    get_property_details: getPropertyDetails,
    get_user_listings: getUserListings
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
                        type: ["number", "string"],
                        description: "Minimum price in INR"
                    },
                    maxPrice: {
                        type: ["number", "string"],
                        description: "Maximum price in INR"
                    },
                    type: {
                        type: "string",
                        enum: ["sale", "rent", "all"],
                        description: "Type of listing: for sale or rent"
                    },
                    bedrooms: {
                        type: ["number", "string"],
                        description: "Number of bedrooms required (numeric)"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_property_details",
            description: "Get comprehensive details about a specific property using its ID.",
            parameters: {
                type: "object",
                properties: {
                    propertyId: {
                        type: "string",
                        description: "The unique ID of the property (e.g., '65f123...')"
                    }
                },
                required: ["propertyId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_listings",
            description: "Fetch all properties owned/listed by the current user. Use this when the user asks about 'my properties', 'my listings', or their own real estate assets.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];
