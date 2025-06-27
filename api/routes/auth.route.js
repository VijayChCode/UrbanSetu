import express from 'express'
import { SignUp,SignIn,Google,Signout,verifyAuth,forgotPassword,resetPassword} from '../controllers/auth.controller.js'
const router=express.Router()

router.post("/signup",SignUp)
router.post("/signin",SignIn)
router.post("/google",Google)
router.get("/signout",Signout)
router.get("/verify",verifyAuth)
router.post("/forgot-password",forgotPassword)
router.post("/reset-password",resetPassword)
export default router