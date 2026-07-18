import express from 'express';
import { verifyToken } from '../utils/verify.js';
import {
  getUserActiveSessions,
  revokeSessionFromDB,
  revokeAllUserSessionsFromDB,
  revokeAllOtherUserSessionsFromDB,
  logSessionAction,
  updateSessionActivityInDB,
  getDeviceInfo,
  getLocationFromIP
} from '../utils/sessionManager.js';
import User from '../models/user.model.js';
import SessionAuditLog from '../models/sessionAuditLog.model.js';
import { sendForcedLogoutEmail, sendSessionRevokedEmail, sendAllSessionsRevokedEmail } from '../utils/emailService.js';

const router = express.Router();

// Get user's own active sessions (Device Management)
router.get('/my-sessions', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessions = await getUserActiveSessions(userId);

    // Mark current session
    const currentSessionId = req.headers['x-session-id'] || req.cookies.session_id;
    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      isCurrent: session.sessionId === currentSessionId
    }));

    res.json({
      success: true,
      sessions: sessionsWithCurrent,
      sessionLimit: req.user.role === 'user' ? 5 : req.user.role === 'admin' ? 2 : 1
    });
  } catch (error) {
    next(error);
  }
});

// Revoke a specific session
router.post('/revoke-session', verifyToken, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user._id;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    // Check if session belongs to user
    const user = await User.findById(userId);
    const sessionToRevoke = user.activeSessions.find(s => s.sessionId === sessionId);

    if (!sessionToRevoke) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Revoke session
    await revokeSessionFromDB(userId, sessionId, req.app.get('io'));

    // Log action
    await logSessionAction(
      userId,
      'logout',
      sessionId,
      req.ip,
      getDeviceInfo(req.get('User-Agent'), req.headers),
      getLocationFromIP(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip),
      'User revoked session'
    );

    // Send notification email
    if (sessionToRevoke) {
      await sendSessionRevokedEmail(
        user.email,
        sessionToRevoke.device,
        sessionToRevoke.ip,
        sessionToRevoke.location,
        sessionToRevoke.lastActive || sessionToRevoke.loginTime
      );
    }

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    next(error);
  }
});

// Revoke all other sessions (keep current)
router.post('/revoke-all-sessions', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const currentSessionId = req.headers['x-session-id'] || req.cookies.session_id;
    const { count: sessionCount, revokedSessionIds } = await revokeAllOtherUserSessionsFromDB(userId, currentSessionId, req.app.get('io'));

    // Fetch user for email
    const user = await User.findById(userId).select('email');

    // Log action
    await logSessionAction(
      userId,
      'logout',
      'others',
      req.ip,
      getDeviceInfo(req.get('User-Agent'), req.headers),
      getLocationFromIP(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip),
      `User revoked ${sessionCount} other session(s)`
    );



    // Send email notification
    if (user && sessionCount > 0) {
      await sendAllSessionsRevokedEmail(user.email, sessionCount);
    }

    res.json({
      success: true,
      message: `Logged out ${sessionCount} other device(s)`
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Get all user sessions (Session Management)
router.get('/admin/all-sessions', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const {
      page = 1,
      limit = 20,
      role = 'all',
      search = '',
      device = 'all',
      location = 'all',
      dateRange = 'all'
    } = req.query;

    let userFilter = {};
    if (role !== 'all') {
      userFilter.role = role;
    }

    // NOTE: Search is NOT applied at the MongoDB level because the search
    // also targets session-level fields (device, IP, location) that live
    // inside each user's activeSessions subdocument. Filtering users by
    // username/email here would silently exclude users whose sessions
    // match by device/IP/location. The session-level filter below (line ~188)
    // handles all searchable fields correctly.

    // Get all users first (we'll filter sessions after)
    const users = await User.find(userFilter)
      .select('username email role activeSessions');

    let sessionsWithUserInfo = [];
    users.forEach(user => {
      if (user.activeSessions && user.activeSessions.length > 0) {
        user.activeSessions.forEach(session => {
          // Restriction: Admins (non-root) cannot see sessions of rootadmins
          if (req.user.role !== 'rootadmin' && user.role === 'rootadmin') {
            return;
          }

          sessionsWithUserInfo.push({
            sessionId: session.sessionId,
            userId: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            ip: session.ip,
            device: session.device,
            location: session.location,
            loginTime: session.loginTime,
            lastActive: session.lastActive
          });
        });
      }
    });

    // Apply session-level filters
    if (search) {
      const searchLower = search.toLowerCase();
      sessionsWithUserInfo = sessionsWithUserInfo.filter(session =>
        session.username.toLowerCase().includes(searchLower) ||
        session.email.toLowerCase().includes(searchLower) ||
        session.device.toLowerCase().includes(searchLower) ||
        session.ip.includes(search) ||
        session.location.toLowerCase().includes(searchLower)
      );
    }

    if (device !== 'all') {
      sessionsWithUserInfo = sessionsWithUserInfo.filter(session => {
        const deviceLower = session.device.toLowerCase();
        const isAppSession = deviceLower.includes('urbansetu app') || deviceLower.includes('urban setu mobile app');
        switch (device) {
          case 'urban setu mobile app':
            return isAppSession;
          case 'mobile':
            return !isAppSession && (deviceLower.includes('mobile') || deviceLower.includes('android') || deviceLower.includes('iphone'));
          case 'desktop':
            return !isAppSession && (deviceLower.includes('windows') || deviceLower.includes('mac') || deviceLower.includes('linux') || deviceLower.includes('desktop'));
          case 'tablet':
            return deviceLower.includes('tablet') || deviceLower.includes('ipad');
          default:
            return true;
        }
      });
    }

    if (location !== 'all') {
      sessionsWithUserInfo = sessionsWithUserInfo.filter(session =>
        session.location && session.location.toLowerCase().includes(location.toLowerCase())
      );
    }

    if (dateRange !== 'all') {
      const now = new Date();
      let cutoffDate;

      switch (dateRange) {
        case '1h':
          cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = null;
      }

      if (cutoffDate) {
        sessionsWithUserInfo = sessionsWithUserInfo.filter(session =>
          new Date(session.lastActive) >= cutoffDate
        );
      }
    }

    // Sort by last active (most recent first)
    sessionsWithUserInfo.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

    // Apply pagination
    const total = sessionsWithUserInfo.length;
    const skip = (page - 1) * limit;
    const paginatedSessions = sessionsWithUserInfo.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      sessions: paginatedSessions,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Force logout user session
router.post('/admin/force-logout', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { userId, sessionId, reason = 'Admin action' } = req.body;

    if (!userId || !sessionId) {
      return res.status(400).json({ success: false, message: 'User ID and Session ID are required' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Restriction: Admins (non-root) cannot force logout other admins or rootadmins
    if (req.user.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Admins cannot perform this action on other administrators' });
    }

    // Check if session exists
    const sessionExists = targetUser.activeSessions.some(s => s.sessionId === sessionId);
    if (!sessionExists) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Revoke session
    await revokeSessionFromDB(userId, sessionId, req.app.get('io'));

    // Send notification email
    await sendForcedLogoutEmail(
      targetUser.email,
      reason,
      `${req.user.username} (${req.user.role})`
    );

    // Log action
    await logSessionAction(
      userId,
      'forced_logout',
      sessionId,
      req.ip,
      getDeviceInfo(req.get('User-Agent'), req.headers),
      getLocationFromIP(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip),
      `Forced logout by ${req.user.username}: ${reason}`,
      false,
      null,
      req.user._id
    );

    res.json({ success: true, message: 'Session force logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Admin: Force logout all user sessions
router.post('/admin/force-logout-all', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { userId, reason = 'Admin action' } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Restriction: Admins (non-root) cannot force logout other admins or rootadmins
    if (req.user.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'rootadmin')) {
      return res.status(403).json({ success: false, message: 'Admins cannot perform this action on other administrators' });
    }

    const sessionCount = await revokeAllUserSessionsFromDB(userId, req.app.get('io'));

    // Send notification email
    await sendForcedLogoutEmail(
      targetUser.email,
      reason,
      `${req.user.username} (${req.user.role})`
    );

    // Log action
    await logSessionAction(
      userId,
      'forced_logout',
      'all',
      req.ip,
      getDeviceInfo(req.get('User-Agent'), req.headers),
      getLocationFromIP(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip),
      `Forced logout all sessions by ${req.user.username}: ${reason}`,
      false,
      null,
      req.user._id
    );

    res.json({
      success: true,
      message: `All ${sessionCount} sessions force logged out successfully`
    });
  } catch (error) {
    next(error);
  }
});

// Root Admin: Get session audit logs
router.get('/admin/audit-logs', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'rootadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const {
      page = 1,
      limit = 50,
      action,
      isSuspicious,
      userId,
      search = '',
      dateRange = 'all',
      startDate,
      endDate
    } = req.query;

    let role = req.query.role || 'all';

    // Restrict standard admins to only see 'user' logs (exclude admin & rootadmin logs)
    if (req.user.role === 'admin') {
      role = 'user';
    }

    let filter = {};
    if (req.user.role === 'admin') {
      filter.role = 'user';
    } else if (role !== 'all') {
      filter.role = role;
    }

    if (action) filter.action = action;
    if (isSuspicious !== undefined && isSuspicious !== '') filter.isSuspicious = isSuspicious === 'true';
    if (userId) {
      // Validate ObjectId-like string (24 hex chars) to avoid CastError on each keystroke
      const isObjectIdLike = /^[a-fA-F0-9]{24}$/.test(String(userId));
      if (isObjectIdLike) {
        filter.userId = userId;
      } else {
        // If not a valid ObjectId yet, return empty result early to avoid DB error
        return res.json({ success: true, logs: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      }
    }

    // Date range filter
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (dateRange !== 'all') {
      const now = new Date();
      let cutoffDate;

      switch (dateRange) {
        case '1h':
          cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = null;
      }

      if (cutoffDate) {
        filter.timestamp = { $gte: cutoffDate };
      }
    }

    // Get logs with population
    let logs = await SessionAuditLog.find(filter)
      .populate('userId', 'username email role')
      .populate('performedBy', 'username email role')
      .sort({ timestamp: -1 });

    // Apply search filter after population
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log => {
        const user = log.userId;
        const performedBy = log.performedBy;
        return (
          (user && (
            user.username?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower)
          )) ||
          (performedBy && (
            performedBy.username?.toLowerCase().includes(searchLower) ||
            performedBy.email?.toLowerCase().includes(searchLower)
          )) ||
          log.device?.toLowerCase().includes(searchLower) ||
          log.ip?.includes(search) ||
          log.location?.toLowerCase().includes(searchLower) ||
          log.details?.toLowerCase().includes(searchLower) ||
          log.action?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply role filter after population
    if (role !== 'all') {
      logs = logs.filter(log => {
        const user = log.userId;
        return user && user.role === role;
      });
    }

    // Apply pagination
    const total = logs.length;
    const skip = (page - 1) * limit;
    const paginatedLogs = logs.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      logs: paginatedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
});

// Root Admin: Clear all session audit logs
router.delete('/admin/audit-logs', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'rootadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { action, isSuspicious, userId } = req.query;

    // Optional scoped deletion via query (defaults to ALL)
    const filter = {};
    if (action) filter.action = action;
    if (isSuspicious !== undefined && isSuspicious !== '') {
      filter.isSuspicious = isSuspicious === 'true';
    }
    if (userId) {
      const isObjectIdLike = /^[a-fA-F0-9]{24}$/.test(String(userId));
      if (isObjectIdLike) {
        filter.userId = userId;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }
    }

    const result = await SessionAuditLog.deleteMany(filter);

    return res.json({
      success: true,
      message: `Deleted ${result.deletedCount || 0} audit log(s)`
    });
  } catch (error) {
    next(error);
  }
});

// Update session activity (called on each request)
router.post('/update-activity', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.headers['x-session-id'] || req.cookies.session_id;

    if (sessionId) {
      await updateSessionActivityInDB(userId, sessionId);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;