import express from 'express'
import { test, updateUser, deleteUser, getUserListings, getUserSummary, getUserByEmail, changePassword, getApprovedAdmins, transferDefaultAdminRights, deleteUserAfterTransfer, verifyPassword, getAllUsersForAutocomplete, getUserByEmailForAssignment, checkEmailAvailability, checkMobileAvailability, exportData, searchUsers, downloadExportData, unsubscribeUser, toggleUserSubscription, submitUnsubscribeReason, verifyUnsubscribeToken } from '../controllers/user.controller.js'

import { verifyToken } from '../utils/verify.js'
import { dataExportRateLimit } from '../middleware/rateLimiter.js'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import DeletedAccount from '../models/deletedAccount.model.js'
import AccountRevocation from '../models/accountRevocation.model.js'
import { errorHandler } from '../utils/error.js'
import { calculateAndUpdateTrustScore } from '../utils/blockchainTrust.js'
import { validateRecaptcha } from '../middleware/recaptcha.js';

const router = express.Router()

router.get("/test", test)
router.post("/update/me", verifyToken, updateUser)
router.post("/update/:id", verifyToken, updateUser)
router.delete("/delete/:id", verifyToken, deleteUser)
router.get("/listing/:id", verifyToken, getUserListings)
router.get("/summary/:id", verifyToken, getUserSummary)
router.get("/email/:email", getUserByEmail)
router.get("/id/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
})
router.post("/change-password/:id", verifyToken, changePassword)
router.post("/verify-password/:id", verifyToken, verifyPassword)

router.post("/signup", async (req, res, next) => {
  const { username, email, password } = req.body;

  if (
    !username ||
    !email ||
    !password ||
    username === "" ||
    email === "" ||
    password === ""
  ) {
    next(errorHandler(400, "All fields are required"));
  }

  const hashedPassword = bcryptjs.hashSync(password, 10);

  const newUser = new User({
    username,
    email,
    password: hashedPassword,
  });

  try {
    await newUser.save();
    res.json("Signup successful");
  } catch (error) {
    next(error);
  }
});

router.post("/signin", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password || email === "" || password === "") {
    next(errorHandler(400, "All fields are required"));
  }

  try {
    const validUser = await User.findOne({ email });
    if (!validUser) {
      return next(errorHandler(404, "User not found"));
    }
    const validPassword = bcryptjs.compareSync(password, validUser.password);
    if (!validPassword) {
      return next(errorHandler(400, "Invalid password"));
    }
    const token = jwt.sign(
      { id: validUser._id, isAdmin: validUser.isAdmin },
      process.env.JWT_TOKEN
    );

    const { password: pass, ...rest } = validUser._doc;

    res
      .status(200)
      .cookie("access_token", token)
      .json(rest);
  } catch (error) {
    next(error);
  }
});

router.post("/google", validateRecaptcha({ required: false }), async (req, res, next) => {
  const { email, name, googlePhotoUrl, forceCreate } = req.body;
  const emailLower = email.toLowerCase();

  try {
    // Check if account is in grace period (deleted but not purged)
    const activeRevocation = await AccountRevocation.findOne({
      email: emailLower,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (activeRevocation && !forceCreate) {
      // Generate a temporary token for data export
      const conflictToken = jwt.sign(
        { email: emailLower, conflictId: activeRevocation._id, purpose: 'conflict_resolution' },
        process.env.JWT_TOKEN,
        { expiresIn: '1h' }
      );

      return res.status(409).json({
        deletedAccountFound: true,
        conflictToken,
        deletedAccountData: {
          username: activeRevocation.username,
          email: activeRevocation.email,
          role: activeRevocation.role,
          deletedAt: activeRevocation.deletedAt,
          expiresAt: activeRevocation.expiresAt,
          daysRemaining: Math.max(0, Math.ceil((new Date(activeRevocation.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
        }
      });
    }

    // If forceCreate is set, purge the old deleted account
    if (forceCreate) {
      const existingSoftban = await DeletedAccount.findOne({ email: emailLower });
      if (existingSoftban && !existingSoftban.purgedAt) {
        // Fetch revocation details before expiring them to use in the email
        const activeRevocationRecord = await AccountRevocation.findOne({
          email: emailLower,
          isUsed: false
        });

        existingSoftban.purgedAt = new Date();
        existingSoftban.purgedBy = 'google_signup_replacement';
        await existingSoftban.save();

        await AccountRevocation.updateMany(
          { email: emailLower, isUsed: false },
          { $set: { isUsed: true, usedAt: new Date(), restoredBy: 'expired_by_new_signup' } }
        );

        // Notify user of permanent purge
        try {
          const { sendPermanentPurgeEmail } = await import('../utils/emailService.js');
          await sendPermanentPurgeEmail(emailLower, activeRevocationRecord?.username || name, new Date());
        } catch (e) {
          console.error("Failed to send purge email:", e);
        }
      }
    }

    const user = await User.findOne({ email: emailLower });
    if (user) {
      const token = jwt.sign(
        { id: user._id, isAdmin: user.isAdmin },
        process.env.JWT_TOKEN
      );
      const { password, ...rest } = user._doc;
      res
        .status(200)
        .cookie("access_token", token)
        .json({ ...rest, mobileNumber: user.mobileNumber });
    } else {
      const generatedPassword =
        Math.random().toString(36).slice(-8);
      const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);
      // Generate a random unique mobile number for Google signup
      let mobileNumber;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loop
      while (!isUnique && attempts < maxAttempts) {
        // Generate a random 10-digit number starting with 9 (to avoid conflicts with real numbers)
        mobileNumber = "9" + Math.random().toString().slice(2, 11);
        // Check if this mobile number already exists
        const existingUser = await User.findOne({ mobileNumber });
        if (!existingUser) {
          isUnique = true;
        }
        attempts++;
      }
      // If we couldn't find a unique number after max attempts, use timestamp-based number
      if (!isUnique) {
        const timestamp = Date.now().toString();
        mobileNumber = "9" + timestamp.slice(-9);
      }
      const newUser = new User({
        username:
          name.toLowerCase().split(" ").join("") +
          Math.random().toString(9).slice(-4),
        email,
        password: hashedPassword,
        profilePicture: googlePhotoUrl,
        mobileNumber: mobileNumber,
      });
      await newUser.save();
      const token = jwt.sign(
        { id: newUser._id, isAdmin: newUser.isAdmin },
        process.env.JWT_TOKEN
      );
      const { password, ...rest } = newUser._doc;
      res
        .status(200)
        .cookie("access_token", token)
        .json({ ...rest, mobileNumber: newUser.mobileNumber });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/signout", (req, res, next) => {
  try {
    res
      .clearCookie("access_token")
      .status(200)
      .json("User has been logged out!");
  } catch (error) {
    next(error);
  }
});

// New routes for default admin functionality
router.get("/approved-admins/:currentUserId", verifyToken, getApprovedAdmins);
router.post("/transfer-default-admin", verifyToken, transferDefaultAdminRights);
router.delete("/delete-after-transfer/:id", verifyToken, deleteUserAfterTransfer);

// New routes for admin functionality
router.get("/all-users-autocomplete", verifyToken, getAllUsersForAutocomplete);
router.get("/validate-email/:email", verifyToken, getUserByEmailForAssignment);

// New routes for profile validation
router.get("/check-email/:email", verifyToken, checkEmailAvailability);
router.get("/check-mobile/:mobile", verifyToken, checkMobileAvailability);

// Data export route (with rate limiting: 1 export per 24 hours)
router.post("/export-data", verifyToken, dataExportRateLimit, exportData);

// Data export download route (no auth required - token-based access)
// Handles both /json and /txt via :type param
router.get("/export-data/:token/:type", downloadExportData);

// Count users
router.get('/count', async (req, res) => {
  try {
    const total = await User.countDocuments();
    res.json({ count: total });
  } catch (e) {
    res.status(500).json({ message: 'Failed to count users' });
  }
});


// Admin Search Route
router.get("/search", verifyToken, searchUsers);

// Unsubscribe routes
router.post("/unsubscribe", unsubscribeUser);
router.post("/verify-unsubscribe-token", verifyUnsubscribeToken);
router.post("/submit-unsubscribe-reason", submitUnsubscribeReason);
router.patch("/toggle-subscription/:id", verifyToken, toggleUserSubscription);

// Blockchain Wallet Routes
router.post("/link-wallet", verifyToken, async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return next(errorHandler(400, "Wallet address, signature and message are required"));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Update user blockchain data
    user.blockchain = {
      ...user.blockchain,
      walletAddress: walletAddress.toLowerCase(),
      network: 'polygon', // Default to polygon as per our plan
      linkedAt: new Date()
    };

    await user.save();

    // Dynamically calculate trust score
    const newTrustScore = await calculateAndUpdateTrustScore(user._id);

    // Re-fetch user to get updated trust score
    const updatedUser = await User.findById(user._id);

    const { password, ...rest } = updatedUser._doc;
    res.status(200).json({
      success: true,
      message: "Wallet linked and Trust Score calculated!",
      trustScore: newTrustScore,
      user: rest
    });
  } catch (error) {
    next(error);
  }
});

export default router