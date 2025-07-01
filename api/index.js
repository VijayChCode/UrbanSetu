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
import notificationRouter from "./routes/notification.route.js";
import reviewRouter from "./routes/review.route.js";
import cors from 'cors';
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

app.use(express.json())
app.use(cookieParser());

const allowedOrigins = [
    'https://urbansetu.vercel.app',
    'https://urbansetu-vijaychcode.vercel.app',
    'http://localhost:5173', // for local development
];

app.use(cors({
    origin: function(origin, callback) {
        // allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'UrbanSetu API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      user: '/api/user',
      listing: '/api/listing',
      bookings: '/api/bookings',
      admin: '/api/admin',
      contact: '/api/contact',
      wishlist: '/api/wishlist',
      about: '/api/about'
    }
  });
});

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
app.use("/api/notifications", notificationRouter);
app.use("/api/review", reviewRouter);

// Global error handler (should be after all routes)
app.use((err, req, res, next) => {
  // Suppress stack trace for expected 401 errors
  if (err.status === 401 || err.statusCode === 401 || err.message === 'Access token not found') {
    // Log as info, not error
    console.info(`[401] ${err.message}`);
    return res.status(401).json({ success: false, message: err.message || 'Unauthorized' });
  }
  // Log as warning for 4xx, error for 5xx
  if (err.status && err.status >= 400 && err.status < 500) {
    console.warn(`[${err.status}] ${err.message}`);
  } else {
    console.error(err.stack);
  }
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});
