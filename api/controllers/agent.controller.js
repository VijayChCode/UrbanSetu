import Agent from "../models/agent.model.js";
import User from "../models/user.model.js";
import Review from "../models/review.model.js";
import { errorHandler } from "../utils/error.js";
import { sendAgentApprovalEmail, sendAgentRejectionEmail, sendAgentRevokedEmail } from "../utils/emailService.js";

// --- Public Endpoints ---

// Get all agents (Public) - supports search & filtering
export const getAgents = async (req, res, next) => {
    try {
        const { city, search, sort, limit = 20, page = 1 } = req.query;

        // Base query: Only approved agents
        const query = { status: "approved" };

        if (city) {
            query.city = { $regex: city, $options: "i" };
        }

        if (search) {
            // Regex search for Partial Matches on Name, Areas, Agency, etc.
            const searchRegex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i');
            query.$or = [
                { name: searchRegex },
                { areas: searchRegex },
                { agencyName: searchRegex },
                { about: searchRegex }
            ];
        }

        // Pagination
        const limitNum = parseInt(limit);
        const start = (parseInt(page) - 1) * limitNum;

        // Sorting
        let sortOptions = { createdAt: -1 }; // Default new
        if (sort === 'rating') sortOptions = { rating: -1 };
        if (sort === 'experience') sortOptions = { experience: -1 };

        const agents = await Agent.find(query)
            .sort(sortOptions)
            .limit(limitNum)
            .skip(start);

        const total = await Agent.countDocuments(query);

        res.status(200).json({
            agents,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        next(error);
    }
};

// Get single agent profile (Public)
export const getAgent = async (req, res, next) => {
    try {
        const { id } = req.params;
        // We might accept ID or UserID, but usually _id of Agent doc
        const agent = await Agent.findById(id)
            .populate('userId', 'username email avatar gender')
            .populate('processedBy', 'username email role avatar');

        if (!agent) return next(errorHandler(404, "Agent not found"));

        // Only show if approved or if the requester is the agent themselves or admin
        // (For public view, strictly approved)
        const isOwner = req.user && req.user.id === agent.userId._id.toString();
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'rootadmin');

        if (agent.status !== 'approved' && !isOwner && !isAdmin) {
            return next(errorHandler(403, "Agent profile is not currently active"));
        }

        res.status(200).json(agent);
    } catch (error) {
        next(error);
    }
};

// --- User Actions ---

// Apply to become an agent
export const applyAgent = async (req, res, next) => {
    try {
        const { name, mobileNumber, city, areas, experience, about, reraId, agencyName, photo, idProof } = req.body;

        // Check if user already has an application
        const existing = await Agent.findOne({ userId: req.user.id });
        if (existing) {
            if (existing.status === 'pending') return next(errorHandler(400, "You already have a pending application"));
            if (existing.status === 'approved') return next(errorHandler(400, "You are already a registered agent"));

            // If rejected, update existing application
            if (existing.status === 'rejected') {
                // Server-side Freeze Check
                if (existing.revokedAt) {
                    const daysPassed = Math.ceil(Math.abs(new Date() - new Date(existing.revokedAt)) / (1000 * 60 * 60 * 24));
                    if (daysPassed < 30) {
                        return next(errorHandler(403, `Your Agent Account was revoked. Please wait a cool-off period of ${30 - daysPassed} days before raising new application.`));
                    }
                }

                // Update fields
                existing.name = name;
                existing.mobileNumber = mobileNumber;
                existing.city = city;
                existing.areas = areas || [];
                existing.experience = parseInt(experience) || 0;
                existing.about = about;
                existing.reraId = reraId;
                existing.agencyName = agencyName;
                if (photo) existing.photo = photo;
                if (idProof) existing.idProof = idProof;

                existing.status = 'pending';
                existing.rejectionReason = undefined;
                existing.revokedAt = undefined; // Clear revocation history on new application? Or keep it?
                // Usually clear it so they aren't marked as revoked in pending state. 
                // However, history is good. But 'revokedAt' is used for Freeze check. If I clear it, freeze check passes next time. 
                // But status is now 'pending', so freeze check condition 'status===rejected && revokedAt' won't trigger anyway.
                // Keeping it might be confusing if they get rejected again (normal rejection) but revokedAt persists?
                // So I SHOULD clear it.

                await existing.save();
                return res.status(200).json(existing);
            }
        }

        const newAgent = new Agent({
            userId: req.user.id,
            email: req.user.email, // Auto-fill email from account
            name,
            mobileNumber,
            city,
            areas: areas || [],
            experience: parseInt(experience) || 0,
            about,
            reraId,
            agencyName,
            photo,
            idProof,
            status: 'pending'
        });

        await newAgent.save();
        res.status(201).json(newAgent);
    } catch (error) {
        next(error);
    }
};

// Check current user's agent status
export const checkMyAgentStatus = async (req, res, next) => {
    try {
        const agent = await Agent.findOne({ userId: req.user.id });
        if (!agent) {
            return res.status(200).json({ isAgent: false, status: null });
        }
        res.status(200).json({
            isAgent: true,
            status: agent.status,
            agentId: agent._id,
            agent
        });
    } catch (error) {
        next(error);
    }
}

// --- Admin Actions ---

// Get all agents (Admin)
export const getAllAgentsAdmin = async (req, res, next) => {
    try {
        // Admin wants to see all: pending, approved, rejected
        const agents = await Agent.find()
            .populate('userId', 'username email')
            .populate('processedBy', 'username email role avatar')
            .sort({ createdAt: -1 });
        res.status(200).json(agents);
    } catch (error) {
        next(error);
    }
};


// Update Agent Profile (Self)
export const updateAgentProfile = async (req, res, next) => {
    try {
        const agent = await Agent.findOne({ userId: req.user.id });
        if (!agent) return next(errorHandler(404, "Agent profile not found"));

        if (agent.status === 'rejected') {
            return next(errorHandler(403, "Cannot edit a rejected profile. Please contact support."));
        }

        const allowedFields = ['name', 'mobileNumber', 'city', 'areas', 'experience', 'about', 'reraId', 'agencyName', 'photo'];

        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) {
                agent[key] = req.body[key];
            }
        });

        // Ensure areas is array if string provided
        if (req.body.areas && typeof req.body.areas === 'string') {
            agent.areas = req.body.areas.split(',').map(a => a.trim()).filter(a => a);
        }

        await agent.save();
        res.status(200).json(agent);
    } catch (error) {
        next(error);
    }
};

// Update status (Approve/Reject)
export const updateAgentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return next(errorHandler(400, "Invalid status"));
        }

        const agent = await Agent.findById(id);
        if (!agent) return next(errorHandler(404, "Agent not found"));

        const previousStatus = agent.status;

        agent.status = status;
        agent.processedBy = req.user._id || req.user.id;
        agent.processedAt = new Date();

        if (status === 'rejected') {
            if (rejectionReason) agent.rejectionReason = rejectionReason;
            // Set revokedAt if specifically revoked (previously approved), else null
            agent.revokedAt = previousStatus === 'approved' ? new Date() : null;
        }
        if (status === 'approved') {
            agent.isVerified = true;
            agent.revokedAt = null; // Clear if approved
        }

        await agent.save();

        // Send automated emails
        try {
            if (status === 'approved') {
                await sendAgentApprovalEmail(agent.email, agent.name);
            } else if (status === 'rejected') {
                if (previousStatus === 'approved') {
                    // Revocation
                    await sendAgentRevokedEmail(agent.email, agent.name, rejectionReason);
                } else {
                    // Application Rejection
                    await sendAgentRejectionEmail(agent.email, agent.name, rejectionReason);
                }
            }
        } catch (emailError) {
            console.error('Failed to send agent status email:', emailError);
            // Don't fail the request if email fails
        }

        const populatedAgent = await Agent.findById(agent._id)
            .populate('userId', 'username email')
            .populate('processedBy', 'username email role avatar');

        res.status(200).json(populatedAgent);
    } catch (error) {
        next(error);
    }
};

// Delete agent (Admin)
export const deleteAgent = async (req, res, next) => {
    try {
        await Agent.findByIdAndDelete(req.params.id);
        res.status(200).json("Agent deleted successfully");
    } catch (error) {
        next(error);
    }
}


// --- Reviews ---

export const createAgentReview = async (req, res, next) => {
    try {
        const { rating, comment } = req.body;
        const agentId = req.params.id;
        const userId = req.user.id;

        const agent = await Agent.findById(agentId);
        if (!agent) return next(errorHandler(404, "Agent not found"));
        if (agent.userId.toString() === userId) return next(errorHandler(400, "You cannot review yourself"));

        const existing = await Review.findOne({ agentId, userId });
        if (existing) return next(errorHandler(400, "You have already reviewed this agent"));

        const reviewer = await User.findById(userId);

        const newReview = new Review({
            agentId,
            userId,
            rating,
            comment,
            userName: reviewer.username,
            userAvatar: reviewer.avatar,
            status: 'approved'
        });

        await newReview.save();

        const reviews = await Review.find({ agentId, status: 'approved' });
        const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

        agent.rating = avg;
        agent.reviewCount = reviews.length;
        await agent.save();

        res.status(201).json(newReview);
    } catch (error) {
        next(error);
    }
};

export const getAgentReviews = async (req, res, next) => {
    try {
        const reviews = await Review.find({ agentId: req.params.id }).sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (error) {
        next(error);
    }
};

export const updateAgentReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return next(errorHandler(404, "Review not found"));

        if (review.userId.toString() !== req.user.id) return next(errorHandler(403, "You can only update your own review"));

        const { rating, comment } = req.body;
        if (rating) review.rating = rating;
        if (comment) review.comment = comment;

        await review.save();

        // Recalculate stats
        const agent = await Agent.findById(review.agentId);
        if (agent) {
            const reviews = await Review.find({ agentId: review.agentId, status: 'approved' });
            const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
            agent.rating = avg;
            await agent.save();
        }

        res.status(200).json(review);
    } catch (error) {
        next(error);
    }
};

export const deleteAgentReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return next(errorHandler(404, "Review not found"));

        const isAdmin = req.user.role === 'admin' || req.user.role === 'rootadmin';
        const isOwner = review.userId.toString() === req.user.id;

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "You are not allowed to delete this review"));
        }

        const agentId = review.agentId;
        await Review.findByIdAndDelete(req.params.reviewId);

        if (agentId) {
            const agent = await Agent.findById(agentId);
            if (agent) {
                const reviews = await Review.find({ agentId, status: 'approved' });
                const avg = reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0;
                agent.rating = avg;
                agent.reviewCount = reviews.length;
                await agent.save();
            }
        }
        res.status(200).json("Review deleted");
    } catch (error) {
        next(error);
    }
};
