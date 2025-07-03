import express from 'express'
import { SignUp,SignIn,Google,Signout,verifyAuth,forgotPassword,resetPassword} from '../controllers/auth.controller.js'
import bcryptjs from 'bcryptjs';
import User from '../models/user.model.js';
import { verifyToken } from '../utils/verify.js';
const router=express.Router()

router.post("/signup",SignUp)
router.post("/signin",SignIn)
router.post("/google",Google)
router.get("/signout",Signout)
router.get("/verify",verifyAuth)
router.post("/forgot-password",forgotPassword)
router.post("/reset-password",resetPassword)

// POST /api/auth/verify-password
router.post('/verify-password', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isMatch = await bcryptjs.compare(password, user.password);
    if (isMatch) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router