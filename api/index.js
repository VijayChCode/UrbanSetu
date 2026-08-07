import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { checkAndSendMaintenanceNotifications } from './utils/maintenanceNotifier.js';
import userRouter from './routes/user.route.js'
import authRouter from './routes/auth.route.js'
import listingRouter from './routes/listing.route.js'
import bookingRouter from "./routes/booking.route.js";
import { registerUserAppointmentsSocket } from './routes/booking.route.js';
import Booking from './models/booking.model.js';
import Reminder from './models/reminder.model.js';
import aboutRouter from "./routes/about.route.js";
import adminRouter from "./routes/admin.route.js";
import contactRouter from "./routes/contact.route.js";
import wishlistRouter from "./routes/wishlist.route.js";
import propertyWatchlistRouter from "./routes/propertyWatchlist.route.js";
import imageFavoriteRouter from "./routes/imageFavorite.route.js";
import notificationRouter from "./routes/notification.route.js";
import requestRouter from "./routes/request.route.js";
import reviewRouter from "./routes/review.route.js";
import aiRouter from "./routes/ai.route.js";
import geminiRouter from "./routes/gemini.route.js";
import sharedChatRouter from "./routes/sharedChat.route.js";
import chatHistoryRouter from "./routes/chatHistory.route.js";
import uploadRouter from "./routes/upload.route.js";
import speechToTextRouter from "./routes/speechToText.route.js";
import paymentRouter from "./routes/payment.route.js";
import sessionRouter from "./routes/session.route.js";
import sessionManagementRouter from "./routes/sessionManagement.route.js";
import fraudRouter from "./routes/fraud.route.js";
import emailMonitorRouter from "./routes/emailMonitor.route.js";
import accountRevocationRouter from "./routes/accountRevocation.route.js";
import propertySearchRouter from "./routes/propertySearch.route.js";
import dataSyncRouter from "./routes/dataSync.route.js";
import appointmentReminderRouter from "./routes/appointmentReminder.route.js";
import faqRouter from "./routes/faq.route.js";
import blogRouter from "./routes/blog.route.js";
import priceDropAlertRouter from "./routes/priceDropAlert.route.js";
import statisticsRouter from "./routes/statistics.route.js";
import configRouter from "./routes/config.route.js";
import analyticsRouter from "./routes/analytics.route.js";
import calculationHistoryRouter from "./routes/calculationHistory.route.js";
import routePlannerRouter from "./routes/routePlanner.route.js";
import propertiesRouter from "./routes/properties.route.js";
import searchRouter from "./routes/search.route.js";
import propertyRestorationRouter from "./routes/propertyRestoration.route.js";
import advancedAIRecommendationRouter from "./routes/advancedAIRecommendation.route.js";
import esgAnalyticsRouter from "./routes/esgAnalytics.route.js";
import esgAIRecommendationRouter from "./routes/esgAIRecommendation.route.js";
import visitorRouter from "./routes/visitor.route.js";
import forumRouter from "./routes/forum.route.js";
import reportMessageRouter from "./routes/reportMessage.route.js";
import callRouter from "./routes/call.route.js";
import { generateCallId } from "./routes/call.route.js";
import CallHistory from "./models/callHistory.model.js";
import { sendCallMissedEmail, sendCallInitiatedEmail } from "./utils/emailService.js";
import rentalRouter from "./routes/rental.route.js";
import coinRouter from "./routes/coin.route.js";
import turnRouter from "./routes/turn.route.js"; // Import TURN route
import preBookingChatRouter from "./routes/preBookingChat.route.js";
import platformUpdateRouter from "./routes/platformUpdate.route.js";
import yearInReviewRouter from "./routes/yearInReview.route.js";
import helpCenterRouter from "./routes/helpCenter.route.js";
import agentRouter from "./routes/agent.route.js";
import subscriptionRouter from "./routes/subscription.route.js";
import marketRouter from "./routes/market.route.js";
import sitemapRouter from "./routes/sitemap.route.js";
import securityIntelligenceRouter from "./routes/securityIntelligence.route.js";
import videoShareRouter from "./routes/videoShare.route.js";
import imageShareRouter from "./routes/imageShare.route.js";
import sentinelRouter from "./routes/sentinel.route.js";

// Use S3 deployment route if AWS is configured, otherwise fallback to Cloudinary
let deploymentRouter;
try {
  if (process.env.AWS_S3_BUCKET_NAME) {
    console.log('🔧 Using AWS S3 deployment route');
    deploymentRouter = (await import("./routes/deployment-s3.route.js")).default;
  } else {
    console.log('🔧 Using Cloudinary deployment route (AWS S3 not configured)');
    deploymentRouter = (await import("./routes/deployment.route.js")).default;
  }
} catch (error) {
  console.error('❌ Error loading deployment router:', error);
  console.log('🔧 Falling back to Cloudinary deployment route');
  deploymentRouter = (await import("./routes/deployment.route.js")).default;
}
import { startScheduler } from "./services/schedulerService.js";
import { initializeReEngagementScheduler } from "./utils/reEngagementScheduler.js";
import { initializeTrendingEmailScheduler } from "./utils/trendingEmailScheduler.js";
import { startReferralReminderScheduler } from "./schedulers/referralReminder.js";
import { indexAllWebsiteData } from "./services/dataSyncService.js";
import { setupAllHooks } from "./middleware/dataSyncHooks.js";
import { startScheduledSync } from "./services/scheduledSyncService.js";
import { initializeYearInReviewScheduler } from "./utils/yearInReviewScheduler.js";
import { startCoinExpiryScheduler } from "./schedulers/coinExpiryScheduler.js";
import { startFestivalGreetingScheduler } from "./schedulers/festivalGreetingScheduler.js";
import { startMonthlyLeaderboardScheduler } from "./schedulers/monthlyLeaderboardScheduler.js";

import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

import path from 'path'
import User from './models/user.model.js';
import bcryptjs from 'bcryptjs';

dotenv.config();

console.log("MongoDB URI:", process.env.MONGO ? "[SET - REDACTED]" : "[NOT SET]");

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

      // Run migration to fix refundId index
      await fixRefundIdIndex();

      // Run migration to seed default fields for legacy accounts
      await migrateUserDefaultFields();

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

// Migration function to fix refundId index
const fixRefundIdIndex = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('refundrequests');

    // Check if the problematic index exists
    const indexes = await collection.indexes();
    const refundIdIndex = indexes.find(index => index.name === 'refundId_1' && index.unique && !index.sparse);

    if (refundIdIndex) {
      console.log("Found problematic refundId index, fixing...");

      // Drop the existing unique index on refundId
      await collection.dropIndex('refundId_1');
      console.log("✅ Dropped existing refundId_1 index");

      // Create a new sparse unique index on refundId
      await collection.createIndex({ refundId: 1 }, { unique: true, sparse: true });
      console.log("✅ Created new sparse unique index on refundId");
    } else {
      console.log("RefundId index is already correct or doesn't exist");
    }
  } catch (error) {
    console.error("Error during refundId index migration:", error.message);
    // Don't exit the process, just log the error
  }
};

// Migration function to migrate user default schema fields
const migrateUserDefaultFields = async () => {
  try {
    const User = (await import('./models/user.model.js')).default;
    
    // Update any user document where "role" does not exist, setting it to "user"
    const resultRole = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'user' } }
    );
    if (resultRole.modifiedCount > 0) {
      console.log(`✅ Seeded missing role for ${resultRole.modifiedCount} users`);
    }

    // Update status
    const resultStatus = await User.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'active' } }
    );
    if (resultStatus.modifiedCount > 0) {
      console.log(`✅ Seeded missing status for ${resultStatus.modifiedCount} users`);
    }

    // Update isDefaultAdmin
    const resultDefaultAdmin = await User.updateMany(
      { isDefaultAdmin: { $exists: false } },
      { $set: { isDefaultAdmin: false } }
    );
    if (resultDefaultAdmin.modifiedCount > 0) {
      console.log(`✅ Seeded missing isDefaultAdmin for ${resultDefaultAdmin.modifiedCount} users`);
    }

    // Update isSubscribed
    const resultSubscribed = await User.updateMany(
      { isSubscribed: { $exists: false } },
      { $set: { isSubscribed: true } }
    );
    if (resultSubscribed.modifiedCount > 0) {
      console.log(`✅ Seeded missing isSubscribed for ${resultSubscribed.modifiedCount} users`);
    }

    // Update isLocked
    const resultLocked = await User.updateMany(
      { isLocked: { $exists: false } },
      { $set: { isLocked: false } }
    );
    if (resultLocked.modifiedCount > 0) {
      console.log(`✅ Seeded missing isLocked for ${resultLocked.modifiedCount} users`);
    }

    // Update policyViolations
    const resultViolations = await User.updateMany(
      { policyViolations: { $exists: false } },
      { $set: { policyViolations: 0 } }
    );

    // Update activeSessions
    const resultSessions = await User.updateMany(
      { activeSessions: { $exists: false } },
      { $set: { activeSessions: [] } }
    );

    // Update settings if not present
    const resultSettings = await User.updateMany(
      { settings: { $exists: false } },
      { $set: {
        settings: {
          emailNotifications: true,
          inAppNotifications: true,
          pushNotifications: true,
          marketingNotifications: true,
          propertyAlerts: true,
          bookingUpdates: true,
          communitySocial: true,
          securityAlerts: true,
          chatMessages: true,
          notificationSound: 'default',
          showEmail: false,
          showPhone: false,
          dataSharing: true,
          allowLocationAccess: false,
          language: 'en',
          timezone: 'Asia/Kolkata',
          dateFormat: 'MM/DD/YYYY',
          theme: 'light',
          fontSize: 'medium',
          pushTokens: [],
          biometricAuth: false,
          biometricLockPeriod: 0,
          batteryOptimization: false
        }
      }}
    );
    if (resultSettings.modifiedCount > 0) {
      console.log(`✅ Seeded default settings for ${resultSettings.modifiedCount} users`);
    }
  } catch (error) {
    console.error("❌ Failed running User schema migration:", error.message);
  }
};

// Connect to MongoDB
connectToMongoDB().then(() => {
  // Initialize schedulers after DB connection
  initializeReEngagementScheduler();
  initializeTrendingEmailScheduler();
  startReferralReminderScheduler();
  initializeYearInReviewScheduler();
  startCoinExpiryScheduler();
  startFestivalGreetingScheduler();
  startMonthlyLeaderboardScheduler();
});

const __dirname = path.resolve();

let PORT = process.env.PORT || 3000;

const app = express();

// Trust proxy headers (needed to get real client IP behind proxies/load balancers)
app.set('trust proxy', true);

// Security middleware
const allowedOrigins = [
  'https://urbansetu.vercel.app',
  'https://urbansetuglobal.onrender.com',
  'http://localhost:5173', // for local development
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      /^https:\/\/urbansetu(-[a-z0-9\-]+)?\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-CSRF-Token', 'x-csrf-token', 'X-Csrf-Token', 'x-session-id', 'X-Session-Id']
}));

app.use(helmet());
app.use(globalRateLimiter);

// Increase payload size limit for large file uploads
app.use((req, res, next) => {
  if (req.url.includes('/api/deployment/upload') || req.url.includes('/api/upload')) {
    req.setTimeout(600000); // 10 minutes timeout for file uploads
    res.setTimeout(600000);
  }
  next();
});

// Configure body parsers with appropriate limits for large file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());




// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'UrbanSetu API',
    uptime: Math.floor(process.uptime()),
    version: '2.0.0'
  });
});

// API info endpoint (JSON)
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'UrbanSetu API',
    version: '2.0.0',
    status: 'running',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      user: '/api/user',
      listing: '/api/listing',
      bookings: '/api/bookings',
      admin: '/api/admin',
      contact: '/api/contact',
      wishlist: '/api/wishlist',
      about: '/api/about',
      agent: '/api/agent',
      subscription: '/api/subscription',
      market: '/api/market'
    },
    documentation: 'All endpoints require authentication via Bearer token unless specified otherwise.'
  });
});

// Root endpoint — Premium HTML Landing Page
app.get('/', (req, res) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UrbanSetu API</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* Animated background */
    body::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
                  radial-gradient(ellipse at 50% 100%, rgba(59, 130, 246, 0.05) 0%, transparent 50%);
      animation: bgPulse 8s ease-in-out infinite alternate;
    }

    @keyframes bgPulse {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(-2%, -1%) scale(1.05); }
    }

    /* Glow line at top */
    .glow-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #6366f1, #8b5cf6, #3b82f6, transparent);
      animation: glowSlide 3s linear infinite;
    }

    @keyframes glowSlide {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }

    .container {
      text-align: center;
      position: relative;
      z-index: 1;
      padding: 2rem;
    }

    /* Logo */
    .logo {
      font-size: 2.8rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
      animation: iconPulse 2s ease-in-out infinite;
    }

    @keyframes iconPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.4); }
      50% { box-shadow: 0 0 35px rgba(99, 102, 241, 0.6); }
    }

    .logo-text { color: #ffffff; }
    .logo-highlight {
      background: linear-gradient(135deg, #6366f1, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Version badge */
    .version {
      display: inline-block;
      padding: 0.35rem 1rem;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #818cf8;
      background: rgba(99, 102, 241, 0.08);
      margin-bottom: 1.5rem;
      letter-spacing: 0.5px;
    }

    /* Status */
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
      color: #94a3b8;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.2); }
    }

    .uptime {
      font-size: 0.78rem;
      color: #64748b;
      margin-bottom: 2rem;
    }

    /* Buttons */
    .buttons {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 2rem;
    }

    .btn {
      padding: 0.6rem 1.4rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #c7d2fe;
      background: rgba(99, 102, 241, 0.08);
    }

    .btn:hover {
      background: rgba(99, 102, 241, 0.18);
      border-color: rgba(99, 102, 241, 0.5);
      color: #e0e7ff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
    }

    .btn-primary {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
      border-color: rgba(99, 102, 241, 0.4);
      color: #e0e7ff;
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3));
    }

    .btn .arrow { transition: transform 0.2s; display: inline-block; }
    .btn:hover .arrow { transform: translateX(3px); }

    /* Footer */
    .footer {
      font-size: 0.75rem;
      color: #475569;
      letter-spacing: 0.3px;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .logo { font-size: 2rem; }
      .buttons { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>
  <div class="glow-line"></div>
  <div class="container">
    <div class="logo">
      <div class="logo-icon">🏠</div>
      <span class="logo-text">URBAN</span><span class="logo-highlight">SETU</span>
    </div>
    <div class="version">API Server v2.0.0</div>
    <div class="status">
      <span class="status-dot"></span>
      All systems operational
    </div>
    <div class="uptime">Uptime: ${uptimeStr}</div>
    <div class="buttons">
      <a href="/api" class="btn btn-primary">API Info</a>
      <a href="/api/health" class="btn">Health Check</a>
      <a href="https://urbansetu.vercel.app" class="btn">Open App <span class="arrow">→</span></a>
    </div>
    <div class="footer">© ${new Date().getFullYear()} UrbanSetu. Real Estate Platform API.</div>
  </div>
</body>
</html>`);
});

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
  }
});

app.set('io', io);
import sentinelSecurityService from "./services/SentinelSecurityService.js";
sentinelSecurityService.setIo(io);

// Routes
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/listing', listingRouter);
app.use('/api/market', marketRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/about', aboutRouter);
app.use('/api/admin', adminRouter);
app.use('/api/contact', contactRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/favorites', imageFavoriteRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/requests', requestRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/ai', aiRouter);
app.use('/api/gemini', geminiRouter);
app.use('/api/shared-chat', sharedChatRouter);
app.use('/api/chat-history', chatHistoryRouter);
app.use('/api/upload', uploadRouter); // Regular Cloudinary upload
app.use('/api/deployment', deploymentRouter); // Smart Deployment Route (S3/Cloudinary) - handles /api/deployment/upload
app.use('/api/speech-to-text', speechToTextRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/session', sessionRouter);
app.use('/api/session-management', sessionManagementRouter);
app.use('/api/fraud', fraudRouter);
app.use('/api/email-monitor', emailMonitorRouter);
app.use('/api/account-revocation', accountRevocationRouter);
app.use('/api/property-search', propertySearchRouter);
app.use('/api/data-sync', dataSyncRouter);
app.use('/api/appointment-reminder', appointmentReminderRouter);
app.use('/api/faqs', faqRouter);
app.use('/api/blogs', blogRouter);
app.use('/api/price-drop-alerts', priceDropAlertRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/config', configRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/calculation-history", calculationHistoryRouter);
app.use("/api/route-planner", routePlannerRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api/search", searchRouter);
app.use("/api/property-restoration", propertyRestorationRouter);
app.use("/api/advanced-ai", advancedAIRecommendationRouter);
app.use("/api/esg-analytics", esgAnalyticsRouter);
app.use("/api/esg-recommendations", esgAIRecommendationRouter);
app.use("/api/visitors", visitorRouter);
app.use("/api/forum", forumRouter);
app.use("/api/report-message", reportMessageRouter);
app.use("/api/calls", callRouter);
app.use("/api/rental", rentalRouter);
app.use("/api/coins", coinRouter);
app.use("/api/turn", turnRouter);
app.use("/api/chat", preBookingChatRouter);
app.use("/api/platform-update", platformUpdateRouter);
app.use("/api/year-in-review", yearInReviewRouter);
app.use("/api/help-center", helpCenterRouter);
app.use("/api/agent", agentRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/security-intelligence", securityIntelligenceRouter);
app.use('/api/video', videoShareRouter);
app.use('/api/image', imageShareRouter);
app.use('/api/admin/sentinel', sentinelRouter);
app.use('/api/sentinel', sentinelRouter); // User-facing Sentinel preference sync/restore
app.use("/", sitemapRouter);

let onlineUsers = new Set();
let lastSeenTimes = new Map(); // Track last seen times for users
app.set('onlineUsers', onlineUsers);
app.set('lastSeenTimes', lastSeenTimes);

// Store active calls (in-memory) - shared across all socket connections
const activeCalls = new Map(); // callId -> { callerSocketId, receiverSocketId, appointmentId, ... }
app.set('activeCalls', activeCalls); // Make accessible to routes for cleanup

// Register user appointments socket logic for delivered ticks
registerUserAppointmentsSocket(io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      if (!process.env.JWT_TOKEN) {
        console.error('JWT_TOKEN is not set in environment variables');
        return next(new Error('Server configuration error'));
      }
      const decoded = jwt.verify(token, process.env.JWT_TOKEN);
      const user = await User.findById(decoded.id);
      if (user) {
        socket.user = user;
        socket.sessionId = decoded.sessionId; // Store session ID for verification
        socket.join(user._id.toString());
        socket.join(`user_${user._id.toString()}`);
      } else {
        console.warn('User not found for token:', decoded.id);
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.warn(`[Socket Auth] Token expired for socket ${socket.id}. Handshake was attempted with an expired JWT.`);
        return next(new Error('jwt expired')); // Important: Returning error triggers connect_error on client
      } else {
        console.error(`[Socket Auth] Authentication failed for socket ${socket.id}:`, error.message);
        return next(new Error('Authentication failed'));
      }
    }
  } else {
    console.log('Socket connected without token (public user)');
  }
  // Allow connection for public users (no token provided)
  next();
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id, 'UserID:', socket.user?._id?.toString());
  // Auto-join session room using session_id from cookies if available
  try {
    const cookieHeader = socket.handshake.headers && socket.handshake.headers.cookie;
    if (cookieHeader) {
      const parts = cookieHeader.split(';').map(s => s.trim());
      const sessionPair = parts.find(p => p.startsWith('session_id='));
      if (sessionPair) {
        const sessId = decodeURIComponent(sessionPair.split('=')[1] || '');
        if (sessId) {
          socket.join(`session_${sessId}`);
        }
      }
    }
  } catch (_) { }

  // Check for triggered reminders on initial handshake connection
  if (socket.user) {
    const userIdStr = socket.user._id.toString();
    Reminder.find({ userId: userIdStr, status: 'triggered' })
      .then(pendingReminders => {
        const now = new Date();
        const NOMINAL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes nominal time
        for (const reminder of pendingReminders) {
          const timePassed = now.getTime() - new Date(reminder.scheduledTime).getTime();
          if (timePassed > NOMINAL_EXPIRY_MS) {
            console.log(`⏰ Reminder ${reminder._id} has exceeded nominal ringing time on handshake (${timePassed}ms > ${NOMINAL_EXPIRY_MS}ms). Auto-dismissing.`);
            reminder.status = 'dismissed';
            reminder.save().catch(err => console.error('Error auto-dismissing expired reminder on handshake:', err));
            continue;
          }
          console.log(`🗣️ Handshake Connection: Emitting missed triggered reminder for user ${userIdStr}: "${reminder.taskText}"`);
          socket.emit('reminder_triggered', {
            reminderId: reminder._id.toString(),
            taskText: reminder.taskText,
            scheduledTime: reminder.scheduledTime.toISOString()
          });
        }
      })
      .catch(err => {
        console.error('Error fetching pending triggered reminders on connection:', err);
      });
  }

  // Allow clients to explicitly register their user room with validation
  // Supports late authentication: if socket.user is null, tries to verify a provided JWT token
  socket.on('registerUser', async ({ userId, token: clientToken }) => {
    if (userId) {
      // If socket is not yet authenticated, attempt late authentication via token
      if (!socket.user || socket.user._id.toString() !== userId.toString()) {
        const tokenToVerify = clientToken || (socket.handshake.auth && socket.handshake.auth.token);
        if (tokenToVerify && process.env.JWT_TOKEN) {
          try {
            const decoded = jwt.verify(tokenToVerify, process.env.JWT_TOKEN);
            if (decoded.id && decoded.id.toString() === userId.toString()) {
              const user = await User.findById(decoded.id);
              if (user) {
                socket.user = user;
                socket.sessionId = decoded.sessionId;
                console.log(`[Socket] Late authentication successful for socket ${socket.id}, user ${userId}`);
              }
            }
          } catch (tokenErr) {
            // Token verification failed - fall through to rejection
          }
        }

        // Re-check after late auth attempt
        if (!socket.user || socket.user._id.toString() !== userId.toString()) {
          console.warn(`[Socket Security] Unauthorized registerUser attempt by socket ${socket.id} for user ${userId}`);
          return;
        }
      }

      const userIdStr = userId.toString();
      // Join both room formats for compatibility (userId and user_${userId})
      socket.join(userIdStr);
      socket.join(`user_${userIdStr}`);

      // Deliver triggered reminders on explicit user registration
      Reminder.find({ userId: userIdStr, status: 'triggered' })
        .then(pendingReminders => {
          const now = new Date();
          const NOMINAL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes nominal time
          for (const reminder of pendingReminders) {
            const timePassed = now.getTime() - new Date(reminder.scheduledTime).getTime();
            if (timePassed > NOMINAL_EXPIRY_MS) {
              console.log(`⏰ Reminder ${reminder._id} has exceeded nominal ringing time on registerUser (${timePassed}ms > ${NOMINAL_EXPIRY_MS}ms). Auto-dismissing.`);
              reminder.status = 'dismissed';
              reminder.save().catch(err => console.error('Error auto-dismissing expired reminder on registerUser:', err));
              continue;
            }
            console.log(`🗣️ User Registration: Emitting missed triggered reminder for user ${userIdStr}: "${reminder.taskText}"`);
            socket.emit('reminder_triggered', {
              reminderId: reminder._id.toString(),
              taskText: reminder.taskText,
              scheduledTime: reminder.scheduledTime.toISOString()
            });
          }
        })
        .catch(err => {
          console.error('Error fetching pending triggered reminders on registerUser:', err);
        });
    }
  });
  // Broadcast forced logout to a specific session
  socket.on('forceLogoutSession', ({ userId, sessionId }) => {
    // Server-originated event: admins will not emit this; backend emits to room directly below
  });

  // Allow server to emit to a particular session room for immediate logout
  // Clients should join a room named by their session id after login with validation
  socket.on('registerSession', ({ sessionId }) => {
    if (sessionId) {
      if (!socket.user || socket.sessionId !== sessionId) {
        console.warn(`[Socket Security] Unauthorized registerSession attempt by socket ${socket.id} for session ${sessionId}`);
        return;
      }
      socket.join(`session_${sessionId}`);
    }
  });

  // Track which user this socket belongs to
  let thisUserId = null;

  // Listen for presence pings
  socket.on('userAppointmentsActive', async ({ userId }) => {
    if (!userId) return;
    if (!socket.user || socket.user._id.toString() !== userId.toString()) {
      console.warn(`[Socket Security] Unauthorized userAppointmentsActive attempt by socket ${socket.id} for user ${userId}`);
      return;
    }
    thisUserId = userId;
    const wasOffline = !onlineUsers.has(userId);
    onlineUsers.add(userId);
    lastSeenTimes.delete(userId); // Remove last seen when user comes online

    // IMPORTANT: Join user to their personal room for direct messaging
    const userIdStr = userId.toString();
    // Join both room formats for compatibility (userId and user_${userId})
    socket.join(userIdStr);
    socket.join(`user_${userIdStr}`);

    io.emit('userOnlineUpdate', { userId, online: true });

    // Check for triggered reminders that haven't been dismissed/acknowledged yet
    try {
      const pendingReminders = await Reminder.find({
        userId: userIdStr,
        status: 'triggered'
      });
      const now = new Date();
      const NOMINAL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes nominal time
      for (const reminder of pendingReminders) {
        const timePassed = now.getTime() - new Date(reminder.scheduledTime).getTime();
        if (timePassed > NOMINAL_EXPIRY_MS) {
          console.log(`⏰ Reminder ${reminder._id} has exceeded nominal ringing time on presence ping (${timePassed}ms > ${NOMINAL_EXPIRY_MS}ms). Auto-dismissing.`);
          reminder.status = 'dismissed';
          await reminder.save();
          continue;
        }
        console.log(`🗣️ Socket connection: Emitting missed triggered reminder for user ${userIdStr}: "${reminder.taskText}"`);
        socket.emit('reminder_triggered', {
          reminderId: reminder._id.toString(),
          taskText: reminder.taskText,
          scheduledTime: reminder.scheduledTime.toISOString()
        });
      }
    } catch (err) {
      console.error('Error fetching pending triggered reminders on presence pulse:', err);
    }

    // CHECK FOR EXISTING ACTIVE CALLS (Persistence/Recovery)
    for (const [callId, activeCall] of activeCalls.entries()) {
      if (activeCall.callerId === userIdStr || activeCall.receiverId === userIdStr) {
        const role = activeCall.callerId === userIdStr ? 'caller' : 'receiver';

        // Clear any pending termination timeout if it exists
        if (activeCall.terminationTimeout) {
          clearTimeout(activeCall.terminationTimeout);
          activeCall.terminationTimeout = null;
        }

        // Update the socket ID to the new one
        if (role === 'caller') {
          activeCall.callerSocketId = socket.id;
        } else {
          activeCall.receiverSocketId = socket.id;
        }

        activeCalls.set(callId, activeCall);  

        console.log(`[Call Recovery] User ${userIdStr} re-joined active call ${callId} as ${role}`);

        // If user is receiver and call is still ringing, they need IncomingCallModal (incoming-call event)
        // If user is caller or call is already active, they need OngoingCallBar/Modal (active-call-session event)
        if (role === 'receiver' && activeCall.status === 'ringing') {
          socket.emit('incoming-call', {
            callId,
            appointmentId: activeCall.appointmentId,
            callerId: activeCall.callerId,
            callerName: activeCall.callerName,
            callType: activeCall.callType,
            isRecovered: true
          });
        } else {
          // LINK CALL GUARD: For link-based calls in 'waiting' status, do NOT send
          // active-call-session to the RECEIVER. They haven't joined yet — they should
          // only join through CallRoom.jsx by clicking "Join Call Now".
          // This prevents the "Resuming ongoing call..." toast and auto media access.
          if (activeCall.callMode === 'link' && role === 'receiver' && activeCall.status === 'waiting') {
            console.log(`[Call Recovery] Skipping active-call-session for link call receiver (call ${callId} still in waiting state)`);
          } else {
            // Get state for THIS user (for non-ringing or established calls)
            const myState = role === 'caller' ? activeCall.callerState : activeCall.receiverState;
            // Get state for the OTHER user
            const otherState = role === 'caller' ? activeCall.receiverState : activeCall.callerState;

            // Notify the client about their active session
            socket.emit('active-call-session', {
              callId,
              appointmentId: activeCall.appointmentId,
              role,
              callType: activeCall.callType,
              callMode: activeCall.callMode || 'direct',
              linkToken: activeCall.linkToken || null,
              startTime: activeCall.startTime ? (typeof activeCall.startTime.getTime === 'function' ? activeCall.startTime.getTime() : new Date(activeCall.startTime).getTime()) : Date.now(),
              callerId: activeCall.callerId,
              receiverId: activeCall.receiverId,
              callerName: activeCall.callerName,
              receiverName: activeCall.receiverName,
              status: activeCall.status || 'active',
              // Local state for this user to restore their hardware state
              isMuted: myState?.isMuted || false,
              isVideoEnabled: myState?.isVideoEnabled !== false,
              isScreenSharing: myState?.isScreenSharing || false,
              // Remote state to restore indicators for the other party
              remoteIsMuted: otherState?.isMuted || false,
              remoteIsVideoEnabled: otherState?.isVideoEnabled !== false,
              remoteIsScreenSharing: otherState?.isScreenSharing || false
            });
          }
        }

        // Notify other party that peer is back
        const otherSocketId = role === 'caller' ? activeCall.receiverSocketId : activeCall.callerSocketId;
        if (otherSocketId) {
          io.to(otherSocketId).emit('peer-resumed', { callId, role });
        }
        break; // Assume one active call at a time
      }
    }

    // If user was offline and just came online, mark all pending messages as delivered
    if (wasOffline) {
      try {
        // Find all bookings where this user is buyer or seller
        const bookings = await Booking.find({
          $or: [{ buyerId: userId }, { sellerId: userId }]
        });

        for (const appt of bookings) {
          let updated = false;
          for (const comment of appt.comments) {
            // Only mark as delivered if:
            // 1. Comment is not from this user 
            // 2. Comment status is "sent" (meaning it was sent while recipient was offline)
            // 3. Comment is not already delivered or read
            if (comment.sender.toString() !== userId &&
              comment.status === 'sent' &&
              !comment.readBy?.includes(userId)) {
              comment.status = 'delivered';
              comment.deliveredAt = new Date();
              updated = true;
              io.emit('commentDelivered', { appointmentId: appt._id.toString(), commentId: comment._id.toString() });
            }
          }
          if (updated) await appt.save();
        }

      } catch (err) {
        console.error('Error marking comments as delivered when user came online:', err);
      }
    }

    // [ALWAYS CHECK] pending calls (initiated or ringing) where user is the receiver
    // This must be outside wasOffline because it also handles refreshes/reconnections
    try {
      const pendingCalls = await CallHistory.find({
        receiverId: userId,
        status: { $in: ['initiated', 'ringing'] },
        // Only show calls from last 5 minutes (to avoid showing very old calls)
        startTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      })
        .populate('callerId', 'username')
        .populate('appointmentId', 'propertyName')
        .sort({ startTime: -1 })
        .limit(1); // Only show the most recent pending call

      if (pendingCalls.length > 0) {
        const pendingCall = pendingCalls[0];

        // Check if call is already in memory activeCalls (handled above)
        // If not in memory but in DB, it's a truly missed call
        if (!activeCalls.has(pendingCall.callId)) {
          // Emit incoming call to the user who just came online/refreshed
          socket.emit('incoming-call', {
            callId: pendingCall.callId,
            appointmentId: pendingCall.appointmentId?._id || pendingCall.appointmentId,
            callerId: pendingCall.callerId?._id || pendingCall.callerId,
            callType: pendingCall.callType,
            callerName: pendingCall.callerId?.username || 'Participant',
            isRecovered: true
          });
        }
      }
    } catch (callErr) {
      console.error('Error checking pending calls on user presence pulse:', callErr);
    }

    if (socket.onlineTimeout) clearTimeout(socket.onlineTimeout);
    socket.onlineTimeout = setTimeout(() => {
      onlineUsers.delete(userId);
      lastSeenTimes.set(userId, new Date().toISOString()); // Store last seen time
      io.emit('userOnlineUpdate', { userId, online: false, lastSeen: lastSeenTimes.get(userId) });
    }, 5000); // 5 seconds of inactivity = offline
  });

  // Listen for admin appointments active
  socket.on('adminAppointmentsActive', async ({ adminId, role }) => {
    if (!adminId) return;
    if (!socket.user || socket.user._id.toString() !== adminId.toString() || (socket.user.role !== 'admin' && socket.user.role !== 'rootadmin')) {
      console.warn(`[Socket Security] Unauthorized adminAppointmentsActive attempt by socket ${socket.id} for admin ${adminId}`);
      return;
    }
    thisUserId = adminId;

    // IMPORTANT: Join admin to their personal room for direct messaging
    socket.join(adminId);

    // Join admin to all appointment rooms to receive real-time updates
    try {
      const allBookings = await Booking.find({});

      for (const appt of allBookings) {
        // Join admin to each appointment room
        socket.join(`appointment_${appt._id}`);
      }

      // Also join admin to a general admin room
      socket.join(`admin_${adminId}`);

      // Store admin socket reference for future use
      socket.adminId = adminId;
      socket.adminRole = role;

    } catch (err) {
      console.error('Error joining admin to appointment rooms:', err);
    }
  });

  // Listen for online status checks
  socket.on('checkUserOnline', ({ userId }) => {
    const isOnline = onlineUsers.has(userId);
    const lastSeen = lastSeenTimes.get(userId);
    socket.emit('userOnlineStatus', { userId, online: isOnline, lastSeen });
  });

  socket.on('typing', ({ toUserId, fromUserId, appointmentId }) => {
    if (!socket.user || socket.user._id.toString() !== fromUserId?.toString()) {
      console.warn(`[Socket Security] Unauthorized typing attempt by socket ${socket.id}`);
      return;
    }
    io.to(toUserId).emit('typing', { fromUserId, appointmentId });
  });

  // Explicit poll for active call state (used by frontend useCall mount/reconnect)
  socket.on('check-active-call', async () => {
    const userIdStr = thisUserId || socket.user?._id?.toString();
    if (!userIdStr) return;

    // 1. ACTIVE CALLS: Check if user belongs to any ongoing call session in memory
    for (const [callId, activeCall] of activeCalls.entries()) {
      if (activeCall.callerId === userIdStr || activeCall.receiverId === userIdStr) {
        const role = activeCall.callerId === userIdStr ? 'caller' : 'receiver';

        // If user is receiver and call is still ringing, they need IncomingCallModal
        if (role === 'receiver' && activeCall.status === 'ringing') {
          socket.emit('incoming-call', {
            callId,
            appointmentId: activeCall.appointmentId,
            callerId: activeCall.callerId,
            callerName: activeCall.callerName,
            callType: activeCall.callType,
            isRecovered: true
          });
        } else {
          // LINK CALL GUARD: Skip for link call receivers in waiting status
          if (activeCall.callMode === 'link' && role === 'receiver' && activeCall.status === 'waiting') {
            console.log(`[Call Recovery] check-active-call: Skipping active-call-session for link call receiver (call ${callId} still in waiting state)`);
          } else {
            // Get state for THIS user (for non-ringing or established calls)
            const myState = role === 'caller' ? activeCall.callerState : activeCall.receiverState;
            // Get state for the OTHER user
            const otherState = role === 'caller' ? activeCall.receiverState : activeCall.callerState;

            // Notify client of their session metadata for UI recovery
            socket.emit('active-call-session', {
              callId,
              appointmentId: activeCall.appointmentId,
              role,
              callType: activeCall.callType,
              callMode: activeCall.callMode || 'direct',
              linkToken: activeCall.linkToken || null,
              startTime: activeCall.startTime ? (typeof activeCall.startTime.getTime === 'function' ? activeCall.startTime.getTime() : new Date(activeCall.startTime).getTime()) : Date.now(),
              callerId: activeCall.callerId,
              receiverId: activeCall.receiverId,
              callerName: activeCall.callerName,
              receiverName: activeCall.receiverName,
              status: activeCall.status || 'active',
              // Local state for this user to restore their hardware state
              isMuted: myState?.isMuted || false,
              isVideoEnabled: myState?.isVideoEnabled !== false,
              isScreenSharing: myState?.isScreenSharing || false,
              // Remote state to restore indicators for the other party
              remoteIsMuted: otherState?.isMuted || false,
              remoteIsVideoEnabled: otherState?.isVideoEnabled !== false,
              remoteIsScreenSharing: otherState?.isScreenSharing || false
            });
          }
        }
        return; // Prioritize one active call from memory
      }
    }

    // 2. PENDING INCOMING CALLS: Check DB for calls they missed while disconnected
    try {
      const pendingCalls = await CallHistory.find({
        receiverId: userIdStr,
        status: { $in: ['initiated', 'ringing'] },
        startTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Safety: only last 5 mins
      })
        .populate('callerId', 'username')
        .populate('appointmentId', 'propertyName')
        .sort({ startTime: -1 })
        .limit(1);

      if (pendingCalls.length > 0) {
        const pendingCall = pendingCalls[0];
        socket.emit('incoming-call', {
          callId: pendingCall.callId,
          appointmentId: pendingCall.appointmentId?._id || pendingCall.appointmentId,
          callerId: pendingCall.callerId?._id || pendingCall.callerId,
          callerName: pendingCall.callerId?.username || 'Participant',
          callType: pendingCall.callType,
          isRecovered: true
        });
      }
    } catch (err) {
      console.error('Error checking pending calls on explicit pull:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id, 'UserID:', socket.user?._id?.toString());
    if (thisUserId) {
      onlineUsers.delete(thisUserId);
      lastSeenTimes.set(thisUserId, new Date().toISOString()); // Store last seen time
      io.emit('userOnlineUpdate', { userId: thisUserId, online: false, lastSeen: lastSeenTimes.get(thisUserId) });
    }

    // Clean up admin room memberships
    if (socket.adminId) {
      // Leave all appointment rooms
      Booking.find({}).then(bookings => {
        for (const appt of bookings) {
          socket.leave(`appointment_${appt._id}`);
        }
      }).catch(err => {
        console.error('Error cleaning up admin appointment rooms:', err);
      });

      // Leave admin room
      socket.leave(`admin_${socket.adminId}`);
    }

    // Cleanup calls on disconnect - WAIT before ending calls to allow for reconnection
    for (const [callId, activeCall] of activeCalls.entries()) {
      if (activeCall.callerSocketId === socket.id ||
        activeCall.receiverSocketId === socket.id) {

        const role = activeCall.callerSocketId === socket.id ? 'caller' : 'receiver';
        const otherSocketId = role === 'caller' ? activeCall.receiverSocketId : activeCall.callerSocketId;

        // Check if the OTHER user is also disconnected (not connected to any socket)
        const otherSocket = otherSocketId ? io.sockets.sockets.get(otherSocketId) : null;
        const otherIsAlsoGone = !otherSocket || !otherSocket.connected;

        if (otherIsAlsoGone) {
          // BOTH users are disconnected — end call immediately
          console.log(`[Call Cleanup] BOTH users disconnected for call ${callId}, ending immediately.`);

          // Clear any existing termination timeout
          if (activeCall.terminationTimeout) {
            clearTimeout(activeCall.terminationTimeout);
            activeCall.terminationTimeout = null;
          }

          // End call in DB
          (async () => {
            try {
              const call = await CallHistory.findOne({ callId });
              if (call && call.status !== 'ended') {
                const endTime = new Date();
                const duration = call.startTime ? Math.floor((endTime - call.startTime) / 1000) : 0;
                call.status = 'ended';
                call.endTime = endTime;
                call.duration = duration;
                call.endedBy = 'system';
                await call.save();
                console.log(`[Call Cleanup] Call ${callId} ended by system (both disconnected). Duration: ${duration}s`);
              }
            } catch (err) {
              console.error('Error auto-ending call:', err);
            }
          })();

          activeCalls.delete(callId);
          continue; // Skip the normal timeout logic
        }

        // If call is still RINGING (not yet answered) and the CALLER disconnects,
        // cancel the call immediately — no point waiting for reconnection
        if (activeCall.status === 'ringing' && role === 'caller') {
          console.log(`[Call Cleanup] Caller disconnected while call ${callId} was still ringing — cancelling immediately.`);

          // Clear any existing termination timeout
          if (activeCall.terminationTimeout) {
            clearTimeout(activeCall.terminationTimeout);
            activeCall.terminationTimeout = null;
          }

          // Notify receiver to dismiss incoming call modal
          if (otherSocketId) {
            io.to(otherSocketId).emit('call-ended', { callId, reason: 'caller-disconnected' });
          }

          // End call in DB as missed/cancelled
          (async () => {
            try {
              const call = await CallHistory.findOne({ callId });
              if (call && call.status !== 'ended') {
                call.status = 'ended';
                call.endTime = new Date();
                call.duration = 0;
                call.endedBy = 'caller-disconnected';
                await call.save();
                console.log(`[Call Cleanup] Ringing call ${callId} cancelled (caller disconnected before answer).`);
              }
            } catch (err) {
              console.error('Error cancelling ringing call:', err);
            }
          })();

          activeCalls.delete(callId);
          continue; // Skip the normal timeout logic
        }

        // Only ONE user disconnected from an ACTIVE call — notify other party and set grace period
        if (otherSocketId) {
          io.to(otherSocketId).emit('peer-reconnecting', { callId, role });
        }

        // Clear any existing termination timeout for this call
        if (activeCall.terminationTimeout) {
          clearTimeout(activeCall.terminationTimeout);
        }

        // Set a timeout to end the call if not resumed within 60 seconds
        activeCall.terminationTimeout = setTimeout(async () => {
          const checkCall = activeCalls.get(callId);
          // Only end if the peer that disconnected hasn't resumed (socket ID hasn't been updated)
          if (checkCall && ((role === 'caller' && checkCall.callerSocketId === socket.id) ||
            (role === 'receiver' && checkCall.receiverSocketId === socket.id))) {

            console.log(`Ending call ${callId} due to reconnection timeout for ${role}`);

            try {
              const call = await CallHistory.findOne({ callId });
              if (call && call.status !== 'ended') {
                const endTime = new Date();
                const duration = Math.floor((endTime - call.startTime) / 1000);
                call.status = 'ended';
                call.endTime = endTime;
                call.duration = duration;
                call.endedBy = socket.user?._id || call.callerId;
                await call.save();
              }
            } catch (err) {
              console.error('Error ending call on reconnection timeout:', err);
            }

            // Notify other party call has finally ended
            const currentOtherSocketId = role === 'caller' ? checkCall.receiverSocketId : checkCall.callerSocketId;
            if (currentOtherSocketId) {
              io.to(currentOtherSocketId).emit('call-ended', { callId });
            }

            activeCalls.delete(callId);
          }
        }, 60000); // 60 seconds grace period

        activeCalls.set(callId, activeCall);
      }
    }

    if (socket.onlineTimeout) clearTimeout(socket.onlineTimeout);
  });

  // Example: Listen for a new comment event from client (optional)
  socket.on('newComment', (data) => {
    io.emit('commentUpdate', data);
  });

  // Listen for new appointments to join admin to new appointment rooms
  socket.on('appointmentCreated', (data) => {
    // Find all admin sockets and join them to the new appointment room
    const adminSockets = Array.from(io.sockets.sockets.values()).filter(s =>
      s.user && (s.user.role === 'admin' || s.user.role === 'rootadmin')
    );

    for (const adminSocket of adminSockets) {
      adminSocket.join(`appointment_${data.appointment._id}`);
    }
  });

  // ========== CALL HANDLERS ==========

  // Call initiation handler
  socket.on('call-initiate', async ({ appointmentId, receiverId, callType }) => {
    try {
      const callerId = socket.user?._id?.toString();
      if (!callerId) {
        return socket.emit('call-error', { message: 'Not authenticated' });
      }

      // Validate appointment and authorization
      const appointment = await Booking.findById(appointmentId);
      if (!appointment) {
        return socket.emit('call-error', { message: 'Appointment not found' });
      }

      // Check if caller is buyer or seller
      if (appointment.buyerId.toString() !== callerId &&
        appointment.sellerId.toString() !== callerId) {
        return socket.emit('call-error', { message: 'Unauthorized' });
      }

      // Determine receiver
      const actualReceiverId = appointment.buyerId.toString() === callerId
        ? appointment.sellerId.toString()
        : appointment.buyerId.toString();

      if (actualReceiverId !== receiverId) {
        return socket.emit('call-error', { message: 'Invalid receiver' });
      }

      // Check if receiver is already in an active call (as caller or receiver)
      let isReceiverBusy = false;
      for (const [_, activeCall] of activeCalls.entries()) {
        // Check if user is receiving a call
        if (activeCall.receiverId === actualReceiverId) {
          isReceiverBusy = true;
          break;
        }
        // Check if user is initiating/in a call as caller
        // We need to look up the socket to get the user ID
        const callerSocket = io.sockets.sockets.get(activeCall.callerSocketId);
        if (callerSocket && callerSocket.user && callerSocket.user._id.toString() === actualReceiverId) {
          isReceiverBusy = true;
          break;
        }
      }

      if (isReceiverBusy) {
        return socket.emit('call-error', { message: 'User is currently in another call' });
      }

      // Create call record
      const callId = generateCallId();
      const callHistory = new CallHistory({
        callId,
        appointmentId,
        callerId,
        receiverId: actualReceiverId,
        callType,
        status: 'initiated',
        callerIP: socket.handshake.address
      });
      await callHistory.save();

      // Fetch participant names for high-fidelity UI recovery (Frontend names fallback)
      const [caller, receiver] = await Promise.all([
        User.findById(callerId).select('username'),
        User.findById(actualReceiverId).select('username')
      ]);

      // Store active call with authoritative metadata
      activeCalls.set(callId, {
        callerSocketId: socket.id,
        callerId,
        receiverId: actualReceiverId,
        appointmentId,
        callType,
        startTime: new Date(),
        callerName: caller?.username || 'Participant',
        receiverName: receiver?.username || 'Participant',
        status: 'ringing',
        // Persist participant states for recovery
        callerState: { isMuted: false, isVideoEnabled: true, isScreenSharing: false },
        receiverState: { isMuted: false, isVideoEnabled: true, isScreenSharing: false }
      });

      // Send call invitation to receiver
      io.to(`user_${actualReceiverId}`).emit('incoming-call', {
        callId,
        appointmentId,
        callerId,
        callType,
        callerName: socket.user?.username || 'Unknown'
      });

      // Send confirmation to caller
      socket.emit('call-initiated', { callId, status: 'ringing' });

      // Send call initiated email to receiver
      try {
        const receiver = await User.findById(actualReceiverId);
        const appointment = await Booking.findById(appointmentId)
          .populate('listingId', 'name');
        const caller = await User.findById(callerId);

        if (receiver && appointment && caller) {
          // Check if receiver is admin
          const isReceiverAdmin = receiver.role === 'admin' || receiver.role === 'rootadmin';

          await sendCallInitiatedEmail(receiver.email, {
            callType,
            callerName: caller.username,
            propertyName: appointment.listingId?.name || appointment.propertyName,
            appointmentId: appointmentId.toString(),
            isReceiverAdmin
          });
        }
      } catch (emailError) {
        console.error("Error sending call initiated email:", emailError);
      }

      // Set timeout for missed call (30 seconds)
      setTimeout(async () => {
        const call = await CallHistory.findOne({ callId });
        if (call && (call.status === 'initiated' || call.status === 'ringing')) {
          call.status = 'missed';
          call.endTime = new Date();
          await call.save();

          // Remove from active calls
          activeCalls.delete(callId);

          // Emit missed call event
          io.to(`user_${callerId}`).emit('call-missed', { callId });
          io.to(`user_${actualReceiverId}`).emit('call-missed', { callId });

          // Send missed call email
          try {
            const receiver = await User.findById(actualReceiverId);
            const appointment = await Booking.findById(appointmentId)
              .populate('listingId', 'name');
            const caller = await User.findById(callerId);

            if (receiver && appointment && caller) {
              await sendCallMissedEmail(receiver.email, {
                callType,
                callerName: caller.username,
                propertyName: appointment.listingId?.name || appointment.propertyName,
                appointmentDate: appointment.date
              });
            }
          } catch (emailError) {
            console.error("Error sending missed call email:", emailError);
          }
        }
      }, 30000); // 30 seconds timeout

    } catch (err) {
      console.error("Error initiating call:", err);
      socket.emit('call-error', { message: 'Failed to initiate call' });
    }
  });

  // ========== LINK-BASED CALL HANDLERS ==========

  // Caller joins the call room and waits for receiver to join via link
  socket.on('call-link-waiting', async ({ callId, linkToken }) => {
    try {
      const callerId = socket.user?._id?.toString();
      if (!callerId) {
        return socket.emit('call-error', { message: 'Not authenticated' });
      }

      const call = await CallHistory.findOne({ callId, linkToken });
      if (!call) {
        return socket.emit('call-error', { message: 'Call not found' });
      }

      if (call.callerId.toString() !== callerId) {
        return socket.emit('call-error', { message: 'Unauthorized' });
      }

      // Check expiry
      if (call.expiresAt && new Date() > call.expiresAt) {
        if (call.status === 'waiting') {
          call.status = 'cancelled';
          await call.save();
        }
        return socket.emit('call-link-expired', { callId });
      }

      // Multi-device prevention: check if the host is already waiting from another socket
      const existingCallForHost = activeCalls.get(callId);
      if (existingCallForHost && existingCallForHost.callerSocketId && existingCallForHost.callerSocketId !== socket.id) {
        // Check if the existing socket is still connected
        const existingSocket = io.sockets.sockets.get(existingCallForHost.callerSocketId);
        if (existingSocket && existingSocket.connected) {
          console.log(`[Link Call] Host ${callerId} attempted to wait from another device — blocked (existing socket: ${existingCallForHost.callerSocketId})`);
          return socket.emit('call-error', { message: 'You are already waiting in this call from another device. Please close the other tab first.' });
        }
        // Existing socket is disconnected — allow takeover
        console.log(`[Link Call] Host ${callerId} previous socket disconnected — allowing takeover`);
      }

      // If call is already accepted (joiner joined while host was refreshing),
      // re-join the room and immediately notify the host so they can create WebRTC peer
      if (call.status === 'accepted' || call.status === 'active') {
        const existingActive = activeCalls.get(callId);

        // FIX B: If BOTH peers are currently connected, block re-entry entirely
        // This prevents a second host device from hijacking the callerSocketId
        if (existingActive && existingActive.callerSocketId && existingActive.receiverSocketId) {
          const callerSocket = io.sockets.sockets.get(existingActive.callerSocketId);
          const receiverSocket = io.sockets.sockets.get(existingActive.receiverSocketId);
          if (callerSocket && callerSocket.connected && receiverSocket && receiverSocket.connected) {
            console.log(`[Link Call] Host ${callerId} tried to re-enter call ${callId} but both peers are active — blocked`);
            return socket.emit('call-error', { message: 'This call is already active with both participants on another device. Please close the other tab first.' });
          }
        }

        if (existingActive) {
          existingActive.callerSocketId = socket.id;
          activeCalls.set(callId, existingActive);
        } else {
          activeCalls.set(callId, {
            callerSocketId: socket.id,
            callerId,
            receiverId: call.receiverId.toString(),
            appointmentId: call.appointmentId.toString(),
            callType: call.callType,
            callMode: 'link',
            status: call.status,
            startTime: call.startTime,
            callerName: socket.user?.username || 'Participant',
            callerState: { isMuted: false, isVideoEnabled: true, isScreenSharing: false },
            receiverState: { isMuted: false, isVideoEnabled: true, isScreenSharing: false }
          });
        }

        socket.join(`call_${callId}`);
        socket.emit('call-link-waiting-ack', { callId, status: call.status });

        // Immediately fire call-link-joined so the host's startLinkCallWaiting listener creates WebRTC peer
        socket.emit('call-link-joined', {
          callId,
          joinerId: call.receiverId.toString(),
          joinerName: call.receiverId?.username || 'Participant',
          startTime: call.startTime || new Date()
        });

        console.log(`[Link Call] Host ${callerId} rejoined already-accepted call ${callId} — re-emitting call-link-joined`);
        return;
      }

      // Store in activeCalls map so we can track the caller's socket
      activeCalls.set(callId, {
        callerSocketId: socket.id,
        callerId,
        receiverId: call.receiverId.toString(),
        appointmentId: call.appointmentId.toString(),
        callType: call.callType,
        callMode: 'link',
        status: 'waiting',
        callerName: socket.user?.username || 'Participant',
        callerState: { isMuted: false, isVideoEnabled: true, isScreenSharing: false },
        receiverState: { isMuted: false, isVideoEnabled: true, isScreenSharing: false }
      });

      // Join a room specific to this call
      socket.join(`call_${callId}`);

      socket.emit('call-link-waiting-ack', { callId, status: 'waiting' });

      // Broadcast to room so joiner (if already in CallRoom) knows host entered
      socket.to(`call_${callId}`).emit('call-link-waiting', { callId, token: linkToken, callerName: socket.user?.username });

      console.log(`[Link Call] Caller ${callerId} waiting in room call_${callId}`);
    } catch (err) {
      console.error("Error in call-link-waiting:", err);
      socket.emit('call-error', { message: 'Failed to start waiting' });
    }
  });

  // Presence relay: When any participant announces their presence in a call room,
  // broadcast it to other participants so they can update UI (e.g., enable Join button)
  socket.on('call-link-presence', ({ callId, token, isCaller }) => {
    if (!callId) return;
    // Join the call room so they receive future events
    socket.join(`call_${callId}`);
    // Broadcast presence to others in the room
    socket.to(`call_${callId}`).emit('call-link-presence', {
      callId,
      token,
      isCaller: !!isCaller,
      userId: socket.user?._id?.toString(),
      username: socket.user?.username
    });

    // TIMING FIX: If the joiner just announced presence, check if the host
    // is ALREADY in activeCalls (host entered before joiner opened CallRoom).
    // If so, immediately notify the joiner that the caller is waiting.
    if (!isCaller) {
      const activeCall = activeCalls.get(callId);
      if (activeCall && activeCall.callerSocketId && (activeCall.status === 'waiting' || activeCall.status === 'active')) {
        console.log(`[Link Call] Host already waiting for call ${callId}, notifying joiner immediately`);
        socket.emit('call-link-waiting', {
          callId,
          token,
          callerName: activeCall.callerName
        });
      }
    }

    console.log(`[Link Call] Presence announced in call_${callId} by ${socket.user?.username} (isCaller: ${isCaller})`);
  });

  // FIX C: Heartbeat handler — periodic presence confirmation for reliable Join button
  socket.on('call-link-heartbeat', ({ callId, isCaller }) => {
    if (!callId) return;
    // Relay heartbeat to other participants in the room
    socket.to(`call_${callId}`).emit('call-link-heartbeat', {
      callId,
      isCaller: !!isCaller,
      userId: socket.user?._id?.toString(),
      username: socket.user?.username
    });
  });

  // Receiver joins via the call link
  socket.on('call-join-via-link', async ({ callId, linkToken }) => {
    try {
      const joinerId = socket.user?._id?.toString();
      if (!joinerId) {
        return socket.emit('call-error', { message: 'Not authenticated' });
      }

      const call = await CallHistory.findOne({ callId, linkToken });
      if (!call) {
        return socket.emit('call-error', { message: 'Call not found' });
      }

      // Verify joiner is the receiver
      if (call.receiverId.toString() !== joinerId) {
        return socket.emit('call-error', { message: 'Unauthorized — you are not the receiver of this call' });
      }

      // Check expiry
      if (call.expiresAt && new Date() > call.expiresAt) {
        if (call.status === 'waiting') {
          call.status = 'cancelled';
          await call.save();
        }
        return socket.emit('call-link-expired', { callId });
      }

      // Check if call is still waiting
      if (call.status !== 'waiting') {
        return socket.emit('call-error', { message: 'This call is no longer available' });
      }

      // Verify the caller is still connected
      const activeCall = activeCalls.get(callId);
      if (!activeCall) {
        return socket.emit('call-error', { message: 'The caller has left the call' });
      }

      // Multi-device prevention: check if another joiner socket is already connected
      if (activeCall.receiverSocketId && activeCall.receiverSocketId !== socket.id) {
        const existingReceiverSocket = io.sockets.sockets.get(activeCall.receiverSocketId);
        if (existingReceiverSocket && existingReceiverSocket.connected) {
          console.log(`[Link Call] Joiner ${joinerId} attempted to join from another device — blocked (existing socket: ${activeCall.receiverSocketId})`);
          return socket.emit('call-error', { message: 'This call has already been joined from another device. Please close the other tab first.' });
        }
        // Existing socket is disconnected — allow takeover
        console.log(`[Link Call] Joiner ${joinerId} previous socket disconnected — allowing takeover`);
      }

      const startTime = new Date();

      // Update DB
      call.status = 'accepted';
      call.startTime = startTime;
      await call.save();

      // Update activeCalls
      activeCall.receiverSocketId = socket.id;
      activeCall.status = 'active';
      activeCall.startTime = startTime;
      activeCall.receiverName = socket.user?.username || 'Participant';

      // Join the call room
      socket.join(`call_${callId}`);

      // Notify the caller that the receiver has joined
      io.to(activeCall.callerSocketId).emit('call-link-joined', {
        callId,
        startTime,
        receiverName: socket.user?.username || 'Participant',
        callType: call.callType,
        appointmentId: call.appointmentId.toString()
      });

      // Send ack to the joiner
      socket.emit('call-link-join-ack', {
        callId,
        startTime,
        callerName: activeCall.callerName,
        callType: call.callType,
        appointmentId: call.appointmentId.toString()
      });

      console.log(`[Link Call] Receiver ${joinerId} joined call ${callId}`);
    } catch (err) {
      console.error("Error in call-join-via-link:", err);
      socket.emit('call-error', { message: 'Failed to join call' });
    }
  });

  // Call accept handler
  socket.on('call-accept', async ({ callId }) => {
    try {
      const receiverId = socket.user?._id?.toString();
      if (!receiverId) {
        return socket.emit('call-error', { message: 'Not authenticated' });
      }

      const call = await CallHistory.findOne({ callId });
      if (!call) {
        return socket.emit('call-error', { message: 'Call not found' });
      }

      if (call.receiverId.toString() !== receiverId) {
        return socket.emit('call-error', { message: 'Unauthorized' });
      }

      // Check if call is already ended/cancelled before accepting
      if (call.status === 'ended') {
        socket.emit('call-ended', { callId, reason: 'call-already-ended' });
        return;
      }

      // CRITICAL: Verify the caller is still connected before allowing the call
      const activeCall = activeCalls.get(callId);
      if (!activeCall) {
        // Call was already cleaned up (caller left)
        console.log(`[Call Accept] Call ${callId} no longer exists in memory — caller likely disconnected.`);
        call.status = 'ended';
        call.endTime = new Date();
        call.duration = 0;
        call.endedBy = 'caller-disconnected';
        await call.save();
        socket.emit('call-ended', { callId, reason: 'caller-disconnected' });
        return;
      }

      // Check if the caller's socket is still actually connected
      const callerSocket = activeCall.callerSocketId ? io.sockets.sockets.get(activeCall.callerSocketId) : null;
      if (!callerSocket || !callerSocket.connected) {
        console.log(`[Call Accept] Caller socket ${activeCall.callerSocketId} is no longer connected for call ${callId}.`);
        call.status = 'ended';
        call.endTime = new Date();
        call.duration = 0;
        call.endedBy = 'caller-disconnected';
        await call.save();
        activeCalls.delete(callId);
        socket.emit('call-ended', { callId, reason: 'caller-disconnected' });
        return;
      }

      // Update call status and set start time (synchronized)
      // CRITICAL: This timestamp is the authoritative start time for both caller and receiver
      // Both sides will use this exact timestamp to calculate call duration
      const startTime = new Date();
      call.status = 'accepted';
      call.startTime = startTime; // Update start time when call is accepted
      call.receiverIP = socket.handshake.address;
      await call.save();

      // Update active call
      activeCall.receiverSocketId = socket.id;
      activeCall.startTime = startTime; // Store synchronized start time
      activeCall.status = 'active'; // Mark as stabilized active
      activeCalls.set(callId, activeCall);

      // Forward any pending WebRTC offers and ICE candidates
      if (activeCall.pendingOffer) {
        socket.emit('webrtc-offer', activeCall.pendingOffer);
        delete activeCall.pendingOffer;
      }

      if (activeCall.pendingCandidates && activeCall.pendingCandidates.length > 0) {
        activeCall.pendingCandidates.forEach(pendingCandidate => {
          socket.emit('ice-candidate', pendingCandidate);
        });
        activeCall.pendingCandidates = [];
      }

      // Send the exact same timestamp to both caller and receiver
      // This ensures perfect synchronization - both sides calculate from the same reference point
      const startTimeTimestamp = startTime.getTime(); // Milliseconds since epoch

      // Notify caller that call was accepted with synchronized start time
      io.to(activeCall.callerSocketId).emit('call-accepted', {
        callId,
        receiverSocketId: socket.id,
        startTime: startTimeTimestamp // Send exact timestamp for synchronization
      });

      // Notify receiver with synchronized start time (same timestamp)
      socket.emit('call-accepted', {
        callId,
        startTime: startTimeTimestamp // Send exact timestamp for synchronization
      });

      // Notify other sockets of receiver that call was accepted elsewhere
      io.to(`user_${receiverId}`).emit('call-accepted-elsewhere', {
        callId,
        receiverSocketId: socket.id
      });
    } catch (err) {
      console.error("Error accepting call:", err);
      socket.emit('call-error', { message: 'Failed to accept call' });
    }
  });

  // Call resume handler - allows reconnected socket to take over an existing active call
  socket.on('call-resume', async ({ callId }) => {
    try {
      const userId = socket.user?._id?.toString();
      if (!userId) return;

      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        let resumed = false;
        let role = '';

        // Determine if user was caller or receiver and update their socket ID
        const call = await CallHistory.findOne({ callId });
        if (call) {
          if (call.callerId.toString() === userId) {
            activeCall.callerSocketId = socket.id;
            resumed = true;
            role = 'caller';
          } else if (call.receiverId.toString() === userId) {
            activeCall.receiverSocketId = socket.id;
            resumed = true;
            role = 'receiver';
          }
        }

        if (resumed) {
          // Clear termination timeout since user has reconnected
          if (activeCall.terminationTimeout) {
            clearTimeout(activeCall.terminationTimeout);
            activeCall.terminationTimeout = null;
          }

          activeCalls.set(callId, activeCall);

          console.log(`Call ${callId} resumed by ${role} with new socket ${socket.id}`);

          // Notify other party that peer is back
          const otherSocketId = role === 'caller' ? activeCall.receiverSocketId : activeCall.callerSocketId;
          if (otherSocketId) {
            io.to(otherSocketId).emit('peer-resumed', { callId, role });
            // CRITICAL: Tell the other user to destroy their old peer and create a new offer
            // This is what actually re-establishes the WebRTC connection
            io.to(otherSocketId).emit('request-reoffer', { callId });
          }
        }
      }
    } catch (err) {
      console.error("Error resuming call:", err);
    }
  });

  // Call reject handler
  socket.on('call-reject', async ({ callId }) => {
    try {
      const receiverId = socket.user?._id?.toString();
      const call = await CallHistory.findOne({ callId });

      if (call && call.receiverId.toString() === receiverId) {
        call.status = 'rejected';
        call.endTime = new Date();
        await call.save();

        // Notify both caller and receiver rooms to close incoming/calling modals on all tabs
        io.to(`user_${call.callerId}`).emit('call-rejected', { callId });
        io.to(`user_${call.receiverId}`).emit('call-rejected', { callId });

        activeCalls.delete(callId);
      }
    } catch (err) {
      console.error("Error rejecting call:", err);
    }
  });

  // Call cancel handler
  socket.on('call-cancel', async ({ callId }) => {
    try {
      const callerId = socket.user?._id?.toString();
      const call = await CallHistory.findOne({ callId });

      if (call && call.callerId.toString() === callerId) {
        const isLinkWaiting = call.callMode === 'link' && call.status === 'waiting';

        if (isLinkWaiting) {
          // LINK CALL in waiting state: Host is just leaving the waiting room.
          // DON'T cancel the DB record — the link stays valid until its expiry time.
          // Only clean up the in-memory activeCalls entry and broadcast to room.

          // FIX A: Only delete activeCalls if this socket actually owns the entry
          const activeCall = activeCalls.get(callId);
          if (activeCall && activeCall.callerSocketId === socket.id) {
            activeCalls.delete(callId);
          }
          socket.leave(`call_${callId}`);

          // Notify joiner (if in CallRoom) that the host left
          io.to(`call_${callId}`).emit('call-cancelled', { callId, hostLeft: true });
          console.log(`[Call Cancel] Host left link call waiting room ${callId} — link still valid until expiry`);

        } else if (call.status === 'initiated' || call.status === 'ringing' || call.status === 'accepted') {
          // FIX A: For active/accepted calls, verify this socket is the actual caller socket
          // A second device from the same user must NOT be able to cancel an active call
          const activeCall = activeCalls.get(callId);
          if (activeCall && activeCall.callerSocketId && activeCall.callerSocketId !== socket.id) {
            console.log(`[Call Cancel] Blocked cancel from unauthorized socket ${socket.id} (authorized: ${activeCall.callerSocketId}) for call ${callId}`);
            socket.leave(`call_${callId}`);
            return; // Silently ignore — don't touch the active call
          }

          // Direct calls or active link calls: Cancel permanently
          call.status = 'cancelled';
          call.endTime = new Date();
          await call.save();

          io.to(`user_${call.receiverId}`).emit('call-cancelled', { callId });
          io.to(`user_${call.callerId}`).emit('call-cancelled', { callId });
          io.to(`call_${callId}`).emit('call-cancelled', { callId });
          io.to(`call_${callId}`).emit('call-ended', { callId });

          activeCalls.delete(callId);
          console.log(`[Call Cancel] Call ${callId} cancelled by caller (was ${call.status})`);
        }
      }
    } catch (err) {
      console.error("Error cancelling call:", err);
    }
  });

  // WebRTC signaling events
  socket.on('webrtc-offer', ({ callId, offer }) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall) {
      return;
    }

    // Forward offer from caller to receiver
    if (socket.id === activeCall.callerSocketId) {
      if (activeCall.receiverSocketId) {
        // Receiver has accepted, forward immediately
        io.to(activeCall.receiverSocketId).emit('webrtc-offer', { callId, offer });
      } else {
        // Receiver hasn't accepted yet, store pending offer
        activeCall.pendingOffer = { callId, offer };
        activeCalls.set(callId, activeCall);
      }
    }
  });

  socket.on('webrtc-answer', ({ callId, answer }) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall) {
      return;
    }

    // Forward answer from receiver to caller
    if (socket.id === activeCall.receiverSocketId && activeCall.callerSocketId) {
      io.to(activeCall.callerSocketId).emit('webrtc-answer', { callId, answer });
    }
  });

  socket.on('ice-candidate', ({ callId, candidate }) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall) {
      return;
    }

    // Forward ICE candidate to the other party
    if (socket.id === activeCall.callerSocketId) {
      // From caller - forward to receiver if ready, otherwise store
      if (activeCall.receiverSocketId) {
        io.to(activeCall.receiverSocketId).emit('ice-candidate', { callId, candidate });
      } else {
        // Store in pending candidates array
        if (!activeCall.pendingCandidates) {
          activeCall.pendingCandidates = [];
        }
        activeCall.pendingCandidates.push({ callId, candidate });
        activeCalls.set(callId, activeCall);
      }
    } else if (socket.id === activeCall.receiverSocketId) {
      // From receiver - forward to caller
      if (activeCall.callerSocketId) {
        io.to(activeCall.callerSocketId).emit('ice-candidate', { callId, candidate });
      }
    }
  });

  // Handle call status updates (mute/video)
  socket.on('call-status-update', ({ callId, isMuted, isVideoEnabled, isScreenSharing }) => {
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const role = socket.id === activeCall.callerSocketId ? 'caller' : 'receiver';
      const participantState = role === 'caller' ? activeCall.callerState : activeCall.receiverState;

      // Update the specific participant's state
      if (participantState) {
        if (isMuted !== undefined) participantState.isMuted = isMuted;
        if (isVideoEnabled !== undefined) participantState.isVideoEnabled = isVideoEnabled;
        if (isScreenSharing !== undefined) participantState.isScreenSharing = isScreenSharing;
      } else {
        // Fallback initialization if missing
        activeCall[role + 'State'] = {
          isMuted: isMuted || false,
          isVideoEnabled: isVideoEnabled !== false,
          isScreenSharing: isScreenSharing || false
        };
      }

      activeCalls.set(callId, activeCall);

      // Forward status update to the other party
      const targetSocketId = socket.id === activeCall.callerSocketId
        ? activeCall.receiverSocketId
        : activeCall.callerSocketId;
      if (targetSocketId) {
        io.to(targetSocketId).emit('remote-status-update', {
          callId,
          isMuted,
          isVideoEnabled,
          isScreenSharing
        });
      }

      // Also forward status update to all monitoring admins
      if (activeCall.monitors && activeCall.monitors.size > 0) {
        activeCall.monitors.forEach(adminSocketId => {
          io.to(adminSocketId).emit('remote-status-update', {
            callId,
            isMuted,
            isVideoEnabled,
            isScreenSharing,
            fromRole: role
          });
        });
      }
    }
  });

  // ===== Admin Live Monitor Support (multi-party WebRTC for admin observers) =====

  // Admin joins an existing active call as a read-only monitor
  socket.on('admin-monitor-join', async ({ callId }) => {
    try {
      const adminUser = socket.user;
      if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'rootadmin')) {
        return socket.emit('call-monitor-error', { message: 'Unauthorized' });
      }

      const call = await CallHistory.findOne({ callId });
      if (!call || call.status !== 'accepted') {
        return socket.emit('call-monitor-error', { message: 'Call is not currently active' });
      }

      const activeCall = activeCalls.get(callId);
      if (!activeCall || !activeCall.callerSocketId || !activeCall.receiverSocketId) {
        return socket.emit('call-monitor-error', { message: 'Call peers are not ready for monitoring' });
      }

      // Track monitor sockets for this call
      if (!activeCall.monitors) {
        activeCall.monitors = new Set();
      }
      activeCall.monitors.add(socket.id);
      activeCalls.set(callId, activeCall);

      // Notify admin with basic context (used for labeling in UI) and initial states
      socket.emit('admin-monitor-started', {
        callId,
        appointmentId: call.appointmentId.toString(),
        callerId: call.callerId.toString(),
        receiverId: call.receiverId.toString(),
        callType: call.callType,
        callerState: activeCall.callerState || { isMuted: false, isVideoEnabled: true, isScreenSharing: false },
        receiverState: activeCall.receiverState || { isMuted: false, isVideoEnabled: true, isScreenSharing: false }
      });

      // Ask both participants to start sending a mirror of their local stream to this admin
      io.to(activeCall.callerSocketId).emit('admin-monitor-request', {
        callId,
        adminSocketId: socket.id
      });
      io.to(activeCall.receiverSocketId).emit('admin-monitor-request', {
        callId,
        adminSocketId: socket.id
      });
    } catch (err) {
      console.error('Error handling admin-monitor-join:', err);
      socket.emit('call-monitor-error', { message: 'Failed to join live monitor' });
    }
  });

  // Participant -> Admin: offer for monitor peer connection
  socket.on('webrtc-offer-monitor', ({ callId, adminSocketId, offer }) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall || !offer) return;

    // Ensure this socket is one of the main call peers
    if (socket.id !== activeCall.callerSocketId && socket.id !== activeCall.receiverSocketId) {
      return;
    }

    if (!activeCall.monitors || !activeCall.monitors.has(adminSocketId)) {
      return;
    }

    const fromRole = socket.id === activeCall.callerSocketId ? 'caller' : 'receiver';

    // Forward offer to admin so they can create a receive-only peer
    io.to(adminSocketId).emit('webrtc-offer-monitor', {
      callId,
      fromRole,
      offer
    });
  });

  // Admin -> Participant: answer for monitor peer
  socket.on('webrtc-answer-monitor', ({ callId, targetRole, answer }) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall || !answer) return;

    // Ensure this socket is a monitor for the call
    if (!activeCall.monitors || !activeCall.monitors.has(socket.id)) {
      return;
    }

    let targetSocketId = null;
    if (targetRole === 'caller') {
      targetSocketId = activeCall.callerSocketId;
    } else if (targetRole === 'receiver') {
      targetSocketId = activeCall.receiverSocketId;
    }
    if (!targetSocketId) return;

    io.to(targetSocketId).emit('webrtc-answer-monitor', {
      callId,
      adminSocketId: socket.id,
      answer
    });
  });

  // ICE candidates for monitor peers in both directions
  socket.on('ice-candidate-monitor', ({ callId, adminSocketId, candidate, from, targetRole }) => {
    const activeCall = activeCalls.get(callId);
    if (!activeCall || !candidate) return;

    // Participant -> Admin
    if (from === 'participant') {
      if (socket.id !== activeCall.callerSocketId && socket.id !== activeCall.receiverSocketId) {
        return;
      }
      if (!activeCall.monitors || !activeCall.monitors.has(adminSocketId)) {
        return;
      }

      const fromRole = socket.id === activeCall.callerSocketId ? 'caller' : 'receiver';
      io.to(adminSocketId).emit('ice-candidate-monitor', {
        callId,
        fromRole,
        candidate
      });
      return;
    }

    // Admin -> Participant
    if (from === 'admin') {
      if (!activeCall.monitors || !activeCall.monitors.has(socket.id)) {
        return;
      }
      let targetSocketId = null;
      if (targetRole === 'caller') {
        targetSocketId = activeCall.callerSocketId;
      } else if (targetRole === 'receiver') {
        targetSocketId = activeCall.receiverSocketId;
      }
      if (!targetSocketId) return;

      io.to(targetSocketId).emit('ice-candidate-monitor', {
        callId,
        adminSocketId: socket.id,
        candidate
      });
    }
  });

  // Admin: force terminate an active call (fraud / abuse intervention)
  socket.on('admin-force-end-call', async ({ callId, reason }) => {
    try {
      const adminUser = socket.user;
      if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'rootadmin')) {
        return socket.emit('call-force-end-error', { message: 'Unauthorized' });
      }

      const activeCall = activeCalls.get(callId);
      if (!activeCall) {
        return socket.emit('call-force-end-error', { message: 'Call is not currently active' });
      }

      const terminationMessage = reason?.trim()
        ? reason.trim()
        : 'Call terminated by admin for policy violation.';

      try {
        const call = await CallHistory.findOne({ callId });
        if (call) {
          const endTime = new Date();
          call.status = 'ended';
          call.endTime = endTime;
          if (call.startTime) {
            call.duration = Math.max(0, Math.floor((endTime - call.startTime) / 1000));
          }
          call.endedBy = adminUser._id;
          const notePrefix = `[${new Date().toISOString()}] Force terminated by ${adminUser.username || adminUser.email || 'Admin'}`;
          call.adminNotes = call.adminNotes
            ? `${call.adminNotes}\n${notePrefix} - ${terminationMessage}`
            : `${notePrefix} - ${terminationMessage}`;
          await call.save();
        }
      } catch (err) {
        console.error('Error persisting force-ended call:', err);
      }

      const payload = {
        callId,
        forceEnded: true,
        terminatedBy: 'admin',
        reason: terminationMessage
      };

      if (activeCall.callerSocketId) {
        io.to(activeCall.callerSocketId).emit('call-ended', payload);
      }
      if (activeCall.receiverSocketId) {
        io.to(activeCall.receiverSocketId).emit('call-ended', payload);
      }
      if (activeCall.monitors?.size) {
        activeCall.monitors.forEach((monitorSocketId) => {
          io.to(monitorSocketId).emit('call-ended', payload);
        });
      }

      activeCalls.delete(callId);
      socket.emit('call-force-end-success', { callId });
    } catch (err) {
      console.error('Error force-ending call:', err);
      socket.emit('call-force-end-error', { message: 'Failed to terminate call' });
    }
  });

});

// Health check endpoint for Render deployment
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    routes: 'image-favorites-enabled',
    version: '2.1-debug-v1'
  });
});

// Simple status endpoint to verify deployment
app.get('/api/status', (req, res) => {
  res.status(200).json({
    server: 'UrbanSetu API',
    status: 'running',
    features: ['image-favorites', 'wishlist', 'bookings', 'listings'],
    imageFavoritesEndpoint: '/api/image-favorites/*',
    timestamp: new Date().toISOString(),
    deploymentVersion: 'v2.0-image-favorites-fix'
  });
});

// Debug endpoint to check routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({
    message: 'Available routes',
    routes,
    imageFavoritesRegistered: true,
    timestamp: new Date().toISOString()
  });
});

// Register all routes before starting the server
console.log('Registering API routes...');
app.use("/api/user", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/listing", listingRouter)
app.use("/api/bookings", bookingRouter);
app.use("/api/about", aboutRouter);
app.use("/api/admin", adminRouter);
app.use("/api/contact", contactRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/watchlist", propertyWatchlistRouter);
app.use("/api/image-favorites", imageFavoriteRouter);
console.log('✅ Image favorites routes registered at /api/image-favorites');
app.use("/api/notifications", notificationRouter);
app.use("/api/requests", requestRouter);
app.use("/api/review", reviewRouter);
app.use("/api/gemini", geminiRouter);
app.use("/api/shared-chat", sharedChatRouter);
app.use("/api/chat-history", chatHistoryRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/speech", speechToTextRouter);
app.use("/api/ai", aiRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/turn-credentials", turnRouter); // Register TURN route
app.use("/api/pre-booking-chat", preBookingChatRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/session-management", sessionManagementRouter);
app.use("/api/visitors", visitorRouter);
app.use("/api/calls", callRouter);
app.use("/api/fraud", fraudRouter);
app.use("/api/email-monitor", emailMonitorRouter);
app.use("/api/auth", accountRevocationRouter);
app.use("/api/appointment-reminders", appointmentReminderRouter);
app.use("/api/price-drop-alerts", priceDropAlertRouter);
app.use("/api/statistics", statisticsRouter);
app.use("/api/config", configRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/esg-analytics", esgAnalyticsRouter);
app.use("/api/calculations", calculationHistoryRouter);
app.use("/api/esg-ai", esgAIRecommendationRouter);
app.use("/api/route-planner", routePlannerRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api/search", searchRouter);
app.use("/api/property-restoration", propertyRestorationRouter);
app.use("/api/deployment", deploymentRouter);
app.use("/api/property-search", propertySearchRouter);
app.use("/api/data-sync", dataSyncRouter);
app.use("/api/faqs", faqRouter);
app.use("/api/blogs", blogRouter);
app.use("/api/advanced-ai", advancedAIRecommendationRouter);
app.use("/api/rental", rentalRouter);
app.use("/api/report-message", reportMessageRouter);
app.use("/api/forum", forumRouter);
app.use("/api/coins", coinRouter);
app.use("/api/year-in-review", yearInReviewRouter);
app.use("/api/updates", platformUpdateRouter);
app.use("/api/help", helpCenterRouter); // Register Help Center routes
app.use("/api/agent", agentRouter);
app.use("/api/subscription", subscriptionRouter);
console.log('All API routes registered successfully');

// Catch-all route for 404s - must be after all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

const startServer = () => {
  server.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}!!!`);

    // Start the appointment reminder scheduler
    startScheduler(app);

    // Initialize data synchronization
    console.log('🚀 Initializing data synchronization...');

    try {
      // Setup database change hooks
      setupAllHooks();

      // Initial data indexing
      console.log('📊 Performing initial data indexing...');
      const result = await indexAllWebsiteData();

      if (result.success) {
        console.log(`✅ Initial indexing completed: ${result.totalIndexed} items indexed`);
        console.log(`📊 Breakdown: ${result.breakdown.properties} properties, ${result.breakdown.blogs} blogs, ${result.breakdown.faqs} FAQs`);
      } else {
        console.error('❌ Initial indexing failed:', result.error);
      }

      // Start scheduled synchronization
      startScheduledSync();

      // Trigger pending notifications if maintenance mode is over
      console.log('🚧 Checking for pending maintenance recovery notifications...');
      await checkAndSendMaintenanceNotifications();

      console.log('🎉 Data synchronization system initialized successfully!');
    } catch (error) {
      console.error('❌ Error initializing data synchronization:', error);
    }
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

// Global error handler (should be after all routes)
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  if (status === 401 || err.message === 'Access token not found') {
    console.info(`[401] ${err.message}`);
    return res.status(401).json({ success: false, message: err.message || 'Unauthorized' });
  }
  if (status >= 400 && status < 500) {
    console.warn(`[${status}] ${err.message}`);
  } else {
    console.error(err.stack || err);
  }
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});
