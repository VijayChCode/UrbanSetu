import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';

export const getSecurityIntelligenceStats = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user.id);
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
            return next(errorHandler(403, 'Access denied'));
        }

        // Aggregate installation IDs and their association with users
        const stats = await User.aggregate([
            { $unwind: "$settings.pushTokens" },
            { $match: { "settings.pushTokens.installationId": { $ne: null } } },
            {
                $group: {
                    _id: "$settings.pushTokens.installationId",
                    users: { $addToSet: { _id: "$_id", username: "$username", email: "$email" } },
                    devices: { $addToSet: "$settings.pushTokens.deviceName" },
                    lastUsed: { $max: "$settings.pushTokens.lastUsed" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    installationId: "$_id",
                    users: 1,
                    devices: 1,
                    lastUsed: 1,
                    userCount: { $size: "$users" },
                    _id: 0
                }
            },
            { $sort: { lastUsed: -1 } }
        ]);

        // Suspicious installations (Multiple users on same installation ID)
        const suspiciousInstallations = stats.filter(s => s.userCount > 1);

        // General stats
        const totalInstallations = stats.length;
        const multiUserInstallations = suspiciousInstallations.length;

        res.status(200).json({
            success: true,
            stats,
            summary: {
                totalInstallations,
                multiUserInstallations
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getInstallationDetails = async (req, res, next) => {
    try {
        const { installationId } = req.params;
        const currentUser = await User.findById(req.user.id);
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin')) {
            return next(errorHandler(403, 'Access denied'));
        }

        const users = await User.find({
            "settings.pushTokens.installationId": installationId
        }, {
            username: 1,
            email: 1,
            role: 1,
            avatar: 1,
            status: 1,
            "settings.pushTokens": 1
        });

        res.status(200).json({
            success: true,
            installationId,
            users: users.map(u => ({
                _id: u._id,
                username: u.username,
                email: u.email,
                role: u.role,
                avatar: u.avatar,
                status: u.status,
                tokens: u.settings.pushTokens.filter(t => t.installationId === installationId)
            }))
        });
    } catch (error) {
        next(error);
    }
};
