import mongoose from 'mongoose';
import Listing from '../models/listing.model.js';
import Blog from '../models/blog.model.js';
import FAQ from '../models/faq.model.js';
import Review from '../models/review.model.js';
import About from '../models/about.model.js';
import Contact from '../models/contact.model.js';
import Booking from '../models/booking.model.js';
import User from '../models/user.model.js';

/**
 * Data Synchronization Service
 * Automatically keeps chatbot data up-to-date with website changes
 */

// Cache for storing indexed data
let dataCache = {
    properties: new Map(),
    blogs: new Map(),
    faqs: new Map(),
    reviews: new Map(),
    about: new Map(),
    contacts: new Map(),
    bookings: new Map(),
    users: new Map(),
    lastSync: null,
    totalProperties: 0,
    totalBlogs: 0,
    totalFAQs: 0,
    totalReviews: 0,
    totalContacts: 0,
    totalBookings: 0,
    totalUsers: 0
};

/**
 * Index all properties for chatbot
 */
export const indexAllProperties = async () => {
    try {
        console.log('🔄 Indexing all properties for chatbot...');

        const properties = await Listing.find({})
            .select('name city district state regularPrice discountPrice type bedrooms bathrooms area description imageUrls availabilityStatus isVerified esg rentLockPlans monthlyRent securityDepositMonths rentPrediction createdAt updatedAt')
            .lean();

        // Clear existing properties cache
        dataCache.properties.clear();

        // Index properties
        properties.forEach(prop => {
            const propertyData = {
                id: prop._id.toString(),
                name: prop.name,
                location: `${prop.city}, ${prop.district ? prop.district + ', ' : ''}${prop.state}`,
                price: prop.discountPrice || prop.regularPrice,
                originalPrice: prop.regularPrice,
                type: prop.type,
                bedrooms: prop.bedrooms,
                bathrooms: prop.bathrooms,
                area: prop.area,
                description: prop.description,
                image: prop.imageUrls?.[0] || null,
                status: prop.availabilityStatus || 'available',
                isVerified: prop.isVerified || false,
                esgRating: prop.esg?.esgRating || 'Not Rated',
                esgScore: prop.esg?.esgScore || 0,
                rentLockPlans: prop.rentLockPlans?.availablePlans || [],
                monthlyRent: prop.monthlyRent,
                securityDepositMonths: prop.securityDepositMonths,
                rentPrediction: prop.rentPrediction?.priceComparison || 'fair',
                createdAt: prop.createdAt,
                updatedAt: prop.updatedAt,
                indexedAt: new Date()
            };

            dataCache.properties.set(prop._id.toString(), propertyData);
        });

        dataCache.totalProperties = properties.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${properties.length} properties (including status & ESG) for chatbot`);
        return { success: true, count: properties.length };
    } catch (error) {
        console.error('❌ Error indexing properties:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index all blogs for chatbot
 */
export const indexAllBlogs = async () => {
    try {
        console.log('🔄 Indexing all blogs for chatbot...');

        const blogs = await Blog.find({ published: true })
            .select('title content excerpt author tags category publishedAt views likes')
            .lean();

        // Clear existing blogs cache
        dataCache.blogs.clear();

        // Index blogs
        blogs.forEach(blog => {
            const blogData = {
                id: blog._id.toString(),
                title: blog.title,
                content: blog.content,
                excerpt: blog.excerpt || blog.content?.slice(0, 200) + '...',
                author: blog.author,
                tags: blog.tags || [],
                category: blog.category,
                publishedAt: blog.publishedAt,
                views: blog.views,
                likes: blog.likes,
                indexedAt: new Date()
            };

            dataCache.blogs.set(blog._id.toString(), blogData);
        });

        dataCache.totalBlogs = blogs.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${blogs.length} blogs for chatbot`);
        return { success: true, count: blogs.length };
    } catch (error) {
        console.error('❌ Error indexing blogs:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index all FAQs for chatbot
 */
export const indexAllFAQs = async () => {
    try {
        console.log('🔄 Indexing all FAQs for chatbot...');

        const faqs = await FAQ.find({ isActive: true })
            .select('question answer category priority tags views helpful notHelpful')
            .lean();

        // Clear existing FAQs cache
        dataCache.faqs.clear();

        // Index FAQs
        faqs.forEach(faq => {
            const faqData = {
                id: faq._id.toString(),
                question: faq.question,
                answer: faq.answer,
                category: faq.category,
                priority: faq.priority,
                tags: faq.tags || [],
                views: faq.views,
                helpful: faq.helpful,
                notHelpful: faq.notHelpful,
                indexedAt: new Date()
            };

            dataCache.faqs.set(faq._id.toString(), faqData);
        });

        dataCache.totalFAQs = faqs.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${faqs.length} FAQs for chatbot`);
        return { success: true, count: faqs.length };
    } catch (error) {
        console.error('❌ Error indexing FAQs:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index all reviews for chatbot
 */
export const indexAllReviews = async () => {
    try {
        console.log('🔄 Indexing all reviews for chatbot...');

        const reviews = await Review.find({ status: 'approved' })
            .populate('listingId', 'name city state')
            .populate('userId', 'username')
            .select('listingId userId rating comment userName userAvatar isVerified helpfulCount dislikeCount ownerResponse createdAt')
            .lean();

        // Clear existing reviews cache
        dataCache.reviews.clear();

        // Index reviews
        reviews.forEach(review => {
            const reviewData = {
                id: review._id.toString(),
                listingId: review.listingId?._id?.toString(),
                listingName: review.listingId?.name,
                listingLocation: review.listingId ? `${review.listingId.city}, ${review.listingId.state}` : 'Unknown',
                userId: review.userId?._id?.toString(),
                userName: review.userName,
                userAvatar: review.userAvatar,
                rating: review.rating,
                comment: review.comment,
                isVerified: review.isVerified,
                helpfulCount: review.helpfulCount,
                dislikeCount: review.dislikeCount,
                ownerResponse: review.ownerResponse,
                createdAt: review.createdAt,
                indexedAt: new Date()
            };

            dataCache.reviews.set(review._id.toString(), reviewData);
        });

        dataCache.totalReviews = reviews.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${reviews.length} reviews for chatbot`);
        return { success: true, count: reviews.length };
    } catch (error) {
        console.error('❌ Error indexing reviews:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index about page content for chatbot
 */
export const indexAboutContent = async () => {
    try {
        console.log('🔄 Indexing about content for chatbot...');

        const aboutContent = await About.findOne()
            .select('heroTitle heroText mission features whoWeServe trust team contact customFields lastUpdated')
            .lean();

        // Clear existing about cache
        dataCache.about.clear();

        if (aboutContent) {
            const aboutData = {
                id: aboutContent._id.toString(),
                heroTitle: aboutContent.heroTitle,
                heroText: aboutContent.heroText,
                mission: aboutContent.mission,
                features: aboutContent.features || [],
                whoWeServe: aboutContent.whoWeServe || [],
                trust: aboutContent.trust,
                team: aboutContent.team,
                contact: aboutContent.contact,
                customFields: aboutContent.customFields || [],
                lastUpdated: aboutContent.lastUpdated,
                indexedAt: new Date()
            };

            dataCache.about.set(aboutContent._id.toString(), aboutData);
        }

        dataCache.lastSync = new Date();

        console.log(`✅ Indexed about content for chatbot`);
        return { success: true, count: aboutContent ? 1 : 0 };
    } catch (error) {
        console.error('❌ Error indexing about content:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index contact messages for chatbot (for admin insights)
 */
export const indexContactMessages = async () => {
    try {
        console.log('🔄 Indexing contact messages for chatbot...');

        const contacts = await Contact.find({ status: { $in: ['read', 'replied'] } })
            .select('email subject message status adminReply adminReplyAt createdAt')
            .sort({ createdAt: -1 })
            .limit(100) // Limit to recent 100 messages
            .lean();

        // Clear existing contacts cache
        dataCache.contacts.clear();

        // Index contacts
        contacts.forEach(contact => {
            const contactData = {
                id: contact._id.toString(),
                email: contact.email,
                subject: contact.subject,
                message: contact.message,
                status: contact.status,
                adminReply: contact.adminReply,
                adminReplyAt: contact.adminReplyAt,
                createdAt: contact.createdAt,
                indexedAt: new Date()
            };

            dataCache.contacts.set(contact._id.toString(), contactData);
        });

        dataCache.totalContacts = contacts.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${contacts.length} contact messages for chatbot`);
        return { success: true, count: contacts.length };
    } catch (error) {
        console.error('❌ Error indexing contact messages:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index booking data for chatbot (for market insights)
 */
export const indexBookingData = async () => {
    try {
        console.log('🔄 Indexing booking data for chatbot...');

        const bookings = await Booking.find({ status: { $in: ['accepted', 'completed'] } })
            .populate('listingId', 'name city state type regularPrice')
            .populate('buyerId', 'username')
            .populate('sellerId', 'username')
            .select('listingId buyerId sellerId purpose propertyName propertyDescription status date createdAt')
            .sort({ createdAt: -1 })
            .limit(200) // Limit to recent 200 bookings
            .lean();

        // Clear existing bookings cache
        dataCache.bookings.clear();

        // Index bookings
        bookings.forEach(booking => {
            const bookingData = {
                id: booking._id.toString(),
                listingId: booking.listingId?._id?.toString(),
                listingName: booking.listingId?.name,
                listingLocation: booking.listingId ? `${booking.listingId.city}, ${booking.listingId.state}` : 'Unknown',
                listingType: booking.listingId?.type,
                listingPrice: booking.listingId?.regularPrice,
                buyerId: booking.buyerId?._id?.toString(),
                buyerName: booking.buyerId?.username,
                sellerId: booking.sellerId?._id?.toString(),
                sellerName: booking.sellerId?.username,
                purpose: booking.purpose,
                propertyName: booking.propertyName,
                propertyDescription: booking.propertyDescription,
                status: booking.status,
                date: booking.date,
                createdAt: booking.createdAt,
                indexedAt: new Date()
            };

            dataCache.bookings.set(booking._id.toString(), bookingData);
        });

        dataCache.totalBookings = bookings.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${bookings.length} bookings for chatbot`);
        return { success: true, count: bookings.length };
    } catch (error) {
        console.error('❌ Error indexing booking data:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index user data for chatbot (for market insights)
 */
export const indexUserData = async () => {
    try {
        console.log('🔄 Indexing user data for chatbot...');

        const users = await User.find({
            status: { $ne: 'suspended' },
            role: { $in: ['user', 'seller'] }
        })
            .select('username email mobileNumber address gender role status createdAt')
            .sort({ createdAt: -1 })
            .limit(500) // Limit to recent 500 users
            .lean();

        // Clear existing users cache
        dataCache.users.clear();

        // Index users (anonymized for privacy)
        users.forEach(user => {
            const userData = {
                id: user._id.toString(),
                username: user.username,
                email: user.email ? user.email.replace(/(.{2}).*(@.*)/, '$1***$2') : null, // Anonymize email
                mobileNumber: user.mobileNumber ? user.mobileNumber.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2') : null, // Anonymize mobile
                address: user.address ? user.address.split(' ').slice(0, 2).join(' ') + '...' : null, // Partial address
                gender: user.gender,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                indexedAt: new Date()
            };

            dataCache.users.set(user._id.toString(), userData);
        });

        dataCache.totalUsers = users.length;
        dataCache.lastSync = new Date();

        console.log(`✅ Indexed ${users.length} users for chatbot`);
        return { success: true, count: users.length };
    } catch (error) {
        console.error('❌ Error indexing user data:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Index all website data
 */
export const indexAllWebsiteData = async () => {
    try {
        console.log('🚀 Starting full website data indexing...');

        const [propertiesResult, blogsResult, faqsResult, reviewsResult, aboutResult, contactsResult, bookingsResult, usersResult] = await Promise.all([
            indexAllProperties(),
            indexAllBlogs(),
            indexAllFAQs(),
            indexAllReviews(),
            indexAboutContent(),
            indexContactMessages(),
            indexBookingData(),
            indexUserData()
        ]);

        const totalIndexed = propertiesResult.count + blogsResult.count + faqsResult.count + reviewsResult.count + aboutResult.count + contactsResult.count + bookingsResult.count + usersResult.count;

        console.log(`🎉 Full indexing completed: ${totalIndexed} items indexed`);
        console.log(`📊 Breakdown: ${propertiesResult.count} properties, ${blogsResult.count} blogs, ${faqsResult.count} FAQs, ${reviewsResult.count} reviews, ${aboutResult.count} about content, ${contactsResult.count} contacts, ${bookingsResult.count} bookings, ${usersResult.count} users`);

        return {
            success: true,
            totalIndexed,
            breakdown: {
                properties: propertiesResult.count,
                blogs: blogsResult.count,
                faqs: faqsResult.count,
                reviews: reviewsResult.count,
                about: aboutResult.count,
                contacts: contactsResult.count,
                bookings: bookingsResult.count,
                users: usersResult.count
            },
            lastSync: dataCache.lastSync
        };
    } catch (error) {
        console.error('❌ Error in full indexing:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get cached data for chatbot
 */
export const getCachedData = () => {
    return {
        properties: Array.from(dataCache.properties.values()),
        blogs: Array.from(dataCache.blogs.values()),
        faqs: Array.from(dataCache.faqs.values()),
        reviews: Array.from(dataCache.reviews.values()),
        about: Array.from(dataCache.about.values()),
        contacts: Array.from(dataCache.contacts.values()),
        bookings: Array.from(dataCache.bookings.values()),
        users: Array.from(dataCache.users.values()),
        stats: {
            totalProperties: dataCache.totalProperties,
            totalBlogs: dataCache.totalBlogs,
            totalFAQs: dataCache.totalFAQs,
            totalReviews: dataCache.totalReviews,
            totalContacts: dataCache.totalContacts,
            totalBookings: dataCache.totalBookings,
            totalUsers: dataCache.totalUsers,
            lastSync: dataCache.lastSync
        }
    };
};

/**
 * Search cached properties
 */
export const searchCachedProperties = (query, limit = 5) => {
    const properties = Array.from(dataCache.properties.values());

    if (!query || query.trim().length === 0) {
        return properties.slice(0, limit);
    }

    const searchTerm = query.toLowerCase();
    const filtered = properties.filter(prop =>
        prop.name.toLowerCase().includes(searchTerm) ||
        prop.location.toLowerCase().includes(searchTerm) ||
        prop.type.toLowerCase().includes(searchTerm) ||
        prop.description.toLowerCase().includes(searchTerm)
    );

    return filtered.slice(0, limit);
};

/**
 * Get relevant cached data for user query
 */
export const getRelevantCachedData = (userMessage, selectedProperties = []) => {
    const keywords = extractKeywords(userMessage);
    const cachedData = getCachedData();

    let contextData = '';

    // Add website info
    contextData += `COMPANY: UrbanSetu\n`;
    contextData += `TOTAL PROPERTIES: ${cachedData.stats.totalProperties}\n`;
    contextData += `TOTAL BLOGS: ${cachedData.stats.totalBlogs}\n`;
    contextData += `TOTAL FAQs: ${cachedData.stats.totalFAQs}\n`;
    contextData += `TOTAL REVIEWS: ${cachedData.stats.totalReviews}\n`;
    contextData += `TOTAL CONTACTS: ${cachedData.stats.totalContacts}\n`;
    contextData += `TOTAL BOOKINGS: ${cachedData.stats.totalBookings}\n`;
    contextData += `TOTAL USERS: ${cachedData.stats.totalUsers}\n`;
    contextData += `LAST SYNC: ${cachedData.stats.lastSync?.toISOString() || 'Never'}\n`;
    contextData += `SERVICES: Property Search, Home Buying, Investment Guidance, Property Management, Legal & Documentation Support\n\n`;

    // Add selected properties and blogs/guides first (if any)
    const BASE_URL = 'https://urbansetu.vercel.app';
    if (selectedProperties.length > 0) {
        contextData += 'USER-SELECTED CONTENT (Referenced in message):\n';
        selectedProperties.forEach((item, index) => {
            if (item.type === 'blog' || item.type === 'guide') {
                const link = `${BASE_URL}/${item.type === 'guide' ? 'user/guide' : 'blog'}/${item.slug || item.id}`;
                contextData += `${index + 1}. [${item.title}](${link}) [ARTICLE]\n`;
                contextData += `   Category: ${item.category || 'General'}\n`;
                contextData += `   Snippet: ${item.excerpt || item.content?.slice(0, 150) || 'Article content available'}\n`;
                contextData += '\n';
            } else {
                const link = `${BASE_URL}/listing/${item.id || item._id}`;
                const statusBadge = item.status === 'under_contract' ? ' [SALE-LOCKED]' : (item.status === 'rented' ? ' [RENT-LOCKED]' : '');
                const verificationBadge = item.isVerified ? ' (Verified ✓)' : ' (Pending Verification)';

                contextData += `${index + 1}. [${item.name}](${link})${statusBadge}${verificationBadge} [PROPERTY]\n`;
                contextData += `   Location: ${item.location}\n`;
                contextData += `   Price: ₹${item?.price?.toLocaleString() || 'N/A'} | Type: ${(item.type || '').toUpperCase()}\n`;
                contextData += `   Details: ${item.bedrooms || 0}BHK | ${item.bathrooms || 0} Bath | ${item.area || 0} sq ft\n`;
                if (item.esgRating) contextData += `   ESG: ${item.esgRating} (Score: ${item.esgScore})\n`;
                contextData += `   Description: ${item.description || 'Property details available'}\n`;
                contextData += '\n';
            }
        });
    }

    // Add relevant properties from cache
    const relevantProperties = searchCachedProperties(keywords.join(' '), 2);
    if (relevantProperties.length > 0) {
        contextData += 'RELEVANT PROPERTIES:\n';
        relevantProperties.forEach((prop, index) => {
            const link = `${BASE_URL}/listing/${prop.id}`;
            const statusBadge = prop.status === 'under_contract' ? ' [SALE-LOCKED]' : (prop.status === 'rented' ? ' [RENT-LOCKED]' : '');
            const verificationBadge = prop.isVerified ? ' (Verified ✓)' : ' (Pending Verification)';

            contextData += `${index + 1}. [${prop.name}](${link})${statusBadge}${verificationBadge}\n`;
            contextData += `   Location: ${prop.location}\n`;
            contextData += `   Price: ₹${prop.price.toLocaleString()} | Type: ${prop.type.toUpperCase()}\n`;
            contextData += `   Details: ${prop.bedrooms}BHK | ${prop.bathrooms} Bath | ${prop.area} sq ft\n`;
            contextData += `   Description: ${prop.description?.slice(0, 80)}...\n`;
            contextData += '\n';
        });
    }

    // Add relevant blogs from cache
    const relevantBlogs = cachedData.blogs.filter(blog =>
        keywords.some(keyword =>
            blog.title.toLowerCase().includes(keyword) ||
            blog.content.toLowerCase().includes(keyword) ||
            blog.tags.some(tag => tag.toLowerCase().includes(keyword))
        )
    ).slice(0, 2);

    if (relevantBlogs.length > 0) {
        contextData += 'ARTICLE SEARCH HINTS (Use "search_blogs_and_guides" tool to suggest these articles with visual cards):\n';
        relevantBlogs.forEach((blog, index) => {
            contextData += `${index + 1}. ${blog.title} [ID: ${blog.id}]\n`;
            contextData += `   ${blog.excerpt?.slice(0, 80)}...\n`;
            contextData += '\n';
        });
    }

    // Add relevant FAQs from cache
    const relevantFAQs = cachedData.faqs.filter(faq =>
        keywords.some(keyword =>
            faq.question.toLowerCase().includes(keyword) ||
            faq.answer.toLowerCase().includes(keyword) ||
            faq.tags.some(tag => tag.toLowerCase().includes(keyword))
        )
    ).slice(0, 2);

    if (relevantFAQs.length > 0) {
        contextData += 'FREQUENTLY ASKED QUESTIONS:\n';
        relevantFAQs.forEach((faq, index) => {
            contextData += `Q${index + 1}. ${faq.question}\n`;
            contextData += `A${index + 1}. ${faq.answer?.slice(0, 80)}...\n\n`;
        });
    }

    // Add relevant reviews from cache
    const relevantReviews = searchCachedReviews(keywords.join(' '), 2);
    if (relevantReviews.length > 0) {
        contextData += 'CUSTOMER REVIEWS:\n';
        relevantReviews.forEach((review, index) => {
            const link = review.listingId ? `${BASE_URL}/listing/${review.listingId}` : '#';
            contextData += `${index + 1}. ${review.listingName} (${review.listingLocation})\n`;
            contextData += `   Rating: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} (${review.rating}/5)\n`;
            contextData += `   Review: "${review.comment.slice(0, 80)}..."\n`;
            contextData += `   By: ${review.userName}${review.isVerified ? ' (Verified)' : ''}\n`;
            if (review.ownerResponse) {
                contextData += `   Owner Response: "${review.ownerResponse.slice(0, 80)}..."\n`;
            }
            contextData += `   Helpful: ${review.helpfulCount} | ${new Date(review.createdAt).toLocaleDateString()}\n\n`;
        });
    }

    // Add about content from cache
    const aboutContent = searchCachedAbout(keywords.join(' '), 1);
    if (aboutContent.length > 0) {
        const about = aboutContent[0];
        contextData += 'ABOUT URBANSETU:\n';
        contextData += `Mission: ${about.mission}\n`;
        contextData += `Trust: ${about.trust}\n`;
        if (about.features && about.features.length > 0) {
            contextData += `Key Features: ${about.features.join(', ')}\n`;
        }
        if (about.whoWeServe && about.whoWeServe.length > 0) {
            contextData += `Who We Serve: ${about.whoWeServe.join(', ')}\n`;
        }
        contextData += '\n';
    }

    // Add market insights from bookings
    const relevantBookings = searchCachedBookings(keywords.join(' '), 2);
    if (relevantBookings.length > 0) {
        contextData += 'MARKET INSIGHTS (Recent Bookings):\n';
        relevantBookings.forEach((booking, index) => {
            contextData += `${index + 1}. ${booking.propertyName} - ${booking.listingLocation}\n`;
            contextData += `   Purpose: ${booking.purpose} | Status: ${booking.status}\n`;
            contextData += `   Price: ₹${booking.listingPrice?.toLocaleString() || 'N/A'}\n`;
            contextData += `   Booked: ${new Date(booking.createdAt).toLocaleDateString()}\n\n`;
        });
    }

    return contextData;
};

/**
 * Extract keywords from user message
 */
const extractKeywords = (message) => {
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'];

    return message
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !commonWords.includes(word))
        .slice(0, 10);
};

/**
 * Check if data needs re-indexing
 */
export const needsReindexing = () => {
    if (!dataCache.lastSync) return true;

    // Re-index if data is older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return dataCache.lastSync < oneHourAgo;
};

/**
 * Get sync status
 */
export const getSyncStatus = () => {
    return {
        lastSync: dataCache.lastSync,
        totalProperties: dataCache.totalProperties,
        totalBlogs: dataCache.totalBlogs,
        totalFAQs: dataCache.totalFAQs,
        needsReindexing: needsReindexing()
    };
};

/**
 * Search cached reviews
 */
export const searchCachedReviews = (query, limit = 5) => {
    const keywords = extractKeywords(query);
    const reviews = Array.from(dataCache.reviews.values());

    const results = reviews.filter(review =>
        keywords.some(keyword =>
            review.comment.toLowerCase().includes(keyword) ||
            review.listingName?.toLowerCase().includes(keyword) ||
            review.listingLocation?.toLowerCase().includes(keyword) ||
            review.userName?.toLowerCase().includes(keyword) ||
            review.ownerResponse?.toLowerCase().includes(keyword)
        )
    ).sort((a, b) => b.helpfulCount - a.helpfulCount || new Date(b.createdAt) - new Date(a.createdAt));

    return results.slice(0, limit);
};

/**
 * Search cached about content
 */
export const searchCachedAbout = (query, limit = 1) => {
    const keywords = extractKeywords(query);
    const aboutContent = Array.from(dataCache.about.values());

    const results = aboutContent.filter(about =>
        keywords.some(keyword =>
            about.heroTitle?.toLowerCase().includes(keyword) ||
            about.heroText?.toLowerCase().includes(keyword) ||
            about.mission?.toLowerCase().includes(keyword) ||
            about.features?.some(feature => feature.toLowerCase().includes(keyword)) ||
            about.whoWeServe?.some(serve => serve.toLowerCase().includes(keyword)) ||
            about.trust?.toLowerCase().includes(keyword) ||
            about.team?.toLowerCase().includes(keyword) ||
            about.contact?.toLowerCase().includes(keyword)
        )
    );

    return results.slice(0, limit);
};

/**
 * Search cached contacts
 */
export const searchCachedContacts = (query, limit = 5) => {
    const keywords = extractKeywords(query);
    const contacts = Array.from(dataCache.contacts.values());

    const results = contacts.filter(contact =>
        keywords.some(keyword =>
            contact.subject?.toLowerCase().includes(keyword) ||
            contact.message?.toLowerCase().includes(keyword) ||
            contact.adminReply?.toLowerCase().includes(keyword) ||
            contact.email?.toLowerCase().includes(keyword)
        )
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return results.slice(0, limit);
};

/**
 * Search cached bookings
 */
export const searchCachedBookings = (query, limit = 5) => {
    const keywords = extractKeywords(query);
    const bookings = Array.from(dataCache.bookings.values());

    const results = bookings.filter(booking =>
        keywords.some(keyword =>
            booking.listingName?.toLowerCase().includes(keyword) ||
            booking.listingLocation?.toLowerCase().includes(keyword) ||
            booking.propertyName?.toLowerCase().includes(keyword) ||
            booking.propertyDescription?.toLowerCase().includes(keyword) ||
            booking.purpose?.toLowerCase().includes(keyword) ||
            booking.buyerName?.toLowerCase().includes(keyword) ||
            booking.sellerName?.toLowerCase().includes(keyword)
        )
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return results.slice(0, limit);
};

/**
 * Search cached users
 */
export const searchCachedUsers = (query, limit = 5) => {
    const keywords = extractKeywords(query);
    const users = Array.from(dataCache.users.values());

    const results = users.filter(user =>
        keywords.some(keyword =>
            user.username?.toLowerCase().includes(keyword) ||
            user.role?.toLowerCase().includes(keyword) ||
            user.gender?.toLowerCase().includes(keyword) ||
            user.address?.toLowerCase().includes(keyword)
        )
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return results.slice(0, limit);
};

/**
 * Force immediate sync (alias for indexAllWebsiteData)
 */
export const forceSync = async () => {
    return await indexAllWebsiteData();
};
