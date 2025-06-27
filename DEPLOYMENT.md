# Render Backend Deployment Guide

## Prerequisites
- MongoDB Atlas database
- Render account
- GitHub repository connected

## Environment Variables Required

Set these in your Render dashboard:

1. **MONGO**: Your MongoDB connection string
   ```
   mongodb+srv://username:password@cluster.mongodb.net/urbansetu?retryWrites=true&w=majority
   ```

2. **JWT_SECRET**: A secure random string for JWT token signing
   ```
   your-super-secret-jwt-key-here
   ```

3. **NODE_ENV**: Set to production
   ```
   production
   ```

## Deployment Steps

1. **Connect Repository**: Link your GitHub repository to Render
2. **Create Web Service**: Choose "Web Service" type
3. **Configure Build Settings**:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Set Environment Variables**: Add the variables listed above
5. **Deploy**: Click "Create Web Service"

## Health Check
The backend includes a health check endpoint at `/api/health` for Render monitoring.

## CORS Configuration
The backend is configured to accept requests from:
- Local development: `http://localhost:5173`
- Vercel frontend: `https://urbansetu.vercel.app`
- Vercel preview deployments

## API Endpoints
All API endpoints are prefixed with `/api/`:
- `/api/auth` - Authentication
- `/api/user` - User management
- `/api/listing` - Property listings
- `/api/bookings` - Booking management
- `/api/admin` - Admin functions
- `/api/contact` - Contact forms
- `/api/wishlist` - Wishlist management
- `/api/about` - About page content 