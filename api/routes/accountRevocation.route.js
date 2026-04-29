import express from 'express';
import { 
  createRevocationToken, 
  verifyRevocationToken, 
  restoreAccount, 
  getRevocationStatus,
  restoreForSignup,
  exportDeletedData
} from '../controllers/accountRevocation.controller.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/export-deleted-data', exportDeletedData);
router.get('/verify-revocation-token/:token', verifyRevocationToken);
router.post('/restore-account', restoreAccount);
router.post('/restore-for-signup', restoreForSignup);

// Admin routes (authentication required)
router.post('/create-token', createRevocationToken);
router.get('/status/:email', getRevocationStatus);

export default router;
