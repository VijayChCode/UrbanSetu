import VisitorLog from '../models/visitorLog.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import crypto from 'crypto';
import { getDeviceInfo, getBrowserInfo, getOSInfo, getDeviceType, getLocationFromIP } from '../utils/sessionManager.js';

// Generate fingerprint for visitor (IP + User-Agent + Source hash)
const generateFingerprint = (ip, userAgent, source = 'Unknown') => {
  const combined = `${ip}|${userAgent}|${source}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
};

// Get start of day (00:00:00)
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper to notify admins about client errors
const notifyAdminsOfErrors = async (errors, visitor, page, userInfo, req) => {
  try {
    const admins = await User.find({
      $or: [{ role: 'rootadmin' }, { role: 'admin' }, { isDefaultAdmin: true }],
      status: { $ne: 'suspended' }
    }).select('_id');

    if (admins.length > 0) {
      const errorCount = errors.length;
      let titleContext = userInfo ? ` (${userInfo.username})` : '';
      if (userInfo && userInfo.role === 'admin') titleContext += ' [Admin]';
      const title = `⚠️ Client Error${titleContext}: ${errorCount} New Issue${errorCount > 1 ? 's' : ''}`;

      const formatError = (err) => {
        let msg = `🔴 Error: ${err.message || 'Unknown'}`;
        if (err.source) msg += `\n   Source: ${err.source}`;
        if (err.timestamp) msg += `\n   Time: ${new Date(err.timestamp).toLocaleString('en-IN')}`;
        return msg;
      };

      let userDetails = userInfo
        ? `👤 User: ${userInfo.username} (${userInfo.role})\n📧 Email: ${userInfo.email}\n🆔 ID: ${userInfo.userId}`
        : '👤 User: Anonymous Guest';

      const message = `${userDetails}\n📍 Page: ${page || 'Unknown'}\n\n${errors.map(e => formatError(e)).join('\n\n')}`;

      const notificationsToCreate = admins.map(admin => ({
        userId: admin._id,
        type: 'client_error_report',
        title: title,
        message: message,
        link: '/admin/client-error-monitoring',
        meta: {
          visitorId: visitor._id,
          page: page,
          errors: errors,
          userInfo
        }
      }));

      const createdNotifications = await Notification.insertMany(notificationsToCreate);

      const io = req.app.get('io');
      if (io) {
        createdNotifications.forEach(notification => {
          io.to(notification.userId.toString()).emit('notificationCreated', notification);
        });
      }
      console.log(`🔔 Notified ${admins.length} admins about ${errorCount} client errors.`);
    }
  } catch (notifyErr) {
    console.error('Failed to notify admins of visitor errors:', notifyErr);
  }
};

// Track visitor when they accept cookies
export const trackVisitor = async (req, res, next) => {
  try {
    const { cookiePreferences, referrer, page, source, utm, type, userInfo } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Generate fingerprint
    const fingerprint = generateFingerprint(ip, userAgent, source);

    // Get device and location info
    const device = getDeviceInfo(userAgent, req.headers);
    const browserInfo = getBrowserInfo(userAgent);
    const os = getOSInfo(userAgent);
    const deviceType = getDeviceType(userAgent, req.headers);
    const location = getLocationFromIP(ip);

    // Get today's date (start of day for grouping)
    const visitDate = getStartOfDay();

    // Try to create visitor log (will fail if already exists for today)
    try {
      // Prepare initial page view with metrics if available
      const initialPageView = {
        path: page || '/',
        title: '',
        timestamp: new Date()
      };

      const initialMetrics = req.body.metrics || {};
      if (initialMetrics.loadTime) initialPageView.loadTime = initialMetrics.loadTime;
      if (initialMetrics.scrollPercentage) initialPageView.scrollPercentage = initialMetrics.scrollPercentage;
      if (initialMetrics.interactions && Array.isArray(initialMetrics.interactions)) {
        initialPageView.interactions = initialMetrics.interactions;
      }
      if (initialMetrics.errors && Array.isArray(initialMetrics.errors) && initialMetrics.errors.length > 0) {
        initialPageView.errorLogs = initialMetrics.errors;
      }

      const visitorLog = await VisitorLog.create({
        fingerprint,
        ip,
        device,
        browser: browserInfo.name,
        browserVersion: browserInfo.version,
        os,
        deviceType,
        location,
        userAgent,
        cookiePreferences: cookiePreferences || {
          necessary: true,
          analytics: false,
          marketing: false,
          functional: false
        },
        visitDate,
        referrer: referrer || 'Direct',
        page: page || '/',
        source: source || 'Unknown',
        // Advanced Tracking
        pageViews: [initialPageView],
        sessionStart: new Date(),
        lastActive: new Date(),
        utm: utm || {}
      });

      // Notify if errors present on creation
      if (initialMetrics.errors && Array.isArray(initialMetrics.errors) && initialMetrics.errors.length > 0) {
        await notifyAdminsOfErrors(initialMetrics.errors, visitorLog, page, userInfo, req);
      }

      return res.status(201).json({
        success: true,
        message: 'Visitor tracked successfully',
        visitor: {
          id: visitorLog._id,
          device: visitorLog.device,
          location: visitorLog.location
        }
      });
    } catch (error) {
      // If duplicate (visitor already tracked today), update preferences and device info
      if (error.code === 11000) {
        let retries = 3;
        while (retries > 0) {
          try {
            // Find the existing visitor first to check for duplicate page views
            const existingVisitor = await VisitorLog.findOne({ fingerprint, visitDate });

            if (!existingVisitor) {
              // This is rare: it was there, then gone in a split second
              return res.status(200).json({ success: true });
            }

            // Always update lastActive and device info
            existingVisitor.device = device;
            existingVisitor.browser = browserInfo.name;
            existingVisitor.browserVersion = browserInfo.version;
            existingVisitor.os = os;
            existingVisitor.deviceType = deviceType;
            existingVisitor.lastActive = new Date();
            existingVisitor.timestamp = new Date(); // Update last seen

            if (cookiePreferences) {
              existingVisitor.cookiePreferences = cookiePreferences;
            }

            // Handle Page View Logic first if it's a pageview request
            if (type === 'pageview' && page && type !== 'heartbeat') {
              const lastPage = existingVisitor.pageViews[existingVisitor.pageViews.length - 1];
              if (!lastPage || lastPage.path !== page) {
                existingVisitor.pageViews.push({
                  path: page,
                  title: '',
                  timestamp: new Date(),
                  scrollPercentage: 0,
                  loadTime: req.body.metrics?.loadTime || 0
                });
                existingVisitor.page = page;
              }
            }

            // Handle Metrics Update (Scroll/Load Time/Interactions/Errors)
            if (req.body.metrics) {
              const metrics = req.body.metrics;
              // Find the most relevant page to attach metrics to
              // Try to find exact match in recent history (looping backwards manually to avoid slice().reverse())
              let targetPage = null;
              for (let i = existingVisitor.pageViews.length - 1; i >= 0; i--) {
                if (existingVisitor.pageViews[i].path === page) {
                  targetPage = existingVisitor.pageViews[i];
                  break;
                }
              }
              if (!targetPage) targetPage = existingVisitor.pageViews[existingVisitor.pageViews.length - 1];
              if (targetPage) {
                // Update scroll depth only if it's deeper
                if (metrics.scrollPercentage && metrics.scrollPercentage > (targetPage.scrollPercentage || 0)) {
                  targetPage.scrollPercentage = metrics.scrollPercentage;
                }

                // Set load time if not already set or if provided
                if (metrics.loadTime && metrics.loadTime > 0) {
                  targetPage.loadTime = metrics.loadTime;
                }

                // Append interactions
                if (metrics.interactions && Array.isArray(metrics.interactions)) {
                  if (!targetPage.interactions) targetPage.interactions = [];
                  metrics.interactions.forEach(i => targetPage.interactions.push(i));
                }

                // Append and Notify Errors
                if (metrics.errors && Array.isArray(metrics.errors) && metrics.errors.length > 0) {
                  if (!targetPage.errorLogs) targetPage.errorLogs = [];
                  metrics.errors.forEach(e => targetPage.errorLogs.push(e));

                  // Notify Admins
                  await notifyAdminsOfErrors(metrics.errors, existingVisitor, page, userInfo, req);
                }
              } else if (metrics.errors && Array.isArray(metrics.errors) && metrics.errors.length > 0) {
                // Fallback: Notify even if no page view was found
                await notifyAdminsOfErrors(metrics.errors, existingVisitor, page, userInfo, req);
              }
            }

            // Perform the update using updateOne to avoid Mongoose versioning conflicts (save() uses __v)
            const updateResult = await VisitorLog.updateOne(
              { _id: existingVisitor._id },
              {
                $set: {
                  device: existingVisitor.device,
                  browser: existingVisitor.browser,
                  browserVersion: existingVisitor.browserVersion,
                  os: existingVisitor.os,
                  deviceType: existingVisitor.deviceType,
                  lastActive: existingVisitor.lastActive,
                  timestamp: existingVisitor.timestamp,
                  cookiePreferences: existingVisitor.cookiePreferences,
                  page: existingVisitor.page,
                  pageViews: existingVisitor.pageViews // We still update the whole array for complex logic, but updateOne won't check __v
                }
              }
            );

            if (updateResult.matchedCount === 0) {
              // Document was likely deleted, retry
              retries--;
              continue;
            }

            return res.status(200).json({
              success: true,
              message: 'Visitor updated'
            });
          } catch (saveError) {
            // VersionError should be much less likely with updateOne, but handle general conflicts
            if ((saveError.name === 'VersionError' || saveError.code === 11000) && retries > 1) {
              retries--;
              await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
              continue;
            }
            throw saveError;
          }
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error tracking visitor:', error);
    next(error);
  }
};

// Get daily visitor count for public access
export const getDailyVisitorCount = async (req, res, next) => {
  try {
    const today = getStartOfDay();

    // Run both counts in parallel for performance
    const [count, total] = await Promise.all([
      VisitorLog.countDocuments({ visitDate: today }),
      VisitorLog.countDocuments({})
    ]);

    res.status(200).json({
      success: true,
      count,
      total,
      date: today.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error getting daily visitor count:', error);
    next(error);
  }
};

// Get visitor statistics for admin (filtered)
export const getVisitorStats = async (req, res, next) => {
  try {
    const {
      days = 30,
      dateRange = 'today',
      device = 'all',
      location = 'all',
      search = '',
      analytics = 'any',
      marketing = 'any',
      functional = 'any'
    } = req.query;

    // 1. Build Base Filter (Non-Date)
    const baseFilter = {};
    if (device !== 'all') baseFilter.device = { $regex: device, $options: 'i' };
    if (location !== 'all') baseFilter.location = { $regex: location, $options: 'i' };
    if (search) {
      baseFilter.$or = [
        { ip: { $regex: search, $options: 'i' } },
        { fingerprint: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { device: { $regex: search, $options: 'i' } }
      ];
    }
    const consent = {};
    if (analytics !== 'any') consent['cookiePreferences.analytics'] = analytics === 'true';
    if (marketing !== 'any') consent['cookiePreferences.marketing'] = marketing === 'true';
    if (functional !== 'any') consent['cookiePreferences.functional'] = functional === 'true';
    Object.assign(baseFilter, consent);

    // 2. Build Date Filter for Aggregates (Devices, Locations, Summary Counts)
    const dateFilter = {};
    const today = getStartOfDay();
    switch (dateRange) {
      case 'today':
        dateFilter.visitDate = today;
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFilter.visitDate = yesterday;
        break;
      }
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        dateFilter.visitDate = { $gte: sevenDaysAgo };
        break;
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter.visitDate = { $gte: thirtyDaysAgo };
        break;
      case 'all':
      default:
        // No date constraint
        break;
    }

    const fullFilter = { ...baseFilter, ...dateFilter };

    // 3. Execute Queries

    // Total filtered visitors (for the "Visitors" card, usually total in range)
    // Note: The UI shows "Visitors" (Total) and "Today" (Today).
    // If filters are active, "Visitors" should probably match the filter count.
    const totalVisitors = await VisitorLog.countDocuments(fullFilter);

    // Today's count (Filtered)
    // If dateRange is NOT today, this might be 0 or irrelevant, but UI expects it.
    // We'll calculate "Count in Range" as "totalVisitors".
    // But let's keep "todayCount" specifically for Today matching the base filters?
    // Actually, if I filter "Yesterday", "todayCount" should be 0? Or should "todayCount" always be TODAY's count matching base filters?
    // Let's make "todayCount" represent the count matching BASE filters + Today.
    const todayCount = await VisitorLog.countDocuments({ ...baseFilter, visitDate: today });


    // Daily Stats (Graph) - Match Base Filter + Last N Days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    daysAgo.setHours(0, 0, 0, 0);

    const dailyStats = await VisitorLog.aggregate([
      {
        $match: {
          ...baseFilter, // Apply device/location/search filters
          visitDate: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: '$visitDate',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1
        }
      }
    ]);

    // Device Breakdown - Apply FULL filter (including Date Range)
    const deviceStats = await VisitorLog.aggregate([
      { $match: fullFilter },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $project: { _id: 0, device: '$_id', count: 1 } },
      { $sort: { count: -1 } } // Sort by count desc
    ]);

    // Location Breakdown - Apply FULL filter
    const locationStats = await VisitorLog.aggregate([
      { $match: fullFilter },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, location: '$_id', count: 1 } }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalVisitors, // Filtered Total
        todayCount,    // Today's count (matching base filters)
        dailyStats,    // Graph Data (Base Filter + 30 Days)
        deviceStats,   // Filtered Breakdown
        locationStats  // Filtered Breakdown
      }
    });
  } catch (error) {
    console.error('Error getting visitor stats:', error);
    next(error);
  }
};

// Get all visitors with pagination (admin only)
export const getAllVisitors = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      dateRange = 'today',
      device = 'all',
      location = 'all',
      search = '',
      referrer = 'all',
      source = 'all',
      utm_source = 'all',
      utm_campaign = 'all',
      utm_medium = 'all',
      utm_term = 'all',
      // New optional consent filters: 'any' | 'true' | 'false'
      analytics = 'any',
      marketing = 'any',
      functional = 'any'
    } = req.query;

    // Build filter
    let filter = {};

    // Date range filter
    const today = getStartOfDay();
    switch (dateRange) {
      case 'today':
        filter.visitDate = today;
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        filter.visitDate = yesterday;
        break;
      }
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filter.visitDate = { $gte: sevenDaysAgo };
        break;
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filter.visitDate = { $gte: thirtyDaysAgo };
        break;
      case 'all':
      default:
        // No preset date filter
        break;
    }

    // Custom Date Range Support (overrides preset if provided)
    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.visitDate = { $gte: start, $lte: end };
    }

    // Device filter
    if (device !== 'all') {
      filter.device = { $regex: device, $options: 'i' };
    }

    // Location filter
    if (location !== 'all') {
      filter.location = { $regex: location, $options: 'i' };
    }

    // New acquisition filters
    if (referrer !== 'all') {
      filter.referrer = { $regex: referrer, $options: 'i' };
    }
    if (source !== 'all') {
      filter.source = { $regex: source, $options: 'i' };
    }
    if (utm_source !== 'all') {
      filter["utm.source"] = { $regex: utm_source, $options: 'i' };
    }
    if (utm_campaign !== 'all') {
      filter["utm.campaign"] = { $regex: utm_campaign, $options: 'i' };
    }
    if (utm_medium !== 'all') {
      filter["utm.medium"] = { $regex: utm_medium, $options: 'i' };
    }
    if (utm_term !== 'all') {
      filter["utm.term"] = { $regex: utm_term, $options: 'i' };
    }

    // Search filter
    if (search) {
      filter.$or = [
        { ip: { $regex: search, $options: 'i' } },
        { fingerprint: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { device: { $regex: search, $options: 'i' } },
        { referrer: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
        { "utm.source": { $regex: search, $options: 'i' } }
      ];
    }

    // Consent filters
    const consent = {};
    if (analytics !== 'any') consent['cookiePreferences.analytics'] = analytics === 'true';
    if (marketing !== 'any') consent['cookiePreferences.marketing'] = marketing === 'true';
    if (functional !== 'any') consent['cookiePreferences.functional'] = functional === 'true';
    Object.assign(filter, consent);

    // Get total count
    const total = await VisitorLog.countDocuments(filter);

    // Get visitors with pagination
    const skip = (page - 1) * limit;
    const visitors = await VisitorLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-fingerprint'); // Exclude only fingerprint, keep userAgent for admin debugging

    res.status(200).json({
      success: true,
      visitors,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error getting visitors:', error);
    next(error);
  }
};

// Clear old visitor logs (admin only) - keep last 90 days
export const clearOldVisitorLogs = async (req, res, next) => {
  try {
    const { days = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    cutoffDate.setHours(0, 0, 0, 0);

    const result = await VisitorLog.deleteMany({
      visitDate: { $lt: cutoffDate }
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} old visitor logs`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing old visitor logs:', error);
    next(error);
  }
};

// Get all client errors across all visitors (admin only)
export const getClientErrors = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', dateRange = 'all', browser, os, deviceType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build match stage for date filter
    const matchStage = {
      'pageViews': {
        $elemMatch: {
          'errorLogs.0': { $exists: true }
        }
      }
    };

    if (browser && browser !== 'all') matchStage.browser = { $regex: browser, $options: 'i' };
    if (os && os !== 'all') matchStage.os = { $regex: os, $options: 'i' };
    if (deviceType && deviceType !== 'all') matchStage.deviceType = { $regex: deviceType, $options: 'i' };

    if (dateRange !== 'all') {
      const today = getStartOfDay();
      if (dateRange === 'today') {
        matchStage.visitDate = today;
      } else if (dateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        matchStage.visitDate = yesterday;
      } else if (dateRange === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        matchStage.visitDate = { $gte: sevenDaysAgo };
      }
    }

    // Aggregation to flatten error logs and include visitor context
    const pipeline = [
      { $match: matchStage },
      { $addFields: { pageCount: { $size: '$pageViews' } } },
      { $unwind: '$pageViews' },
      { $unwind: '$pageViews.errorLogs' },
      {
        $project: {
          _id: 0,
          id: '$pageViews.errorLogs._id',
          message: '$pageViews.errorLogs.message',
          source: '$pageViews.errorLogs.source',
          stack: '$pageViews.errorLogs.stack',
          timestamp: '$pageViews.errorLogs.timestamp',
          path: '$pageViews.path',
          visitorId: '$_id',
          ip: 1,
          userAgent: 1,
          location: 1,
          device: 1,
          browser: 1,
          os: 1,
          deviceType: 1,
          pageCount: 1,
          sessionStart: 1,
          lastActive: 1,
          referrer: 1,
          visitorSource: '$source',
          utm: 1
        }
      },
      { $sort: { timestamp: -1 } }
    ];

    // Apply search if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { message: { $regex: search, $options: 'i' } },
            { path: { $regex: search, $options: 'i' } },
            { ip: { $regex: search, $options: 'i' } },
            { source: { $regex: search, $options: 'i' } },
            { browser: { $regex: search, $options: 'i' } },
            { os: { $regex: search, $options: 'i' } },
            { device: { $regex: search, $options: 'i' } },
            { deviceType: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Count total matches (for pagination)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await VisitorLog.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Apply pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const errors = await VisitorLog.aggregate(pipeline);

    res.status(200).json({
      success: true,
      errors,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error getting client errors:', error);
    next(error);
  }
};

// Get single visitor by ID (admin only)
export const getVisitorById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const visitor = await VisitorLog.findById(id);

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: 'Visitor not found'
      });
    }

    res.status(200).json({
      success: true,
      visitor
    });
  } catch (error) {
    console.error('Error fetching visitor details:', error);
    next(error);
  }
};

// Get marketing and referral statistics (Sponsor Intelligence)
export const getMarketingStats = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    cutoffDate.setHours(0, 0, 0, 0);

    // Filter for logs with UTM data or non-direct referrers
    const matchStage = {
      visitDate: { $gte: cutoffDate }
    };

    const marketingStats = await VisitorLog.aggregate([
      { $match: matchStage },
      {
        $facet: {
          // Breakdown by Source
          sources: [
            {
              $group: {
                _id: { $ifNull: ["$utm.source", "Direct/Static"] },
                count: { $sum: 1 },
                avgPageViews: { $avg: { $size: { $ifNull: ["$pageViews", []] } } },
                avgDuration: { $avg: { $subtract: [{ $ifNull: ["$lastActive", "$sessionStart"] }, "$sessionStart"] } }
              }
            },
            { $sort: { count: -1 } }
          ],
          // Breakdown by Medium
          mediums: [
            {
              $group: {
                _id: { $ifNull: ["$utm.medium", "None"] },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ],
          // Breakdown by Campaign
          campaigns: [
            {
              $group: {
                _id: { $ifNull: ["$utm.campaign", "None"] },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ],
          // Top Referring Domains (from referrer string)
          referrers: [
            { $match: { referrer: { $exists: true, $ne: 'Direct' } } },
            {
              $group: {
                _id: "$referrer",
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: marketingStats[0]
    });
  } catch (error) {
    console.error('Error getting marketing stats:', error);
    next(error);
  }
};
