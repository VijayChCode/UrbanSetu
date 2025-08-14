import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { errorHandler } from "../utils/error.js";
import jwt from 'jsonwebtoken'

export const SignUp=async (req,res,next)=>{
    const {username,email,password,role,mobileNumber,address,emailVerified}=req.body;
    const emailLower = email.toLowerCase();
    
    // Validate mobile number
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        return next(errorHandler(400, "Please provide a valid 10-digit mobile number"));
    }
    
    // Validate address (optional but if provided, should not be empty)
    if (address && address.trim().length === 0) {
        return next(errorHandler(400, "Please provide a valid address"));
    }
    
    // Check if email is verified
    if (!emailVerified) {
        return next(errorHandler(400, "Please verify your email address before creating an account"));
    }
    
    try {
        // Check if email already exists
        const existingEmail = await User.findOne({ email: emailLower });
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
            email: emailLower,
            password:hashedPassword,
            mobileNumber,
            address: address ? address.trim() : undefined,
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
       console.error(error);
       next(error)
    }
}

export const SignIn=async(req,res,next)=>{
    const {email,password}=req.body 
    const emailLower = email.toLowerCase();
    try{
        const validUser=await User.findOne({email: emailLower})
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
        res.cookie('access_token',token,{
            httpOnly:true,
            sameSite: 'none',
            secure: true,
            path: '/'
        }).status(200).json({
            _id: validUser._id,
            username: validUser.username,
            email: validUser.email,
            role: validUser.role,
            isDefaultAdmin: validUser.isDefaultAdmin,
            adminApprovalStatus: validUser.adminApprovalStatus,
            status: validUser.status,
            avatar: validUser.avatar,
            mobileNumber: validUser.mobileNumber,
            address: validUser.address,
            gender: validUser.gender,
            token,
        });
    }
    catch(error){
        console.error(error);
        next(error)
    }
}

export const Google=async (req,res,next)=>{
    try{
        const {name,email,photo}=req.body 
        const validUser=await User.findOne({email})
        if (validUser){
            // Suspension check
            if (validUser.status === 'suspended') {
                return next(errorHandler(403, "Your account is suspended. Please contact support."));
            }
            const token=jwt.sign({id:validUser._id},process.env.JWT_TOKEN)
            res.cookie('access_token',token,{
                httpOnly:true,
                sameSite: 'none',
                secure: true,
                path: '/'
            }).status(200).json({
                _id: validUser._id,
                username: validUser.username,
                email: validUser.email,
                role: validUser.role,
                isDefaultAdmin: validUser.isDefaultAdmin,
                adminApprovalStatus: validUser.adminApprovalStatus,
                status: validUser.status,
                avatar: validUser.avatar,
                mobileNumber: validUser.mobileNumber,
                address: validUser.address,
                gender: validUser.gender,
                token,
            });
        }
        else{
            const generatedPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcryptjs.hashSync(generatedPassword,10);
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
            const newUser=new User({
                username:name.split(" ").join("").toLowerCase()+Math.random().toString(36).slice(-8),
                email,
                password:hashedPassword,
                avatar:photo,
                mobileNumber: mobileNumber,
                isGeneratedMobile: true
            })
            await newUser.save()
            const token=jwt.sign({id:newUser._id},process.env.JWT_TOKEN)
            res.cookie('access_token',token,{
                httpOnly:true,
                sameSite: 'none',
                secure: true,
                path: '/'
            }).status(200).json({
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                isDefaultAdmin: newUser.isDefaultAdmin,
                adminApprovalStatus: newUser.adminApprovalStatus,
                status: newUser.status,
                avatar: newUser.avatar,
                mobileNumber: newUser.mobileNumber,
                isGeneratedMobile: newUser.isGeneratedMobile,
                address: newUser.address,
                gender: newUser.gender,
                token,
            });
        }
    }
    catch(error){
        console.error(error);
        next(error)
    }
}


export const Signout = async (req, res, next) => {
    try {
      res.clearCookie('access_token', {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/'
      });
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
        res.cookie('access_token', token, {
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            path: '/'
        });
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

// Forgot Password - Verify email only (mobile number verification removed)
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }
        
        const emailLower = email.toLowerCase();
        // Find user with matching email
        const user = await User.findOne({ email: emailLower });
        
        if (!user) {
            return next(errorHandler(404, "No account found with that email."));
        }
        
        res.status(200).json({ 
            message: "User found. Please proceed with OTP verification.",
            success: true
        });
    } catch (error) {
        next(error);
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    try {
        const { userId, newPassword, confirmPassword } = req.body;
        
        if (!userId || !newPassword || !confirmPassword) {
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
        
        // Find user by ID
        const user = await User.findById(userId);
        
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }
        
        // Update password
        user.password = bcryptjs.hashSync(newPassword, 10);
        await user.save();
        
        res.status(200).json({ 
            message: "Password reset successful. You can now log in.",
            success: true
        });
    } catch (error) {
        next(error);
    }
};