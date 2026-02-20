import jwt from 'jsonwebtoken';
import geoip from 'geoip-lite';
import { generateTokenPair } from './jwtUtils.js';
import User from '../models/user.model.js';
import SessionAuditLog from '../models/sessionAuditLog.model.js';

// Store for active sessions (in production, use Redis)
const activeSessions = new Map();

// Clean up expired sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
        if (now > session.expiresAt) {
            activeSessions.delete(sessionId);
        }
    }
}, 5 * 60 * 1000);

// Create a new session
export const createSession = (userId, req) => {
    const sessionId = jwt.sign(
        {
            userId,
            type: 'session',
            timestamp: Date.now()
        },
        process.env.JWT_TOKEN,
        { expiresIn: '7d' }
    );

    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const session = {
        sessionId,
        userId,
        ip,
        userAgent,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        lastActivity: Date.now(),
        isActive: true
    };

    activeSessions.set(sessionId, session);

    return session;
};

// Get user's active sessions
export const getUserSessions = (userId) => {
    const userSessions = [];
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId && session.isActive) {
            userSessions.push({
                sessionId,
                ip: session.ip,
                userAgent: session.userAgent,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                isCurrent: false // Will be set by caller
            });
        }
    }
    return userSessions;
};

// Update session activity
export const updateSessionActivity = (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (session) {
        session.lastActivity = Date.now();
        activeSessions.set(sessionId, session);
    }
};

// Revoke a session
export const revokeSession = (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (session) {
        session.isActive = false;
        activeSessions.set(sessionId, session);
        return true;
    }
    return false;
};

// Revoke all sessions for a user
export const revokeAllUserSessions = (userId) => {
    let revokedCount = 0;
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId && session.isActive) {
            session.isActive = false;
            activeSessions.set(sessionId, session);
            revokedCount++;
        }
    }
    return revokedCount;
};

// Check if session is valid
export const isSessionValid = (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (!session || !session.isActive) return false;

    const now = Date.now();
    if (now > session.expiresAt) {
        activeSessions.delete(sessionId);
        return false;
    }

    return true;
};

// Get session info
export const getSessionInfo = (sessionId) => {
    return activeSessions.get(sessionId);
};

// Detect concurrent logins
export const detectConcurrentLogins = (userId, currentSessionId) => {
    const userSessions = getUserSessions(userId);
    const activeSessions = userSessions.filter(s => s.sessionId !== currentSessionId);

    if (activeSessions.length > 0) {
        return {
            hasConcurrentLogins: true,
            activeSessions: activeSessions.length,
            sessions: activeSessions
        };
    }

    return {
        hasConcurrentLogins: false,
        activeSessions: 0,
        sessions: []
    };
};

// Role-based session limits
const SESSION_LIMITS = {
    user: 5,
    admin: 2,
    rootadmin: 1
};

// Get detailed browser info from user agent
export const getBrowserInfo = (userAgent) => {
    if (!userAgent) return { name: 'Unknown', version: '' };

    let browserName = 'Unknown';
    let browserVersion = '';

    // Detect browser (order matters - check specific browsers first, then generic ones)
    // Check for specific Chromium-based browsers first (before Chrome)
    if (userAgent.includes('Brave/') || userAgent.includes('Brave')) {
        browserName = 'Brave';
        browserVersion = userAgent.match(/Brave\/(\d+)/)?.[1] || userAgent.match(/Chrome\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Vivaldi/')) {
        browserName = 'Vivaldi';
        browserVersion = userAgent.match(/Vivaldi\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Arc/')) {
        browserName = 'Arc';
        browserVersion = userAgent.match(/Arc\/(\d+)/)?.[1] || userAgent.match(/Chrome\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('SamsungBrowser/')) {
        browserName = 'Samsung Internet';
        browserVersion = userAgent.match(/SamsungBrowser\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('UCBrowser/')) {
        browserName = 'UC Browser';
        browserVersion = userAgent.match(/UCBrowser\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('YaBrowser/')) {
        browserName = 'Yandex Browser';
        browserVersion = userAgent.match(/YaBrowser\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('QQBrowser/')) {
        browserName = 'QQ Browser';
        browserVersion = userAgent.match(/QQBrowser\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Maxthon/')) {
        browserName = 'Maxthon';
        browserVersion = userAgent.match(/Maxthon\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('DuckDuckGo/')) {
        browserName = 'DuckDuckGo';
        browserVersion = userAgent.match(/DuckDuckGo\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Whale/')) {
        browserName = 'Naver Whale';
        browserVersion = userAgent.match(/Whale\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Sleipnir/')) {
        browserName = 'Sleipnir';
        browserVersion = userAgent.match(/Sleipnir\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Silk/')) {
        browserName = 'Amazon Silk';
        browserVersion = userAgent.match(/Silk\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Puffin/')) {
        browserName = 'Puffin';
        browserVersion = userAgent.match(/Puffin\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Chromium/')) {
        browserName = 'Chromium';
        browserVersion = userAgent.match(/Chromium\/(\d+)/)?.[1] || '';
        // Check for mainstream browsers (Microsoft Edge before Chrome)
    } else if (userAgent.includes('Edg/')) {
        browserName = 'Edge';
        browserVersion = userAgent.match(/Edg\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
        browserName = 'Opera';
        browserVersion = userAgent.match(/(?:OPR|Opera)\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Firefox/')) {
        browserName = 'Firefox';
        browserVersion = userAgent.match(/Firefox\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('FxiOS/')) {
        browserName = 'Firefox iOS';
        browserVersion = userAgent.match(/FxiOS\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('CriOS/')) {
        browserName = 'Chrome iOS';
        browserVersion = userAgent.match(/CriOS\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('EdgiOS/')) {
        browserName = 'Edge iOS';
        browserVersion = userAgent.match(/EdgiOS\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium')) {
        browserName = 'Chrome';
        browserVersion = userAgent.match(/Chrome\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
        browserName = 'Safari';
        browserVersion = userAgent.match(/Version\/(\d+)/)?.[1] || '';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
        browserName = 'Internet Explorer';
        browserVersion = userAgent.match(/(?:MSIE |rv:)(\d+)/)?.[1] || '';
    }

    return { name: browserName, version: browserVersion };
};

// Get operating system from user agent
export const getOSInfo = (userAgent) => {
    if (!userAgent) return 'Unknown';

    if (userAgent.includes('Windows NT 10.0')) return 'Windows 10/11';
    if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1';
    if (userAgent.includes('Windows NT 6.2')) return 'Windows 8';
    if (userAgent.includes('Windows NT 6.1')) return 'Windows 7';
    if (userAgent.includes('Windows')) return 'Windows';

    if (userAgent.includes('Mac OS X')) {
        const version = userAgent.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
        return version ? `macOS ${version}` : 'macOS';
    }

    if (userAgent.includes('Android')) {
        const version = userAgent.match(/Android (\d+\.?\d*)/)?.[1] || '';
        return version ? `Android ${version}` : 'Android';
    }

    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        const version = userAgent.match(/OS (\d+_\d+)/)?.[1]?.replace('_', '.') || '';
        return version ? `iOS ${version}` : 'iOS';
    }

    if (userAgent.includes('Turbo/')) return 'UrbanSetu Mobile';
    if (userAgent.includes('UrbanSetu/')) return 'UrbanSetu Mobile';

    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('CrOS')) return 'Chrome OS';

    return 'Unknown';
};

// Get device type from user agent
export const getDeviceType = (userAgent, headers = {}) => {
    // Priority 1: Explicit header from mobile/desktop apps
    const platform = headers['x-client-platform'] || headers['X-Client-Platform'];
    if (platform === 'mobile' || platform === 'UrbanSetu-Mobile') return 'Mobile App';
    if (platform === 'desktop-app') return 'Desktop App';

    if (!userAgent) return 'Unknown';

    // Priority 2: Custom User-Agent strings
    if (userAgent.includes('UrbanSetu/')) return 'Mobile App';

    // Priority 3: Standard pattern detection
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
        return 'Mobile';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        return 'Tablet';
    } else {
        return 'Desktop';
    }
};

// Get device info from user agent (keeping for backward compatibility)
export const getDeviceInfo = (userAgent, headers = {}) => {
    if (!userAgent && !headers['x-client-platform']) return 'Unknown Device';

    const platform = headers['x-client-platform'] || headers['X-Client-Platform'];
    const isMobileApp = platform === 'mobile' || platform === 'UrbanSetu-Mobile' || (userAgent && userAgent.includes('UrbanSetu/'));

    const browser = getBrowserInfo(userAgent);
    const os = getOSInfo(userAgent);
    const deviceType = getDeviceType(userAgent, headers);

    if (isMobileApp) {
        return `UrbanSetu Mobile App on ${os === 'Unknown' ? 'Mobile' : os}`;
    }

    // Format: "Chrome 120 on Windows 10/11 (Desktop)"
    let deviceInfo = '';
    if (browser.name !== 'Unknown') {
        deviceInfo = browser.version ? `${browser.name} ${browser.version}` : browser.name;
    }
    if (os !== 'Unknown') {
        deviceInfo = deviceInfo ? `${deviceInfo} on ${os}` : os;
    }
    if (deviceType !== 'Unknown') {
        deviceInfo = deviceInfo ? `${deviceInfo} (${deviceType})` : deviceType;
    }

    return deviceInfo || 'Unknown Device';
};

// Get location from IP (simplified - in production use a proper geo service)
// Get location from IP using GeoIP
export const getLocationFromIP = (ip) => {
    try {
        if (!ip) return 'Unknown';
        if (ip === '127.0.0.1' || ip === '::1') return 'Local Development';

        const pureIp = String(ip).split(',')[0].trim();

        if (pureIp.startsWith('10.') || pureIp.startsWith('192.168.') || pureIp.startsWith('172.16.') || pureIp.startsWith('172.31.')) {
            return 'Private Network';
        }

        const geo = geoip.lookup(pureIp);
        if (geo) {
            const parts = [];
            if (geo.city) parts.push(geo.city);
            if (geo.region) parts.push(geo.region);
            if (geo.country) parts.push(geo.country);
            return parts.join(', ');
        }

        return 'Unknown';
    } catch (e) {
        console.error('GeoIP lookup error:', e);
        return 'Unknown';
    }
};

// Get timezone from IP using GeoIP
export const getTimezoneFromIP = (ip) => {
    try {
        if (!ip || ip === '127.0.0.1' || ip === '::1') return 'Asia/Kolkata'; // Default to India for local dev

        const pureIp = String(ip).split(',')[0].trim();
        const geo = geoip.lookup(pureIp);

        return geo?.timezone || 'Asia/Kolkata';
    } catch (e) {
        console.error('GeoIP timezone error:', e);
        return 'Asia/Kolkata';
    }
};

// Create a new session with enhanced tracking
export const createEnhancedSession = async (userId, req) => {
    const sessionId = jwt.sign(
        {
            userId,
            type: 'session',
            timestamp: Date.now()
        },
        process.env.JWT_TOKEN,
        { expiresIn: '7d' }
    );

    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const device = getDeviceInfo(userAgent, req.headers);
    const location = getLocationFromIP(ip);

    const session = {
        sessionId,
        userId,
        ip,
        device,
        location,
        userAgent,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        lastActivity: Date.now(),
        isActive: true
    };

    activeSessions.set(sessionId, session);

    // Update user's active sessions in database
    await User.findByIdAndUpdate(userId, {
        $push: {
            activeSessions: {
                sessionId,
                ip,
                device,
                location,
                loginTime: new Date(),
                lastActive: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Strictly 7 days from login
            }
        },
        $set: {
            lastKnownIp: ip,
            lastKnownDevice: device
        }
    });

    return session;
};

// Check for suspicious login
export const checkSuspiciousLogin = async (userId, ip, device) => {
    const user = await User.findById(userId);
    if (!user) return { isSuspicious: false };

    const isSuspicious = (
        user.lastKnownIp && user.lastKnownIp !== ip
    ) || (
            user.lastKnownDevice && user.lastKnownDevice !== device
        );

    // Get location for previous IP
    const previousLocation = user.lastKnownIp ? getLocationFromIP(user.lastKnownIp) : 'Unknown Location';

    return {
        isSuspicious,
        reason: isSuspicious ? 'New IP or device detected' : null,
        previousIp: user.lastKnownIp,
        previousDevice: user.lastKnownDevice,
        previousLocation: previousLocation
    };
};

// Enforce role-based session limits
export const enforceSessionLimits = async (userId, userRole, io) => {
    const limit = SESSION_LIMITS[userRole] || SESSION_LIMITS.user;
    const user = await User.findById(userId);

    if (!user || !user.activeSessions) return 0;

    // Only enforce when exceeding the limit (not when equal)
    if (user.activeSessions.length > limit) {
        // Sort by lastActive ascending and remove the oldest sessions beyond the limit
        const sortedSessions = user.activeSessions.sort((a, b) =>
            new Date(a.lastActive) - new Date(b.lastActive)
        );

        const countToRemove = user.activeSessions.length - limit;
        const sessionsToRemove = sortedSessions.slice(0, countToRemove);

        // Remove from database
        const sessionIdsToRemove = sessionsToRemove.map(s => s.sessionId);
        await User.findByIdAndUpdate(userId, {
            $pull: {
                activeSessions: {
                    sessionId: { $in: sessionIdsToRemove }
                }
            }
        });

        // Remove from active sessions map and notify clients
        sessionsToRemove.forEach(session => {
            revokeSession(session.sessionId);

            // Notify client via socket if io is provided
            if (io) {
                io.to(`session_${session.sessionId}`).emit('force_logout_session', {
                    sessionId: session.sessionId,
                    reason: 'Session limit exceeded. You have been logged out on this device because you logged in on a new device.'
                });
            }
        });

        // Log session cleanup
        await SessionAuditLog.create({
            userId,
            action: 'session_cleaned',
            role: userRole,
            sessionId: 'multiple',
            ip: 'system',
            device: 'system',
            additionalInfo: `Removed ${sessionsToRemove.length} old sessions to enforce ${limit} session limit`
        });

        return sessionsToRemove.length;
    }

    return 0;
};

// Log session action
export const logSessionAction = async (userId, action, sessionId, ip, device, location, additionalInfo = null, isSuspicious = false, suspiciousReason = null, performedBy = null, metadata = {}) => {
    const user = await User.findById(userId);
    if (!user) return;

    await SessionAuditLog.create({
        userId,
        action,
        role: user.role,
        sessionId,
        ip,
        device,
        location,
        additionalInfo,
        isSuspicious,
        suspiciousReason,
        performedBy,
        metadata
    });
};

// Clean up old sessions (role-based)
export const cleanupOldSessions = async (userId, userRole) => {
    const limit = SESSION_LIMITS[userRole] || SESSION_LIMITS.user;
    const user = await User.findById(userId);

    if (!user || !user.activeSessions) return 0;

    if (user.activeSessions.length > limit) {
        // Sort by last activity and keep only the most recent
        const sortedSessions = user.activeSessions.sort((a, b) =>
            new Date(b.lastActive) - new Date(a.lastActive)
        );
        const sessionsToRevoke = sortedSessions.slice(limit);

        // Remove from database
        const sessionIdsToRemove = sessionsToRevoke.map(s => s.sessionId);
        await User.findByIdAndUpdate(userId, {
            $pull: {
                activeSessions: {
                    sessionId: { $in: sessionIdsToRemove }
                }
            }
        });

        // Remove from active sessions map
        sessionsToRevoke.forEach(session => {
            revokeSession(session.sessionId);
        });

        // Log session cleanup
        await logSessionAction(
            userId,
            'session_cleaned',
            'multiple',
            'system',
            'system',
            'system',
            `Removed ${sessionsToRevoke.length} old sessions to enforce ${limit} session limit`
        );

        return sessionsToRevoke.length;
    }

    return 0;
};

// Get user's active sessions from database
export const getUserActiveSessions = async (userId) => {
    const user = await User.findById(userId).select('activeSessions');
    if (!user || !user.activeSessions) return [];

    return user.activeSessions.map(session => ({
        sessionId: session.sessionId,
        ip: session.ip,
        device: session.device,
        location: session.location,
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        isCurrent: false // Will be set by caller
    }));
};

// Revoke session from database
export const revokeSessionFromDB = async (userId, sessionId, io) => {
    await User.findByIdAndUpdate(userId, {
        $pull: {
            activeSessions: { sessionId }
        }
    });

    // Also remove from active sessions map
    revokeSession(sessionId);

    // Notify client via socket if io is provided
    if (io) {
        io.to(`session_${sessionId}`).emit('force_logout_session', {
            sessionId,
            reason: 'Session revoked'
        });
    }
};

// Revoke all user sessions from database
export const revokeAllUserSessionsFromDB = async (userId, io) => {
    const user = await User.findById(userId);
    if (!user || !user.activeSessions) return 0;

    const sessionCount = user.activeSessions.length;
    const sessionIds = user.activeSessions.map(s => s.sessionId);

    // Clear from database
    await User.findByIdAndUpdate(userId, {
        $set: { activeSessions: [] }
    });

    // Clear from active sessions map
    user.activeSessions.forEach(session => {
        revokeSession(session.sessionId);
    });

    // Notify clients via socket if io is provided
    if (io) {
        sessionIds.forEach(sessionId => {
            io.to(`session_${sessionId}`).emit('force_logout_session', {
                sessionId,
                reason: 'All sessions revoked'
            });
        });

        // Also ensure we target the user's room just in case
        io.to(userId.toString()).emit('force_signout', {
            userId,
            message: 'All sessions revoked'
        });
    }

    return sessionCount;
};

// Revoke all other user sessions except the provided sessionId
export const revokeAllOtherUserSessionsFromDB = async (userId, keepSessionId, io) => {
    const user = await User.findById(userId);
    if (!user || !user.activeSessions) return { count: 0, revokedSessionIds: [] };

    const sessionsToRemove = user.activeSessions.filter(s => s.sessionId !== keepSessionId);
    const sessionIdsToRemove = sessionsToRemove.map(s => s.sessionId);

    if (sessionIdsToRemove.length === 0) return { count: 0, revokedSessionIds: [] };

    // Pull all except keepSessionId
    await User.findByIdAndUpdate(userId, {
        $pull: {
            activeSessions: {
                sessionId: { $in: sessionIdsToRemove }
            }
        }
    });

    // Remove from active map and notify
    sessionIdsToRemove.forEach(id => {
        revokeSession(id);
        if (io) {
            io.to(`session_${id}`).emit('force_logout_session', {
                sessionId: id,
                reason: 'All other sessions revoked'
            });
        }
    });

    return {
        count: sessionIdsToRemove.length,
        revokedSessionIds: sessionIdsToRemove
    };
};

// Update session activity in database
export const updateSessionActivityInDB = async (userId, sessionId) => {
    await User.findOneAndUpdate(
        {
            _id: userId,
            'activeSessions.sessionId': sessionId
        },
        {
            $set: {
                'activeSessions.$.lastActive': new Date()
            }
        }
    );

    // Also update in memory
    updateSessionActivity(sessionId);
};

// Automatically cleanup stale sessions for ALL users (sessions inactive for > 7 days)
export const cleanupAllStaleSessions = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
        // Find all users who have at least one session older than 7 days
        const result = await User.updateMany(
            { "activeSessions.lastActive": { $lt: sevenDaysAgo } },
            {
                $pull: {
                    activeSessions: {
                        lastActive: { $lt: sevenDaysAgo }
                    }
                }
            }
        );

        return {
            success: true,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            threshold: sevenDaysAgo
        };
    } catch (error) {
        console.error('Error cleaning up stale sessions:', error);
        throw error;
    }
};
