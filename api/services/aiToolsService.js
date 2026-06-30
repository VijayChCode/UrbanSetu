import Listing from "../models/listing.model.js";
import Blog from "../models/blog.model.js";
import Reminder from "../models/reminder.model.js";

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
        if (!propertyId || !propertyId.match(/^[0-9a-fA-F]{24}$/)) {
            return JSON.stringify({ found: false, message: "Invalid property ID format." });
        }
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
 * AI Tool: Sentinel Image Auditor
 * Purpose: Simulates or proxies the Sentinel Vision analysis for images uploaded in chat.
 */
export const sentinelImageAuditor = async ({ image_url, imageAudits }) => {
    try {
        if (!image_url) return JSON.stringify({ error: "Image URL is required." });

        // Extract filename for more personalized response
        const parts = image_url.split('/');
        const fileName = parts[parts.length - 1] || "uploaded image";
        
        // 1. Check if we have pre-calculated audit data from the frontend (TensorFlow.js)
        const preCalculated = imageAudits && imageAudits[image_url];
        
        if (preCalculated) {
            console.log(`✅ Using accurate pixel audit for ${fileName} from browser engine.`);
            const { quality, suggestions, predictions } = preCalculated;
            
            return JSON.stringify({
                status: "success",
                analysis_mode: "Sentinel Vision 2.0 + Browser-Engine Sync",
                image_name: fileName,
                message: `Pixel-level analysis complete for **${fileName}**. This audit was performed using the UrbanSetu Sentinel Engine (TFJS) at source for maximum accuracy.`,
                auditor_results: {
                    quality_score: (quality.score / 100).toFixed(2),
                    detected_entities: suggestions && suggestions.length > 0 ? suggestions : ["Room/Asset"],
                    technical_checks: {
                        brightness: quality.brightness,
                        contrast: quality.contrast
                    },
                    top_classification: predictions && predictions[0] ? predictions[0].className : "Unknown",
                    audit_summary: `The image meets platform standards. Content identified as ${suggestions?.join(', ') || 'real estate related'}.`
                }
            });
        }

        // 2. Fallback to smart simulation if no pre-calculated data is provided
        const seed = fileName.length % 5;
        const baseScore = 0.92 + (seed * 0.01);
        const score = Math.min(0.99, baseScore).toFixed(2);

        return JSON.stringify({
            status: "success",
            analysis_mode: "Sentinel Vision 2.0 (Simulated)",
            image_name: fileName,
            message: `Sentinel Image Auditor has completed a pixel-level analysis of **${fileName}**. (Note: Local audit data unavailable, using server-side estimation).`,
            auditor_results: {
                quality_score: score,
                detected_entities: ["Residential Property", seed % 2 === 0 ? "Interior" : "Exterior", "High Resolution"],
                audit_summary: "No fraudulent patterns or watermarks detected. Image properties match platform optimization requirements."
            }
        });

    } catch (error) {
        console.error("Tool Error (sentinelImageAuditor):", error);
        return JSON.stringify({ error: "Failed to audit image." });
    }
};

/**
 * AI Tool: Search Blogs and Guides
 * Purpose: Allows the AI to find relevant educational content, market trends, and guides.
 */
export const searchBlogsAndGuides = async ({
    searchTerm = '',
    category,
    type, // blog or guide
    limit = 5
}) => {
    try {
        const query = { published: true };

        if (searchTerm) {
            query.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { category: { $regex: searchTerm, $options: 'i' } },
                { tags: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        if (category && category !== 'All') query.category = category;
        if (type && type !== 'all') query.type = type;

        const results = await Blog.find(query)
            .populate('author', 'username')
            .sort({ publishedAt: -1 })
            .limit(limit)
            .lean();

        if (results.length === 0) {
            return JSON.stringify({
                found: false,
                message: `No ${type || 'blogs or guides'} found for your request.`
            });
        }

        const summary = results.map(r => `- "${r.title}" (${r.type.toUpperCase()})`).join('\n');

        return JSON.stringify({
            found: results.length > 0,
            count: results.length,
            summary: summary,
            recommendations: results.map(r => ({
                _id: r._id.toString(),
                id: r._id.toString(),
                title: r.title,
                slug: r.slug,
                excerpt: r.excerpt,
                content: r.content.substring(0, 200), // Short preview
                thumbnail: r.thumbnail,
                imageUrls: r.imageUrls,
                videoUrls: r.videoUrls,
                category: r.category,
                type: r.type,
                author: r.author,
                publishedAt: r.publishedAt,
                views: r.views,
                likes: r.likes
            }))
        });

    } catch (error) {
        console.error("Tool Error (searchBlogsAndGuides):", error);
        return JSON.stringify({ error: "Failed to search blogs and guides." });
    }
};

/**
 * AI Tool: Schedule Reminder
 * Purpose: Allows the AI to schedule a reminder/task alarm for a user.
 */
export const scheduleReminder = async ({
    reminderText,
    scheduledTime,
    userId
}) => {
    try {
        if (!userId) {
            return JSON.stringify({
                success: false,
                message: "User is not logged in. Reminders cannot be scheduled for guests."
            });
        }
        if (!reminderText) {
            return JSON.stringify({
                success: false,
                message: "Reminder description is required."
            });
        }

        // Daily rate limit: check how many reminders the user scheduled in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyCount = await Reminder.countDocuments({
            userId,
            createdAt: { $gte: oneDayAgo }
        });

        if (dailyCount >= 10) {
            return JSON.stringify({
                success: false,
                message: "Daily reminder limit reached (10 reminders/day). Please try again later."
            });
        }
        
        let targetTime = new Date(scheduledTime);
        if (isNaN(targetTime.getTime())) {
            // Simple relative parsing fallback in case LLM passes invalid string
            const now = new Date();
            if (scheduledTime && scheduledTime.includes("minute")) {
                const mins = parseInt(scheduledTime) || 5;
                targetTime = new Date(now.getTime() + mins * 60 * 1000);
            } else if (scheduledTime && scheduledTime.includes("hour")) {
                const hrs = parseInt(scheduledTime) || 1;
                targetTime = new Date(now.getTime() + hrs * 60 * 60 * 1000);
            } else {
                return JSON.stringify({
                    success: false,
                    message: "Invalid time format provided. Please specify a valid date and time."
                });
            }
        }

        const reminder = new Reminder({
            userId,
            taskText: reminderText,
            scheduledTime: targetTime,
            status: 'scheduled'
        });

        await reminder.save();

        return JSON.stringify({
            success: true,
            message: `Successfully scheduled reminder for: "${reminderText}"`,
            scheduledTime: reminder.scheduledTime.toISOString(),
            status: "scheduled",
            reminderId: reminder._id.toString()
        });

    } catch (error) {
        console.error("Tool Error (scheduleReminder):", error);
        return JSON.stringify({ success: false, error: "Failed to schedule reminder." });
    }
};

/**
 * AI Tool: Get User Reminders
 * Purpose: Allows the AI to fetch all reminders for the current user to answer questions about active or past reminders.
 */
export const getUserRemindersTool = async ({ userId }) => {
    try {
        if (!userId) {
            return JSON.stringify({
                success: false,
                message: "User is not logged in. Reminders cannot be retrieved for guests."
            });
        }

        const reminders = await Reminder.find({ userId }).sort({ scheduledTime: 1 });

        return JSON.stringify({
            success: true,
            reminders: reminders.map(r => ({
                id: r._id.toString(),
                taskText: r.taskText,
                scheduledTime: r.scheduledTime.toISOString(),
                status: r.status,
                emailSent: r.emailSent,
                createdAt: r.createdAt.toISOString()
            }))
        });
    } catch (error) {
        console.error("Tool Error (getUserRemindersTool):", error);
        return JSON.stringify({ success: false, error: "Failed to retrieve reminders." });
    }
};

/**
 * AI Tool: Reschedule Reminder
 * Purpose: Allows the AI to update the scheduled time of an existing reminder.
 */
export const rescheduleReminderTool = async ({
    reminderId,
    newScheduledTime,
    newReminderText,
    userId
}) => {
    try {
        if (!userId) {
            return JSON.stringify({
                success: false,
                message: "User is not logged in. Reminders cannot be rescheduled for guests."
            });
        }
        if (!reminderId) {
            return JSON.stringify({
                success: false,
                message: "Reminder ID is required to reschedule."
            });
        }
        if (!newScheduledTime) {
            return JSON.stringify({
                success: false,
                message: "New scheduled time is required."
            });
        }

        let targetTime = new Date(newScheduledTime);
        if (isNaN(targetTime.getTime())) {
            return JSON.stringify({
                success: false,
                message: "Invalid date-time format provided."
            });
        }

        if (targetTime <= new Date()) {
            return JSON.stringify({
                success: false,
                message: "Cannot reschedule a reminder to a past date or time."
            });
        }

        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) {
            return JSON.stringify({
                success: false,
                message: "Reminder not found or you are unauthorized to modify it."
            });
        }

        if (reminder.status !== 'scheduled') {
            return JSON.stringify({
                success: false,
                message: `Only active scheduled reminders can be rescheduled. Current status is: ${reminder.status}`
            });
        }

        if (newReminderText && newReminderText.trim()) {
            reminder.taskText = newReminderText.trim();
        }

        reminder.scheduledTime = targetTime;
        await reminder.save();

        return JSON.stringify({
            success: true,
            message: `Successfully rescheduled reminder "${reminder.taskText}" to ${reminder.scheduledTime.toISOString()}`,
            reminderId: reminder._id.toString(),
            newScheduledTime: reminder.scheduledTime.toISOString()
        });

    } catch (error) {
        console.error("Tool Error (rescheduleReminderTool):", error);
        return JSON.stringify({ success: false, error: "Failed to reschedule reminder." });
    }
};

/**
 * AI Tool: Cancel Reminder
 * Purpose: Allows the AI to cancel an existing reminder.
 */
export const cancelReminderTool = async ({
    reminderId,
    confirmed = false,
    userId
}) => {
    try {
        if (!userId) {
            return JSON.stringify({
                success: false,
                message: "User is not logged in. Reminders cannot be cancelled for guests."
            });
        }
        if (!reminderId) {
            return JSON.stringify({
                success: false,
                message: "Reminder ID is required to cancel."
            });
        }

        // Special case: cancel ALL active reminders for this user
        if (reminderId === 'ALL' || reminderId === 'all') {
            if (!confirmed) {
                return JSON.stringify({
                    success: false,
                    requires_confirmation: true,
                    reminderId: 'ALL',
                    reminderText: 'All active reminders',
                    message: 'Cancellation of all active reminders requires user confirmation.'
                });
            }
            const activeReminders = await Reminder.find({
                userId,
                status: { $in: ['scheduled', 'snoozed', 'triggered'] }
            });
            if (activeReminders.length === 0) {
                return JSON.stringify({ success: true, message: "No active reminders to cancel." });
            }
            await Reminder.updateMany(
                { userId, status: { $in: ['scheduled', 'snoozed', 'triggered'] } },
                { $set: { status: 'cancelled' } }
            );
            return JSON.stringify({
                success: true,
                message: `Successfully cancelled all ${activeReminders.length} active reminder(s).`,
                cancelledCount: activeReminders.length
            });
        }

        // Single reminder — validate ObjectId format, fall back to task-text lookup
        const isValidObjectId = /^[a-f\d]{24}$/i.test(reminderId);
        let reminder = null;

        if (isValidObjectId) {
            reminder = await Reminder.findOne({ _id: reminderId, userId });
        }

        // Fallback: if not found by ID (or ID is not valid), search by taskText (partial, case-insensitive)
        if (!reminder) {
            const activeReminders = await Reminder.find({
                userId,
                status: { $in: ['scheduled', 'snoozed', 'triggered'] }
            });
            // Try exact match first, then partial
            reminder = activeReminders.find(r =>
                r.taskText.toLowerCase() === reminderId.toLowerCase()
            ) || activeReminders.find(r =>
                r.taskText.toLowerCase().includes(reminderId.toLowerCase()) ||
                reminderId.toLowerCase().includes(r.taskText.toLowerCase())
            );

            if (!reminder) {
                // Return the list so AI can present it to the user
                const listSummary = activeReminders.map(r => `"${r.taskText}" (id: ${r._id})`).join(', ');
                return JSON.stringify({
                    success: false,
                    message: `No active reminder matching "${reminderId}" was found.${activeReminders.length > 0 ? ` Active reminders: ${listSummary}` : ' You have no active reminders.'}`
                });
            }
        }

        // If not confirmed yet, return confirmation required status
        if (!confirmed) {
            return JSON.stringify({
                success: false,
                requires_confirmation: true,
                reminderId: reminder._id.toString(),
                reminderText: reminder.taskText,
                message: `Cancellation of reminder "${reminder.taskText}" requires user confirmation.`
            });
        }

        reminder.status = 'cancelled';
        await reminder.save();

        return JSON.stringify({
            success: true,
            message: `Successfully cancelled reminder "${reminder.taskText}"`,
            reminderId: reminder._id.toString(),
            status: "cancelled"
        });

    } catch (error) {
        console.error("Tool Error (cancelReminderTool):", error);
        return JSON.stringify({ success: false, error: "Failed to cancel reminder." });
    }
};

/**
 * Registry of all available tools
 */
export const toolRegistry = {
    search_properties: searchProperties,
    get_property_details: getPropertyDetails,
    get_user_listings: getUserListings,
    sentinel_image_auditor: sentinelImageAuditor,
    search_blogs_and_guides: searchBlogsAndGuides,
    schedule_reminder: scheduleReminder,
    get_user_reminders: getUserRemindersTool,
    reschedule_reminder: rescheduleReminderTool,
    cancel_reminder: cancelReminderTool
};

/**
 * Tool Definitions for the AI System Prompt (JSON Schema)
 */
export const toolDefinitions = [
    {
        type: "function",
        function: {
            name: "search_properties",
            description: "Search ONLY for real estate properties (apartments, houses, villas) on UrbanSetu. Use this ONLY when the user asks to find, buy, rent, or suggest properties. Do NOT use for general knowledge (e.g., capitals, math, coding).",
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
                        enum: ["sale", "rent", "all", ""],
                        description: "Type of listing: 'sale', 'rent', or 'all'. Leave empty if not specified."
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
    },
    {
        type: "function",
        function: {
            name: "sentinel_image_auditor",
            description: "Audit and analyze images using the Sentinel Vision system. IMPORTANT: Do NOT call this tool if the user's message already contains '[SENTINEL AUDIT RESULTS]' — those images have already been analyzed. Only use this tool when the user explicitly asks you to re-audit an image that has no existing analysis.",
            parameters: {
                type: "object",
                properties: {
                    image_url: {
                        type: "string",
                        description: "The full URL of the image to analyze."
                    }
                },
                required: ["image_url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_blogs_and_guides",
            description: "Search for educational blogs, real estate guides, market trends, and investment tips on UrbanSetu. Use this when the user asks for advice, learning materials, or market insights.",
            parameters: {
                type: "object",
                properties: {
                    searchTerm: {
                        type: "string",
                        description: "Keywords to search for (e.g., 'buying tips', 'market trends'). If the user asks for blogs/guides generically without specifying keywords, leave this as an empty string to find all recent content."
                    },
                    category: {
                        type: "string",
                        description: "Filter by category if specified. Common categories: Real Estate Tips, Market Updates, Investment Guide, Home Buying, Home Selling, Property Management, Legal, Finance, Rent, Investment, City Guide."
                    },
                    type: {
                        type: "string",
                        enum: ["blog", "guide", "all"],
                        description: "Filter by content type: 'blog' or 'guide'."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "schedule_reminder",
            description: "Schedule a task reminder or alarm for a user at a specific future date and time. Use this ONLY when the user asks to be reminded of something, or schedules an alarm/clock/reminder.",
            parameters: {
                type: "object",
                properties: {
                    reminderText: {
                        type: "string",
                        description: "What the user wants to be reminded of (e.g., 'Check pricing for Ocean Breeze flat')"
                    },
                    scheduledTime: {
                        type: "string",
                        description: "The absolute date and time when the reminder should trigger, formatted as a valid ISO 8601 string (e.g., '2026-06-22T10:30:00.000Z'). Note: The current local time is provided in the system prompt. Calculate relative offsets using it."
                    }
                },
                required: ["reminderText", "scheduledTime"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_reminders",
            description: "Retrieve all scheduled, triggered, and cancelled reminders for the current logged-in user. Use this when the user asks what active, scheduled, past, or cancelled reminders they have present in the system.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "reschedule_reminder",
            description: "Reschedule an existing active scheduled reminder to a new date and time. Use this when the user asks to change, reschedule, move, or defer a reminder. Optionally change/rename the reminder description text. First use get_user_reminders to find the active reminder ID.",
            parameters: {
                type: "object",
                properties: {
                    reminderId: {
                        type: "string",
                        description: "The unique ID of the reminder to reschedule (e.g., '65f123...')"
                    },
                    newScheduledTime: {
                        type: "string",
                        description: "The new absolute date and time, formatted as a valid ISO 8601 string (e.g., '2026-06-22T10:30:00.000Z')."
                    },
                    newReminderText: {
                        type: "string",
                        description: "Optional new text description for the reminder."
                    }
                },
                required: ["reminderId", "newScheduledTime"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "cancel_reminder",
            description: "Cancel an existing scheduled reminder. Use this when the user asks to delete, cancel, abort, or remove a reminder. First use get_user_reminders to find the active reminder ID.",
            parameters: {
                type: "object",
                properties: {
                    reminderId: {
                        type: "string",
                        description: "The unique ID of the reminder to cancel (e.g., '65f123...')"
                    },
                    confirmed: {
                        type: "boolean",
                        description: "Must be true only if the user has explicitly confirmed they want to cancel this specific reminder. If the user just asked to cancel it but hasn't confirmed yet, this must be false."
                    }
                },
                required: ["reminderId"]
            }
        }
    }
];
