import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import { getAlerts, updateAlertStatus } from '../controllers/sentinel.controller.js';

const router = express.Router();

router.get('/alerts', verifyToken, getAlerts);
router.patch('/alerts/:id', verifyToken, updateAlertStatus);

export default router;
