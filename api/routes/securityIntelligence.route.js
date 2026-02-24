import express from 'express';
import { verifyToken } from '../utils/verify.js';
import { getSecurityIntelligenceStats, getInstallationDetails } from '../controllers/securityIntelligence.controller.js';
import User from '../models/user.model.js';

const router = express.Router();

const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (user?.role === 'admin' || user?.role === 'rootadmin' || user?.isDefaultAdmin) {
            return next();
        }
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    } catch (error) {
        next(error);
    }
};

router.get('/stats', verifyToken, requireAdmin, getSecurityIntelligenceStats);
router.get('/installation/:installationId', verifyToken, requireAdmin, getInstallationDetails);

export default router;
