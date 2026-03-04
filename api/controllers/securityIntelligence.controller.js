import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';

export const getSecurityIntelligenceStats = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user.id);
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && !currentUser.isDefaultAdmin)) {
            return next(errorHandler(403, 'Access denied'));
        }

        // Aggregate installation IDs and their association with users
        // We use $facet to get both installation-based stats and general device usage
        const statsAggregation = await User.aggregate([
            { $unwind: { path: "$settings.pushTokens", preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: { $ifNull: ["$settings.pushTokens.installationId", "$settings.pushTokens.deviceName"] },
                    installationId: { $first: { $ifNull: ["$settings.pushTokens.installationId", "unknown_device"] } },
                    users: { $addToSet: { _id: "$_id", username: "$username", email: "$email" } },
                    devices: { $addToSet: "$settings.pushTokens.deviceName" },
                    lastUsed: { $max: "$settings.pushTokens.lastUsed" }
                }
            },
            {
                $project: {
                    deviceKey: "$_id",
                    installationId: 1,
                    users: 1,
                    devices: 1,
                    lastUsed: 1,
                    userCount: { $size: "$users" },
                    _id: 0
                }
            },
            { $sort: { lastUsed: -1 } }
        ]);

        const stats = statsAggregation;

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
            $or: [
                { "settings.pushTokens.installationId": installationId },
                { "settings.pushTokens.deviceName": installationId }
            ]
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
                tokens: u.settings.pushTokens.filter(t => t.installationId === installationId || t.deviceName === installationId)
            }))
        });
    } catch (error) {
        next(error);
    }
};
