import express from 'express';
import PlatformUpdate from '../models/platformUpdate.model.js';
import User from '../models/user.model.js';
import { sendUpdateAnnouncementEmail } from '../utils/emailService.js';
import { verifyToken } from '../utils/verify.js';

const router = express.Router();

// Helper function for broadcasting updates to all active users
export const broadcastUpdate = (update) => {
    (async () => {
        try {
            console.log(`Starting update broadcast for: ${update.title}`);
            const Notification = (await import('../models/notification.model.js')).default;

            // Fetch all users with valid emails
            const users = await User.find({ status: 'active' }, 'email _id');

            console.log(`Found ${users.length} users to notify.`);

            // Create in-app notifications in bulk
            const inAppNotifications = users.map(user => ({
                userId: user._id,
                type: 'platform_update',
                title: update.title,
                message: update.description.substring(0, 150) + (update.description.length > 150 ? '...' : ''),
                meta: {
                    updateId: update._id,
                    version: update.version,
                    category: update.category
                }
            }));

            if (inAppNotifications.length > 0) {
                await Notification.insertMany(inAppNotifications);
            }

            for (const user of users) {
                if (user.email) {
                    try {
                        await sendUpdateAnnouncementEmail(user.email, update);
                    } catch (err) {
                        console.error(`Failed to send announcement to ${user.email}`, err);
                    }
                }
            }
            console.log(`Update broadcast completed for ${users.length} users.`);
        } catch (err) {
            console.error('Error in update broadcast:', err);
        }
    })();
};

// Helper function to auto-publish scheduled platform updates
export const publishScheduledUpdates = async () => {
    try {
        const now = new Date();
        // Find updates that are due for publication
        const scheduledUpdates = await PlatformUpdate.find({
            isActive: false,
            scheduledAt: { $lte: now, $ne: null }
        });

        if (scheduledUpdates.length > 0) {
            console.log(`Auto-publishing ${scheduledUpdates.length} scheduled platform updates...`);
            for (const update of scheduledUpdates) {
                // Atomic check to prevent race conditions
                const freshUpdate = await PlatformUpdate.findOneAndUpdate(
                    { _id: update._id, isActive: false },
                    {
                        $set: {
                            isActive: true,
                            publishedAt: update.scheduledAt || now,
                            scheduledAt: null
                        }
                    },
                    { new: true }
                );

                if (freshUpdate) {
                    console.log(`- Published platform update: "${freshUpdate.title}" (ID: ${freshUpdate._id})`);
                    broadcastUpdate(freshUpdate);
                }
            }
            console.log('Auto-publishing platform updates task completed.');
        }
    } catch (error) {
        console.error('Error in publishScheduledUpdates:', error);
    }
};

// Get all public updates
router.get('/public', async (req, res, next) => {
    try {
        // Auto-publish any due scheduled updates
        await publishScheduledUpdates();

        const { limit = 10, page = 1, category, search } = req.query;
        const query = { isActive: true };

        if (category) {
            query.category = category;
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { title: searchRegex },
                { version: searchRegex },
                { description: searchRegex },
                { tags: { $in: [searchRegex] } }
            ];
        }

        const updates = await PlatformUpdate.find(query)
            .sort({ releaseDate: -1, publishedAt: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await PlatformUpdate.countDocuments(query);

        // Check for any upcoming scheduled updates
        const now = new Date();
        const upcomingUpdates = await PlatformUpdate.find({
            isActive: false,
            scheduledAt: { $gt: now }
        })
            .sort({ scheduledAt: 1 })
            .select('title version category scheduledAt')
            .lean();

        res.status(200).json({
            success: true,
            data: updates,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                count: total
            },
            upcoming: upcomingUpdates
        });
    } catch (error) {
        next(error);
    }
});

// Create a new update (Admin only)
router.post('/', verifyToken, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const {
            title,
            version,
            description,
            category,
            tags,
            imageUrls,
            videoUrls,
            actionUrl,
            isActive,
            scheduledAt,
            releaseDate
        } = req.body;

        const isAct = isActive === true;
        const schedAt = (!isAct && scheduledAt) ? new Date(scheduledAt) : null;
        const pubAt = isAct ? new Date() : null;

        const newUpdate = new PlatformUpdate({
            title,
            version,
            description,
            category: category || 'new_feature',
            tags: tags || [],
            imageUrls: imageUrls || [],
            videoUrls: videoUrls || [],
            actionUrl: actionUrl || '',
            isActive: isAct,
            scheduledAt: schedAt,
            publishedAt: pubAt,
            releaseDate: releaseDate ? new Date(releaseDate) : (schedAt || new Date()),
            author: req.user.id
        });

        const savedUpdate = await newUpdate.save();

        // Send email broadcast immediately if active
        if (savedUpdate.isActive) {
            broadcastUpdate(savedUpdate);
        }

        res.status(201).json({ success: true, data: savedUpdate });
    } catch (error) {
        next(error);
    }
});

// Get all updates (Admin only)
router.get('/', verifyToken, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Auto-publish any due scheduled updates
        await publishScheduledUpdates();

        const updates = await PlatformUpdate.find()
            .sort({ releaseDate: -1, createdAt: -1 })
            .populate('author', 'username email role');

        res.status(200).json({ success: true, data: updates });
    } catch (error) {
        next(error);
    }
});

// Update an existing update (Admin only)
router.put('/:id', verifyToken, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const existingUpdate = await PlatformUpdate.findById(req.params.id);
        if (!existingUpdate) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }

        const wasActive = existingUpdate.isActive;
        const updateData = { ...req.body };

        if (updateData.isActive !== undefined) {
            if (updateData.isActive) {
                if (!existingUpdate.publishedAt && !updateData.publishedAt) {
                    updateData.publishedAt = new Date();
                }
                updateData.scheduledAt = null; // Clear scheduling if manually activated
            }
        }

        if (updateData.scheduledAt !== undefined) {
            updateData.scheduledAt = updateData.scheduledAt ? new Date(updateData.scheduledAt) : null;
            if (updateData.scheduledAt && updateData.isActive) {
                updateData.isActive = false; // Unpublish / set inactive if scheduled for future
                updateData.publishedAt = null;
            }
        }

        const updatedUpdate = await PlatformUpdate.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        // Send email broadcast if it was inactive before and is now active
        if (!wasActive && updatedUpdate.isActive) {
            console.log('Update activated! Triggering broadcast.');
            broadcastUpdate(updatedUpdate);
        }

        res.status(200).json({ success: true, data: updatedUpdate });
    } catch (error) {
        // If update failed, no email sent
        next(error);
    }
});

// Delete an update (Admin only)
router.delete('/:id', verifyToken, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const deletedUpdate = await PlatformUpdate.findByIdAndDelete(req.params.id);

        if (!deletedUpdate) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }

        res.status(200).json({ success: true, message: 'Update has been deleted' });
    } catch (error) {
        next(error);
    }
});

export default router;
