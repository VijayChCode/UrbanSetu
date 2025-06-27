import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { errorHandler } from "../utils/error.js";
import jwt from 'jsonwebtoken'

export const SignUp=async (req,res,next)=>{
    const {username,email,password,role,mobileNumber}=req.body;
    
    // Validate mobile number
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        return next(errorHandler(400, "Please provide a valid 10-digit mobile number"));
    }
    
    try {
        // Check if email already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return next(errorHandler(400, "An account with this email already exists. Please sign in instead!"));
        }
        
        // Check if mobile number already exists
        const existingMobile = await User.findOne({ mobileNumber });
        if (existingMobile) {
            return next(errorHandler(400, "An account with this mobile number already exists. Try signing in or use a different number."));
        }
        
        const hashedPassword=bcryptjs.hashSync(password,10)
        
        // Set admin approval status based on role
        const adminApprovalStatus = role === "admin" ? "pending" : "approved";
        
        const newUser=new User({
            username,
            email,
            password:hashedPassword,
            mobileNumber,
            role,
            adminApprovalStatus
        })
        
        await newUser.save();
        
        if (role === "admin") {
            res.status(201).json({
                message: "Admin account created successfully. Please wait for approval from an existing admin.",
                requiresApproval: true
            });
        } else {
            res.status(201).json({
                message: "User added successfully",
                requiresApproval: false
            });
        }
    }
    catch(error){ 
       next(error)
    }
}

export const SignIn=async(req,res,next)=>{
    const {email,password}=req.body 
    try{
        const validUser=await User.findOne({email})
        if (!validUser){
            return next(errorHandler(404,"user not found"))
        }
        if (validUser.status === 'suspended') {
            return next(errorHandler(403, "Your account is suspended. Please contact support."));
        }
        const validPassword=await bcryptjs.compareSync(password,validUser.password)
        if (!validPassword){
            return next(errorHandler(401,"Wrong Credentials"))
        }
        
        // Check if admin account is pending approval
        if (validUser.role === "admin" && validUser.adminApprovalStatus === "pending") {
            return next(errorHandler(403, "Your admin account is pending approval. Please wait for an existing admin to approve your request."));
        }
        
        // Check if admin account was rejected
        if (validUser.role === "admin" && validUser.adminApprovalStatus === "rejected") {
            return next(errorHandler(403, "Your admin account request has been rejected. Please contact support for more information."));
        }
        
        const token=jwt.sign({id:validUser._id},process.env.JWT_TOKEN)

        // Return only the necessary fields
        res.cookie('access_token',token,{httpOnly:true}).status(200).json({
            _id: validUser._id,
            username: validUser.username,
            email: validUser.email,
            role: validUser.role,
            isDefaultAdmin: validUser.isDefaultAdmin,
            adminApprovalStatus: validUser.adminApprovalStatus,
            status: validUser.status,
            avatar: validUser.avatar,
            // add any other fields you need on the frontend
        });
    }
    catch(error){
        next(error)
    }
}

export const Google=async (req,res,next)=>{
    try{
        const {name,email,photo}=req.body 
        const validUser=await User.findOne({email})
        if (validUser){
            const token=jwt.sign({id:validUser._id},process.env.JWT_TOKEN)
            res.cookie('access_token',token,{httpOnly:true}).status(200).json(validUser)
        }
        else{
            const generatedPassword=Math.random().toString(36).slice(-8)
            const hashedPassword=await bcryptjs.hashSync(generatedPassword,10);
            const newUser=new User({
                username:name.split(" ").join("").toLowerCase()+Math.random().toString(36).slice(-8),
                email,
                password:hashedPassword,
                avatar:photo,
                mobileNumber: "0000000000" // Default mobile number for Google signup
            })
            await newUser.save()
            const token=jwt.sign({id:newUser._id},process.env.JWT_TOKEN)
            res.cookie('access_token',token,{httpOnly:true}).status(200).json(newUser)

        }

    }
    catch(error){
        next(error)
    }
}


export const Signout = async (req, res, next) => {
    try {
      res.clearCookie('access_token');
      res.status(200).json('User has been logged out!');
    } catch (error) {
      next(error);
    }
  };

export const verifyAuth = async (req, res, next) => {
    try {
        const token = req.cookies.access_token;
        
        if (!token) {
            return next(errorHandler(401, "Access token not found"));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_TOKEN);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        res.status(200).json(user);
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(errorHandler(401, "Invalid token"));
        }
        if (error.name === 'TokenExpiredError') {
            return next(errorHandler(401, "Token expired"));
        }
        next(error);
    }
};

// Forgot Password - Verify email and mobile number
export const forgotPassword = async (req, res, next) => {
    try {
        const { email, mobileNumber } = req.body;
        
        if (!email || !mobileNumber) {
            return next(errorHandler(400, "Both email and mobile number are required"));
        }
        
        // Find user with matching email and mobile number
        const user = await User.findOne({ email, mobileNumber });
        
        if (!user) {
            return next(errorHandler(404, "No account found with that email and mobile number."));
        }
        
        // Generate a simple reset token (in production, you'd want a more secure token)
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Store reset token in user document (you might want to add a resetToken field to the schema)
        user.resetToken = resetToken;
        user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour expiry
        await user.save();
        
        res.status(200).json({ 
            message: "Verification successful. You can now reset your password.",
            resetToken: resetToken // In production, send this via email/SMS
        });
    } catch (error) {
        next(error);
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;
        
        if (!resetToken || !newPassword || !confirmPassword) {
            return next(errorHandler(400, "All fields are required"));
        }
        
        if (newPassword !== confirmPassword) {
            return next(errorHandler(400, "Passwords do not match"));
        }
        
        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return next(errorHandler(400, "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"));
        }
        
        // Find user with valid reset token
        const user = await User.findOne({ 
            resetToken: resetToken,
            resetTokenExpiry: { $gt: new Date() }
        });
        
        if (!user) {
            return next(errorHandler(400, "Invalid or expired reset token"));
        }
        
        // Update password and clear reset token
        user.password = bcryptjs.hashSync(newPassword, 10);
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        
        res.status(200).json({ message: "Password reset successful. You can now log in." });
    } catch (error) {
        next(error);
    }
};