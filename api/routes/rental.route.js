import express from "express";
import { verifyToken } from '../utils/verify.js';
import {
  createContract,
  getContract,
  listContracts,
  signContract,
  getWallet,
  updateAutoDebit,
  downloadContractPDF,
  createMoveInOutChecklist,
  getMoveInOutChecklist,
  listAllChecklists,
  deleteChecklist,
  updateMoveInCondition,
  approveMoveInOutChecklist,
  updateMoveOutCondition,
  assessDamages,
  createDispute,
  getDispute,
  listDisputes,
  updateDisputeStatus,
  addDisputeComment,
  resolveDispute,
  requestVerification,
  getVerificationStatus,
  approveVerification,
  rejectVerification,
  listAllVerifications,
  submitRentalRating,
  getRentalRating,
  listRentalRatings,
  getPropertyRatings,
  applyForRentalLoan,
  getRentalLoan,
  listRentalLoans,
  approveRentalLoan,
  rejectRentalLoan,
  disburseRentalLoan,
  generateRentPrediction,
  getRentPrediction,
  getLocalityScore,
  listAllRatings,
  listAllContracts,
  updateContractStatus,
  getRentalLoanDocument,
  getPublicRentalLoanDocument,
  proxyDocumentDownload,
  sendLegalNotice,
  writeOffLoan,
  blockLoanUser,
  addContractClause
} from '../controllers/rental.controller.js';
import { draftLegalClause } from '../controllers/legalAssistant.controller.js';

const router = express.Router();

// Rent-Lock Contract Routes
router.post("/contracts/create", verifyToken, createContract);
router.post("/contracts/draft-clause", verifyToken, draftLegalClause); // AI Legal Assistant
router.get("/contracts", verifyToken, listContracts);
router.get("/contracts/all", verifyToken, listAllContracts); // Admin: List all contracts
router.get("/contracts/:contractId", verifyToken, getContract);
router.post("/contracts/:contractId/sign", verifyToken, signContract);
router.put("/contracts/:contractId/status", verifyToken, updateContractStatus); // Admin: Update contract status
router.get("/contracts/:contractId/download", verifyToken, downloadContractPDF);
router.post("/contracts/:contractId/add-clause", verifyToken, addContractClause); // Append AI-drafted clause to contract

// Rent Wallet Routes
router.get("/wallet/:contractId", verifyToken, getWallet);
router.put("/wallet/:contractId/auto-debit", verifyToken, updateAutoDebit);

// Payment Reminder Routes (can be called by cron job or manually)
router.post("/reminders/send", verifyToken, async (req, res, next) => {
  try {
    // Only allow admin or cron job (with secret key) to trigger reminders
    if (req.user.role !== 'admin' && req.body.secretKey !== process.env.CRON_SECRET_KEY) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const { sendPaymentReminders } = await import('../controllers/rental.controller.js');
    const result = await sendPaymentReminders();

    res.json({
      success: true,
      message: "Payment reminders sent",
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// Move-In/Move-Out Checklist Routes
router.get("/checklist/all", verifyToken, listAllChecklists); // Admin: List all checklists (must come before :contractId)
router.post("/checklist/:contractId", verifyToken, createMoveInOutChecklist);
router.get("/checklist/:contractId", verifyToken, getMoveInOutChecklist);
router.put("/checklist/move-in/:checklistId", verifyToken, updateMoveInCondition);
router.post("/checklist/:checklistId/approve", verifyToken, approveMoveInOutChecklist);
router.put("/checklist/move-out/:checklistId", verifyToken, updateMoveOutCondition);
router.post("/checklist/:contractId/assess-damages", verifyToken, assessDamages);
router.delete("/checklist/:checklistId", verifyToken, deleteChecklist); // Admin: Delete checklist

// Dispute Resolution Routes
router.post("/disputes/:contractId", verifyToken, createDispute);
router.get("/disputes", verifyToken, listDisputes);
router.get("/disputes/:disputeId", verifyToken, getDispute);
router.put("/disputes/:disputeId/status", verifyToken, updateDisputeStatus);
router.post("/disputes/:disputeId/comments", verifyToken, addDisputeComment);
router.post("/disputes/:disputeId/resolve", verifyToken, resolveDispute);

// Property Verification Routes
router.post("/verification/:listingId", verifyToken, requestVerification);
router.get("/verification/:listingId", verifyToken, getVerificationStatus);
router.get("/verification", verifyToken, listAllVerifications); // Admin: List all verifications
router.post("/verification/:verificationId/approve", verifyToken, approveVerification);
router.post("/verification/:verificationId/reject", verifyToken, rejectVerification);

// Rental Ratings Routes
// IMPORTANT: More specific routes must come before parameterized routes
router.post("/ratings/:contractId", verifyToken, submitRentalRating);
router.get("/ratings/all", verifyToken, listAllRatings); // Admin: List all ratings - must come before :contractId
router.get("/ratings/property/:listingId", getPropertyRatings); // Public endpoint - must come before :contractId
router.get("/ratings/:contractId", verifyToken, getRentalRating);
router.get("/ratings", verifyToken, listRentalRatings);

// Rental Loans Routes
router.get("/public/documents/:documentId", getPublicRentalLoanDocument);
router.get("/public/documents/:documentId/download", proxyDocumentDownload);
router.post("/loans/:contractId", verifyToken, applyForRentalLoan);
router.get("/loans/documents/:documentId/download", verifyToken, proxyDocumentDownload);
router.get("/loans/documents/:documentId", verifyToken, getRentalLoanDocument);
router.get("/loans/:loanId", verifyToken, getRentalLoan);
router.get("/loans", verifyToken, listRentalLoans);
// ... existing code ...
router.post("/loans/:loanId/approve", verifyToken, approveRentalLoan);
router.post("/loans/:loanId/reject", verifyToken, rejectRentalLoan);
router.post("/loans/:loanId/disburse", verifyToken, disburseRentalLoan);

// Default Loan Actions
router.post("/loans/:loanId/send-legal-notice", verifyToken, sendLegalNotice);
router.post("/loans/:loanId/write-off", verifyToken, writeOffLoan);
router.post("/loans/:loanId/block-user", verifyToken, blockLoanUser);

// AI Rent Prediction & Locality Score Routes
router.post("/predictions/:listingId", verifyToken, generateRentPrediction);
router.get("/predictions/:listingId", getRentPrediction); // Public endpoint
router.get("/locality-score/:listingId", getLocalityScore); // Public endpoint

export default router;

