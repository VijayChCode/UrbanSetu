import jwt from 'jsonwebtoken';

// JWT configuration
const JWT_SECRET = process.env.JWT_TOKEN;
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

// Generate access token (short-lived)
export const generateAccessToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'urbansetu',
        audience: 'urbansetu-users'
    });
};

// Generate refresh token (long-lived)
export const generateRefreshToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'urbansetu',
        audience: 'urbansetu-refresh'
    });
};

// Verify access token
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'urbansetu',
            audience: 'urbansetu-users'
        });
    } catch (error) {
        throw error;
    }
};

// Verify refresh token
export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'urbansetu',
            audience: 'urbansetu-refresh'
        });
    } catch (error) {
        throw error;
    }
};

// Generate both tokens
export const generateTokenPair = (payload) => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    };
};

// Set secure cookies
export const setSecureCookies = (res, accessToken, refreshToken) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/'
    };

    // Set access token cookie (short-lived)
    res.cookie('access_token', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Set refresh token cookie (long-lived)
    res.cookie('refresh_token', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

// Clear all auth cookies
export const clearAuthCookies = (res) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/'
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
};