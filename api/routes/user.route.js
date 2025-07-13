import express from 'express'
import {test,updateUser,deleteUser,getUserListings,getUserByEmail,changePassword,getApprovedAdmins,transferDefaultAdminRights,deleteUserAfterTransfer,verifyPassword,getAllUsersForAutocomplete,getUserByEmailForAssignment,checkEmailAvailability,checkMobileAvailability} from '../controllers/user.controller.js'
import { verifyToken } from '../utils/verify.js'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import { errorHandler } from '../utils/error.js'

const router=express.Router()

router.get("/test",test)
router.post("/update/:id",verifyToken,updateUser)
router.delete("/delete/:id",verifyToken,deleteUser)
router.get("/listing/:id",verifyToken,getUserListings)
router.get("/email/:email",getUserByEmail)
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
router.post("/change-password/:id",verifyToken,changePassword)
router.post("/verify-password/:id",verifyToken,verifyPassword)

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
      process.env.JWT_SECRET
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

router.post("/google", async (req, res, next) => {
  const { email, name, googlePhotoUrl } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = jwt.sign(
        { id: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET
      );
      const { password, ...rest } = user._doc;
      res
        .status(200)
        .cookie("access_token", token)
        .json(rest);
    } else {
      const generatedPassword =
        Math.random().toString(36).slice(-8) +
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
        process.env.JWT_SECRET
      );
      const { password, ...rest } = newUser._doc;
      res
        .status(200)
        .cookie("access_token", token)
        .json(rest);
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

export default router