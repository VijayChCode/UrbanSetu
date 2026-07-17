import express from 'express';
import { verifyToken } from '../utils/verify.js';
import realTimeDataService from '../services/realTimeDataService.js';
import { API_KEYS, API_ENDPOINTS } from '../config/apiKeys.js';
import Route from '../models/Route.js';
import { sendRoutePlannerShareEmail } from '../utils/emailService.js';

const router = express.Router();

// POST: Plan route using Mapbox Directions API
router.post('/plan', verifyToken, async (req, res) => {
  try {
    const { waypoints, profile = 'driving' } = req.body;

    // Validate input
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 waypoints are required'
      });
    }

    // Validate waypoint format
    const validWaypoints = waypoints.filter(wp =>
      wp && typeof wp.latitude === 'number' && typeof wp.longitude === 'number'
    );

    if (validWaypoints.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates (latitude, longitude) are required for each waypoint'
      });
    }

    // Get route plan from Mapbox
    const routeData = await realTimeDataService.getRoutePlan(validWaypoints, profile);

    res.json({
      success: true,
      data: routeData
    });

  } catch (error) {
    console.error('Error planning route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to plan route',
      error: error.message
    });
  }
});

// POST: Geocode address using Mapbox Geocoding API
router.post('/geocode', verifyToken, async (req, res) => {
  try {
    const { address, country = 'in', types = 'address,poi', limit = 5 } = req.body;

    if (!address || address.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Address must be at least 3 characters long'
      });
    }

    if (!API_KEYS.MAPBOX_ACCESS_TOKEN) {
      return res.status(503).json({
        success: false,
        message: 'Mapbox API not configured'
      });
    }

    const response = await fetch(
      `${API_ENDPOINTS.MAPBOX.GEOCODING}/${encodeURIComponent(address.trim())}.json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter results by country if specified
    const filteredFeatures = data.features.filter(feature => {
      if (country === 'in') {
        return feature.context?.some(ctx => ctx.country_code === 'IN');
      }
      return true;
    }).slice(0, limit);

    res.json({
      success: true,
      data: {
        features: filteredFeatures,
        query: data.query
      }
    });

  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to geocode address',
      error: error.message
    });
  }
});

// GET: Get route optimization suggestions
router.get('/optimize/:propertyId', verifyToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { userLocation } = req.query;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID is required'
      });
    }

    // Get property details (you'll need to import your Listing model)
    // const property = await Listing.findById(propertyId);
    // if (!property) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Property not found'
    //   });
    // }

    // Mock optimization suggestions for now
    const suggestions = {
      nearbyAmenities: [
        { name: 'Metro Station', distance: 0.5, type: 'transport' },
        { name: 'Shopping Mall', distance: 1.2, type: 'shopping' },
        { name: 'Hospital', distance: 2.1, type: 'healthcare' },
        { name: 'School', distance: 0.8, type: 'education' }
      ],
      routeOptimization: {
        suggestedOrder: ['Metro Station', 'Shopping Mall', 'Property', 'Hospital', 'School'],
        totalDistance: 8.5,
        totalDuration: 25
      }
    };

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Error getting optimization suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get optimization suggestions',
      error: error.message
    });
  }
});

// GET: Get Mapbox API status
router.get('/status', (req, res) => {
  const hasMapboxKey = !!API_KEYS.MAPBOX_ACCESS_TOKEN;

  res.json({
    success: true,
    data: {
      mapboxConfigured: hasMapboxKey,
      endpoints: hasMapboxKey ? Object.keys(API_ENDPOINTS.MAPBOX) : [],
      rateLimits: {
        mapbox: '100,000 requests/month (free tier)'
      }
    }
  });
});

// POST: Save a route
router.post('/save', verifyToken, async (req, res) => {
  try {
    const { name, stops, route, travelMode, timestamp } = req.body;
    const userId = req.user.id;

    if (!name || !stops || !route) {
      return res.status(400).json({ message: 'Route name, stops, and route data are required.' });
    }

    const savedRoute = new Route({
      name,
      stops,
      route,
      travelMode,
      timestamp: new Date(timestamp),
      userId
    });

    await savedRoute.save();

    const responseRoute = savedRoute.toObject();
    delete responseRoute.route;

    res.status(201).json({
      message: 'Route saved successfully',
      route: responseRoute
    });
  } catch (error) {
    console.error('Error saving route:', error);
    res.status(500).json({ message: 'Server error saving route.' });
  }
});

// GET: Fetch saved routes for user
router.get('/saved', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const routes = await Route.find({ userId })
      .select('-route')
      .sort({ timestamp: -1 })
      .limit(20); // Limit to last 20 routes

    res.status(200).json({
      message: 'Saved routes fetched successfully',
      routes
    });
  } catch (error) {
    console.error('Error fetching saved routes:', error);
    res.status(500).json({ message: 'Server error fetching saved routes.' });
  }
});

// GET: Fetch full details of a specific saved route
router.get('/saved/:routeId', verifyToken, async (req, res) => {
  try {
    const { routeId } = req.params;
    const userId = req.user.id;

    const route = await Route.findOne({ _id: routeId, userId });

    if (!route) {
      return res.status(404).json({ message: 'Route not found or access denied.' });
    }

    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Error fetching route details:', error);
    res.status(500).json({ message: 'Server error fetching route details.' });
  }
});

// DELETE: Delete a saved route
router.delete('/saved/:routeId', verifyToken, async (req, res) => {
  try {
    const { routeId } = req.params;
    const userId = req.user.id;

    const route = await Route.findOneAndDelete({ _id: routeId, userId });

    if (!route) {
      return res.status(404).json({ message: 'Route not found or access denied.' });
    }

    res.status(200).json({
      message: 'Route deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ message: 'Server error deleting route.' });
  }
});

// POST: Share a route and send automated email
router.post('/share', verifyToken, async (req, res) => {
  try {
    const { name, stops, distance, duration, shareUrl } = req.body;
    const email = req.user.email;

    if (!stops || !shareUrl) {
      return res.status(400).json({
        success: false,
        message: 'Stops and shareUrl are required'
      });
    }

    const result = await sendRoutePlannerShareEmail(email, name, stops, distance, duration, shareUrl);

    res.json({
      success: true,
      message: 'Automated route share email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sharing route/sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send route share email',
      error: error.message
    });
  }
});

export default router;
