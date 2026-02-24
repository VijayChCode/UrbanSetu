import express from 'express';
import PlatformUpdate from '../models/platformUpdate.model.js';
import User from '../models/user.model.js';
import { sendUpdateAnnouncementEmail } from '../utils/emailService.js';
import { verifyToken } from '../utils/verify.js'; // Assuming you have verifyToken middleware

const router = express.Router();

// Get all public updates
router.get('/public', async (req, res, next) => {
    try {
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
            .sort({ releaseDate: -1 }) // Newest first
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await PlatformUpdate.countDocuments(query);

        res.status(200).json({
            success: true,
            data: updates,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                count: total
            }
        });
    } catch (error) {
        next(error);
    }
});

// Helper function for broadcasting updates
const broadcastUpdate = (update) => {
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


// Create a new update (Admin only)
router.post('/', verifyToken, async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const newUpdate = new PlatformUpdate({
            ...req.body,
            author: req.user.id
        });

        const savedUpdate = await newUpdate.save();

        // Send email broadcast if active
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

        const updates = await PlatformUpdate.find()
            .sort({ releaseDate: -1 })
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

        const updatedUpdate = await PlatformUpdate.findByIdAndUpdate(
            req.params.id,
            { ...req.body },
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
