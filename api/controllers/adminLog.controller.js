import AdminLog from "../models/adminLog.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * Get system-wide admin audit logs (paginated)
 */
export const getAdminLogs = async (req, res, next) => {
    try {
        // Only rootadmin and approved admins can access audit logs
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden - Admin access required'));
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { type, adminId, startDate, endDate, search } = req.query;

        const query = {};

        if (type && type !== 'all') {
            query.type = type;
        }

        if (adminId) {
            query.adminId = adminId;
        } else if (req.query.systemOnly === 'true') {
            query.ip = 'SYSTEM';
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                { action: { $regex: search, $options: 'i' } },
                { 'metadata.email': { $regex: search, $options: 'i' } },
                { 'metadata.targetId': { $regex: search, $options: 'i' } }
            ];
        }

        const logs = await AdminLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('adminId', 'username email role');

        const total = await AdminLog.countDocuments(query);

        res.status(200).json({
            success: true,
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get distinct log types for filtering
 */
export const getLogTypes = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
            return next(errorHandler(403, 'Forbidden'));
        }

        const types = await AdminLog.distinct('type');
        res.status(200).json({ success: true, types });
    } catch (error) {
        next(error);
    }
};
