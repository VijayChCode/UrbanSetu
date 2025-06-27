import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import userRouter from './routes/user.route.js'
import authRouter from './routes/auth.route.js'
import listingRouter from './routes/listing.route.js'
import bookingRouter from "./routes/booking.route.js";
import aboutRouter from "./routes/about.route.js";
import adminRouter from "./routes/admin.route.js";
import contactRouter from "./routes/contact.route.js";
import wishlistRouter from "./routes/wishlist.route.js";

import cookieParser from 'cookie-parser';
import path from 'path'
import User from './models/user.model.js';
import bcryptjs from 'bcryptjs';

dotenv.config();

console.log("MongoDB URI:", process.env.MONGO);

if (!process.env.MONGO) {
    console.error("Error: MONGO URI is not defined in .env file!");
    process.exit(1);
}

// MongoDB connection options (cleaned)
const mongoOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority',
};

// Function to connect to MongoDB with retry logic (minimal logs)
const connectToMongoDB = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await mongoose.connect(process.env.MONGO, mongoOptions);
            console.log("Connected to MongoDB!");
            return;
        } catch (error) {
            if (i === retries - 1) {
                console.error("Failed to connect to MongoDB:", error.message);
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

// Connect to MongoDB
connectToMongoDB();

const __dirname=path.resolve();

let PORT = process.env.PORT || 3000;

const app = express();

// CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json())
app.use(cookieParser())

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}!!!`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is busy, trying ${PORT + 1}...`);
      PORT++;
      startServer();
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer();

app.use("/api/user",userRouter);
app.use("/api/auth",authRouter);
app.use("/api/listing",listingRouter)
app.use("/api/bookings", bookingRouter);
app.use("/api/about", aboutRouter);
app.use("/api/admin", adminRouter);
app.use("/api/contact", contactRouter);
app.use("/api/wishlist", wishlistRouter);

app.use(express.static(path.join(__dirname,'/client/dist')))

app.get('*',(req,res,next)=>{
    res.sendFile(path.join(__dirname,'client','dist','index.html'))
})
app.use((err,req,res,next)=>{
    const statusCode=err.statusCode||500;
    const message=err.message||"internal server error"
    return res.status(statusCode).json({
        success:false,
        statusCode,
        message
    });
});
