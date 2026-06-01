import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaRoute, FaPlus, FaTrash, FaClock, FaMapMarkerAlt, FaCar, FaWalking, FaBicycle, FaBus, FaCog, FaDownload, FaShare, FaBookmark, FaHistory, FaFilter, FaSearch, FaLocationArrow, FaDirections, FaInfoCircle, FaTrafficLight, FaLayerGroup, FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp, FaExpand, FaCompress, FaPrint, FaCrosshairs } from 'react-icons/fa';
import { toast } from 'react-toastify';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import '../styles/routePlannerSuggestions.css';

import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { usePageTitle } from '../hooks/usePageTitle';
import { useHeader } from '../contexts/HeaderContext';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import SocialSharePanel from '../components/SocialSharePanel';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function RoutePlanner() {
  // Set page title
  usePageTitle("Advanced Route Planner - Navigation Tool");

  // Header context
  const { hideHeader, showHeader } = useHeader();
  const { currentUser } = useSelector((state) => state.user);

  // State management
  const [stops, setStops] = useState([{ address: '', coordinates: null }]);
  const [optimizing, setOptimizing] = useState(false);
  const [plan, setPlan] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [map, setMap] = useState(null);
  const [mapError, setMapError] = useState(null);

  // Advanced features state
  const [travelMode, setTravelMode] = useState('driving');
  const [mapStyle, setMapStyle] = useState('streets');
  const [showTraffic, setShowTraffic] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [showMapStyles, setShowMapStyles] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [routeOptimization, setRouteOptimization] = useState(true);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [routeHistory, setRouteHistory] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeStats, setRouteStats] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [selectedAlternative, setSelectedAlternative] = useState(0);
  const [isRouteSaved, setIsRouteSaved] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(null);
  const [hasRestoredFromUrl, setHasRestoredFromUrl] = useState(false);
  const [brandExpanded, setBrandExpanded] = useState(true);

  // Auto-hide branding layer after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setBrandExpanded(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDestructive: false
  });

  // Share Panel State
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareConfig, setShareConfig] = useState({
    url: '',
    title: '',
    description: ''
  });

  const mapRef = useRef(null);
  const geocoderRefs = useRef([]);
  const markersRef = useRef([]);
  const routeSourcesRef = useRef([]);
  const currentLocationMarkerRef = useRef(null);
  const stopsRef = useRef(stops);

  // Sync stops with ref to prevent stale closures in map click event handlers
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  // Map styles configuration
  const mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/satellite-v9',
    satelliteStreets: 'mapbox://styles/mapbox/satellite-streets-v12'
  };

  // Travel modes configuration
  const travelModes = [
    { id: 'driving', name: 'Driving', icon: FaCar, color: '#3B82F6' },
    { id: 'walking', name: 'Walking', icon: FaWalking, color: '#10B981' },
    { id: 'cycling', name: 'Cycling', icon: FaBicycle, color: '#8B5CF6' },
    { id: 'driving-traffic', name: 'Traffic', icon: FaTrafficLight, color: '#F59E0B' }
  ];

  const addStop = () => {
    if (stops.length >= 10) {
      toast.warning('Maximum of 10 stops allowed.');
      return;
    }
    setStops(s => [...s, { address: '', coordinates: null }]);
  };
  const removeStop = (i) => setStops(s => s.filter((_, idx) => idx !== i));
  const updateStop = (i, value, coordinates = null) => {
    setStops(s => s.map((st, idx) =>
      idx === i ? { address: value, coordinates } : st
    ));
  };

  // Initialize Mapbox
  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox access token not found. Please set VITE_MAPBOX_ACCESS_TOKEN in your environment variables.');
      setMapError('Mapbox access token not configured');
      return;
    }

    try {
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
      setMapReady(true);
      setMapError(null);
    } catch (error) {
      console.error('Error setting Mapbox access token:', error);
      setMapError('Failed to initialize Mapbox');
    }
  }, []);

  // Initialize map with advanced features
  useEffect(() => {
    if (!mapReady || !mapRef.current || map) return;

    try {
      const mapInstance = new mapboxgl.Map({
        container: mapRef.current,
        style: mapStyles[mapStyle],
        center: [77.2090, 28.6139], // Delhi coordinates
        zoom: 11,
        attributionControl: true,
        maxZoom: 20,
        minZoom: 1
      });

      // Handle map load
      mapInstance.on('load', () => {
        console.log('Map loaded successfully');
        setMap(mapInstance);
        setMapError(null);

        // Add navigation controls
        mapInstance.addControl(new mapboxgl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true
        }), 'top-right');

        // Add geolocate control
        const geolocate = new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true,
          showAccuracyCircle: true
        });

        geolocate.on('geolocate', (e) => {
          setCurrentLocation([e.coords.longitude, e.coords.latitude]);
        });

        mapInstance.addControl(geolocate, 'top-right');

        // Add scale control
        mapInstance.addControl(new mapboxgl.ScaleControl({
          maxWidth: 100,
          unit: 'metric'
        }), 'bottom-left');

        // Add fullscreen control
        mapInstance.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        // Handle map click for dynamic location popup with latency loading
        mapInstance.on('click', async (e) => {
          // Ignore clicks on markers, controls, or sidebar overlays
          if (e.originalEvent.target.className !== 'mapboxgl-canvas') return;

          const coordinates = [e.lngLat.lng, e.lngLat.lat];

          // Create a premium loading spinner popup
          const loadingPopup = new mapboxgl.Popup({ 
            offset: 10,
            closeButton: false,
            closeOnClick: true
          })
            .setLngLat(coordinates)
            .setHTML(`
              <div class="flex flex-col items-center justify-center p-4 min-w-[180px] bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <div class="premium-spinner mb-2.5"></div>
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">Analyzing Coordinates...</span>
              </div>
            `)
            .addTo(mapInstance);

          let address = 'Selected Location';
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.features && data.features.length > 0) {
                address = data.features[0].place_name;
              }
            }
          } catch (geocodingError) {
            console.warn('Map click reverse geocoding failed:', geocodingError);
          }

          // Remove the loading popup
          loadingPopup.remove();

          // Check if start stop (index 0) has coordinates already set
          const currentStops = stopsRef.current;
          const isStartSet = currentStops.length > 0 && currentStops[0].coordinates !== null;

          // Create the resolved detail popup
          const clickPopup = new mapboxgl.Popup({ 
            offset: 10,
            closeButton: false,
            closeOnClick: true
          })
            .setLngLat(coordinates)
            .setHTML(`
              <div class="p-3 min-w-[200px] text-gray-800 dark:text-white bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <span class="inline-block px-2 py-0.5 mb-1.5 text-[9px] font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded-full">
                  📍 Map Location
                </span>
                <h3 id="popup-address" class="font-bold text-xs truncate max-w-[220px]" title="${address}">${address}</h3>
                <p class="text-[9px] text-gray-400 dark:text-blue-200 mt-1 font-mono">${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}</p>
                
                <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                  ${!isStartSet ? `
                    <button id="btn-set-start-click" class="flex-1 py-1 px-2 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm">
                      Set as Start
                    </button>
                  ` : ''}
                  <button id="btn-add-stop-click" class="flex-1 py-1 px-2 text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded transition-colors">
                    Add Stop
                  </button>
                </div>
              </div>
            `);

          // Bind listeners when the resolved popup opens exactly once
          clickPopup.once('open', () => {
            const btnSetStart = document.getElementById('btn-set-start-click');
            const btnAddStop = document.getElementById('btn-add-stop-click');

            if (btnSetStart) {
              btnSetStart.addEventListener('click', (e) => {
                e.stopPropagation();
                updateStop(0, address, coordinates);
                toast.success('Location set as Start stop!');
                clickPopup.remove();
              });
            }

            if (btnAddStop) {
              btnAddStop.addEventListener('click', (e) => {
                e.stopPropagation();
                setStops(s => {
                  if (s.length === 1 && !s[0].address) {
                    return [{ address, coordinates }];
                  }
                  if (s.length >= 10) {
                    toast.warning('Maximum of 10 stops allowed.');
                    return s;
                  }
                  return [...s, { address, coordinates }];
                });
                toast.success('Location added as a stop!');
                clickPopup.remove();
              });
            }
          });

          clickPopup.addTo(mapInstance);
        });
      });

      // Handle map errors
      mapInstance.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Map failed to load. Please check your internet connection.');
      });

      // Handle style load
      mapInstance.on('style.load', () => {
        console.log('Map style loaded successfully');
      });

      mapInstance.on('style.error', (e) => {
        console.error('Map style error:', e);
        setMapError('Map style failed to load');
      });

    } catch (error) {
      console.error('Error creating map:', error);
      setMapError('Failed to create map instance');
    }

    return () => {
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.remove();
        currentLocationMarkerRef.current = null;
      }
      if (map) {
        map.remove();
        setMap(null);
      }
    };
  }, [mapReady, mapStyle]);

  // Trigger map resize when sidebar state changes
  useEffect(() => {
    if (map) {
      // Resize immediately and periodically during transition
      const interval = setInterval(() => {
        map.resize();
      }, 50);

      // Final resize after transition completes
      const timeout = setTimeout(() => {
        clearInterval(interval);
        map.resize();
      }, 350);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [map, isSidebarOpen]);

  // Clear all route sources and layers
  const clearRoutes = useCallback(() => {
    if (!map) return;

    // Clear main route
    try {
      if (map.getLayer('route-main')) {
        map.removeLayer('route-main');
      }
      if (map.getSource('route-main')) {
        map.removeSource('route-main');
      }
    } catch (error) {
      console.warn('Error removing main route:', error);
    }

    // Clear alternative routes
    routeSourcesRef.current.forEach((sourceId) => {
      try {
        if (map.getLayer(sourceId)) {
          map.removeLayer(sourceId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (error) {
        console.warn(`Error removing route ${sourceId}:`, error);
      }
    });
    routeSourcesRef.current = [];
  }, [map]);

  // Clear markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => {
      if (marker) {
        marker.remove();
      }
    });
    markersRef.current = [];
  }, []);

  // Add markers for stops with enhanced styling and premium hover popup triggers
  const addMarkers = useCallback(() => {
    if (!map || !map.isStyleLoaded()) return;

    clearMarkers();

    stops.forEach((stop, index) => {
      if (stop.coordinates) {
        const isStart = index === 0;
        const isEnd = index === stops.length - 1;

        // Create custom marker element (nested wrapper to prevent Mapbox coordinate displacement on scaling)
        const el = document.createElement('div');
        el.className = 'custom-marker-container';

        const innerEl = document.createElement('div');
        innerEl.className = 'custom-marker-inner';
        innerEl.style.cssText = `
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: ${isStart ? '#10b981' : isEnd ? '#ef4444' : '#3b82f6'};
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        `;
        innerEl.textContent = index + 1;
        el.appendChild(innerEl);

        // Add popup with address, coordinates, and copy coordinates actions
        const popup = new mapboxgl.Popup({ 
          offset: 25,
          closeButton: false,
          closeOnClick: false
        })
          .setLngLat(stop.coordinates)
          .setHTML(`
            <div class="p-2.5 max-w-[220px] text-gray-800 dark:text-white bg-white dark:bg-gray-800 rounded shadow-lg">
              <span class="inline-block px-1.5 py-0.5 mb-1.5 text-[9px] font-bold text-white bg-blue-600 dark:bg-blue-500 rounded">
                Stop ${index + 1}
              </span>
              <p class="text-xs font-semibold leading-snug line-clamp-2">${stop.address}</p>
              <p class="text-[9px] text-gray-400 dark:text-blue-200 mt-1 font-mono">${stop.coordinates[1].toFixed(5)}, ${stop.coordinates[0].toFixed(5)}</p>
            </div>
          `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat(stop.coordinates)
          .setPopup(popup)
          .addTo(map);

        // Dynamic Hover Scale & Details Popup Trigger (acts on inner wrapper element)
        innerEl.addEventListener('mouseenter', () => {
          innerEl.style.transform = 'scale(1.25)';
          innerEl.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
          popup.addTo(map);
        });

        innerEl.addEventListener('mouseleave', () => {
          innerEl.style.transform = 'scale(1)';
          innerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
          popup.remove();
        });

        // Click to smoothly center/fly map to stop coordinates
        innerEl.addEventListener('click', () => {
          map.flyTo({
            center: stop.coordinates,
            zoom: 13,
            pitch: 30,
            essential: true
          });
        });

        markersRef.current.push(marker);
      }
    });
  }, [map, stops, clearMarkers]);

  // Update markers when stops change
  useEffect(() => {
    if (map && map.isStyleLoaded()) {
      addMarkers();
    }
  }, [map, stops, addMarkers]);

  // Change map style
  const changeMapStyle = (style) => {
    if (map) {
      setMapStyle(style);
      map.setStyle(mapStyles[style]);
    }
  };

  // Toggle traffic layer
  const toggleTraffic = () => {
    if (!map) return;

    setShowTraffic(!showTraffic);

    if (!showTraffic) {
      // Add traffic layer
      map.addSource('traffic', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-traffic-v1'
      });

      map.addLayer({
        id: 'traffic',
        type: 'line',
        source: 'traffic',
        'source-layer': 'traffic',
        paint: {
          'line-width': 2,
          'line-color': [
            'case',
            ['==', ['get', 'congestion'], 'low'], '#10b981',
            ['==', ['get', 'congestion'], 'moderate'], '#f59e0b',
            ['==', ['get', 'congestion'], 'heavy'], '#ef4444',
            ['==', ['get', 'congestion'], 'severe'], '#dc2626',
            '#6b7280'
          ]
        }
      });
    } else {
      // Remove traffic layer
      if (map.getLayer('traffic')) {
        map.removeLayer('traffic');
      }
      if (map.getSource('traffic')) {
        map.removeSource('traffic');
      }
    }
  };

  // Compute fallback plan
  const computePlanFallback = () => {
    const valid = stops.map(s => s.address.trim()).filter(Boolean);
    const now = new Date();
    return valid.map((addr, idx) => ({
      addr,
      eta: new Date(now.getTime() + idx * 20 * 60000)
    }));
  };

  // Enhanced route planning with alternatives
  const optimize = async () => {
    const validStops = stops.filter(s => s.address.trim() && s.coordinates);
    if (validStops.length < 2) {
      toast.error('Please add at least 2 valid addresses with coordinates');
      return;
    }

    if (!map || !map.isStyleLoaded()) {
      toast.error('Map is not ready. Please wait for the map to load.');
      return;
    }

    setOptimizing(true);
    setIsRouteSaved(false); // Reset saved status when planning new route
    try {
      // Prepare coordinates for Mapbox Directions API
      const coordinates = validStops.map(stop => stop.coordinates).join(';');

      // Build request parameters
      const params = new URLSearchParams({
        geometries: 'geojson',
        overview: 'full',
        steps: 'true',
        alternatives: showAlternatives ? 'true' : 'false',
        access_token: MAPBOX_ACCESS_TOKEN
      });

      if (avoidTolls) params.append('exclude', 'toll');
      if (avoidHighways) params.append('exclude', 'motorway');

      // Call Mapbox Directions API
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${travelMode}/${coordinates}?${params}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        // Clear existing routes
        clearRoutes();

        // Process main route
        const mainRoute = data.routes[0];
        setRouteData(mainRoute);

        // Process alternatives if available
        if (data.routes.length > 1) {
          setAlternatives(data.routes.slice(1));
        } else {
          setAlternatives([]);
        }

        // Add main route to map
        const mainSourceId = 'route-main';
        routeSourcesRef.current.push(mainSourceId);

        map.addSource(mainSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: mainRoute.geometry
          }
        });

        map.addLayer({
          id: 'route-main',
          type: 'line',
          source: mainSourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 0.8
          }
        });

        // Add alternative routes
        alternatives.forEach((altRoute, index) => {
          const altSourceId = `route-alt-${index}`;
          routeSourcesRef.current.push(altSourceId);

          map.addSource(altSourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: altRoute.geometry
            }
          });

          map.addLayer({
            id: `route-alt-${index}`,
            type: 'line',
            source: altSourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#6b7280',
              'line-width': 3,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2]
            }
          });
        });

        // Calculate ETAs and route statistics
        const waypoints = data.waypoints || [];
        const now = Date.now();
        let cumulativeDuration = 0;

        const itinerary = validStops.map((stop, idx) => {
          if (idx > 0) {
            const legDuration = mainRoute.legs[idx - 1]?.duration * 1000 || 0;
            cumulativeDuration += legDuration;
          }

          return {
            addr: stop.address,
            eta: new Date(now + cumulativeDuration),
            coordinates: stop.coordinates
          };
        });

        setPlan(itinerary);

        // Set route statistics
        setRouteStats({
          distance: (mainRoute.distance / 1000).toFixed(2), // km
          duration: Math.round(mainRoute.duration / 60), // minutes
          fuelCost: calculateFuelCost(mainRoute.distance, travelMode),
          co2Emission: calculateCO2Emission(mainRoute.distance, travelMode)
        });

        // Fit map to route bounds
        if (mainRoute.geometry.coordinates.length > 0) {
          const bounds = mainRoute.geometry.coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new mapboxgl.LngLatBounds(mainRoute.geometry.coordinates[0], mainRoute.geometry.coordinates[0]));

          map.fitBounds(bounds, {
            padding: 50
          });
        }

        // Save to route history
        const routeRecord = {
          id: Date.now(),
          stops: validStops,
          route: mainRoute,
          alternatives: alternatives,
          timestamp: new Date(),
          travelMode: travelMode
        };

        setRouteHistory(prev => [routeRecord, ...prev.slice(0, 9)]); // Keep last 10 routes

        if (hasRestoredFromUrl) {
          toast.success('Shared route loaded successfully!');
        } else {
          toast.success('Route planned successfully!');
        }
      } else {
        throw new Error('No routes found');
      }
    } catch (error) {
      console.error('Route planning failed:', error);
      if (hasRestoredFromUrl) {
        toast.error('Unable to calculate the shared route. The locations might be unreachable.');
        // Restore clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        toast.error('Route planning failed. Showing approximate itinerary.');
      }
      setPlan(computePlanFallback());
    } finally {
      setOptimizing(false);
    }
  };

  // Calculate fuel cost (rough estimate)
  const calculateFuelCost = (distance, mode) => {
    if (mode === 'driving' || mode === 'driving-traffic') {
      const fuelEfficiency = 12; // km per liter
      const fuelPrice = 100; // INR per liter
      return ((distance / 1000) / fuelEfficiency * fuelPrice).toFixed(2);
    }
    return 0;
  };

  // Calculate CO2 emission (rough estimate)
  const calculateCO2Emission = (distance, mode) => {
    if (mode === 'driving' || mode === 'driving-traffic') {
      const emissionRate = 120; // grams CO2 per km
      return ((distance / 1000) * emissionRate).toFixed(0);
    }
    return 0;
  };

  // Save route to backend
  const saveRoute = async () => {
    if (!routeData) {
      toast.error('No route to save');
      return;
    }

    const routeToSave = {
      name: `Route ${stops.filter(s => s.address).map(s => s.address.split(',')[0]).join(' → ')}`,
      stops: stops.filter(s => s.address && s.coordinates),
      route: routeData,
      travelMode: travelMode,
      timestamp: new Date()
    };

    setIsSavingRoute(true);
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/route-planner/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeToSave)
      });

      if (response.ok) {
        const data = await response.json();
        // Optimistically add the route with local geometry to avoid re-fetching immediately
        const routeWithData = { ...data.route, route: routeData };
        setSavedRoutes(prev => [routeWithData, ...prev]);
        setIsRouteSaved(true);
        toast.success('Route saved successfully!');
      } else {
        throw new Error('Failed to save route');
      }
    } catch (error) {
      console.error('Error saving route:', error);
      toast.error('Failed to save route. Please try again.');
    } finally {
      setIsSavingRoute(false);
    }
  };

  // Load saved route (fetches full details if needed)
  const loadRoute = async (savedRoute) => {
    try {
      let routeGeometry = savedRoute.route;

      // If geometry is missing (from optimized list fetch), fetch full details
      if (!routeGeometry) {
        const loadingToast = toast.loading("Fetching route details...");
        try {
          const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/route-planner/saved/${savedRoute._id}`);

          if (!response.ok) throw new Error("Failed to fetch details");

          const data = await response.json();
          if (data.success && data.route) {
            routeGeometry = data.route.route;
          } else {
            throw new Error("Invalid route data");
          }
        } catch (err) {
          toast.update(loadingToast, { render: "Failed to load route details", type: "error", isLoading: false, autoClose: 3000 });
          return;
        }
        toast.dismiss(loadingToast);
      }

      if (routeGeometry) {
        setStops(savedRoute.stops);
        setTravelMode(savedRoute.travelMode);
        setRouteData(routeGeometry);
        setIsRouteSaved(true);

        // Calculate Route Stats
        setRouteStats({
          distance: (routeGeometry.distance / 1000).toFixed(2), // km
          duration: Math.round(routeGeometry.duration / 60), // minutes
          fuelCost: calculateFuelCost(routeGeometry.distance, savedRoute.travelMode),
          co2Emission: calculateCO2Emission(routeGeometry.distance, savedRoute.travelMode)
        });

        // Reconstruct Itinerary/Plan
        const now = Date.now();
        let cumulativeDuration = 0;
        const itinerary = savedRoute.stops.map((stop, idx) => {
          if (idx > 0) {
            // Legs array length is stops.length - 1
            const legDuration = routeGeometry.legs && routeGeometry.legs[idx - 1] ? routeGeometry.legs[idx - 1].duration * 1000 : 0;
            cumulativeDuration += legDuration;
          }
          return {
            addr: stop.address,
            eta: new Date(now + cumulativeDuration),
            coordinates: stop.coordinates
          };
        });
        setPlan(itinerary);

        // Fit map bounds
        if (map && routeGeometry.geometry && routeGeometry.geometry.coordinates.length > 0) {
          try {
            const bounds = routeGeometry.geometry.coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(routeGeometry.geometry.coordinates[0], routeGeometry.geometry.coordinates[0]));

            map.fitBounds(bounds, {
              padding: 50
            });
          } catch (e) {
            console.warn("Could not fit bounds", e);
          }
        }

        toast.success('Route loaded successfully!');
      }
    } catch (error) {
      console.error("Load route error:", error);
      toast.error("Error loading route");
    }
  };

  // Fetch saved routes from backend
  const fetchSavedRoutes = async () => {
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/route-planner/saved`);

      if (response.ok) {
        const data = await response.json();
        setSavedRoutes(data.routes || []);
      }
    } catch (error) {
      console.error('Error fetching saved routes:', error);
    }
  };

  // Delete a saved route
  const deleteSavedRoute = (routeId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Saved Route',
      message: 'Are you sure you want to delete this route from your saved list? This action cannot be undone.',
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/route-planner/saved/${routeId}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            setSavedRoutes(prev => prev.filter(route => route._id !== routeId));
            toast.success('Route deleted successfully!');
          } else {
            throw new Error('Failed to delete route');
          }
        } catch (error) {
          console.error('Error deleting route:', error);
          toast.error('Failed to delete route. Please try again.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Delete all saved routes
  const deleteAllSavedRoutes = () => {
    if (savedRoutes.length === 0) {
      toast.info('No routes to delete');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete All Saved Routes',
      message: `Are you sure you want to delete all ${savedRoutes.length} saved routes? This action cannot be undone.`,
      confirmText: 'Delete All',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const deletePromises = savedRoutes.map(route =>
            authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/route-planner/saved/${route._id}`, {
              method: 'DELETE'
            })
          );

          await Promise.all(deletePromises);
          setSavedRoutes([]);
          toast.success('All routes deleted successfully!');
        } catch (error) {
          console.error('Error deleting all routes:', error);
          toast.error('Failed to delete all routes. Please try again.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Export route as GPX
  const exportRoute = () => {
    if (!routeData) {
      toast.error('No route to export');
      return;
    }

    const gpxContent = generateGPX(routeData, stops);
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${Date.now()}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Route exported as GPX file!');
  };

  // Generate GPX content
  const generateGPX = (route, waypoints) => {
    const coordinates = route.geometry.coordinates;
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="UrbanSetu Route Planner">
  <trk>
    <name>Route</name>
    <trkseg>`;

    coordinates.forEach(coord => {
      gpx += `
      <trkpt lat="${coord[1]}" lon="${coord[0]}"></trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>`;

    waypoints.forEach((waypoint, index) => {
      if (waypoint.coordinates) {
        gpx += `
  <wpt lat="${waypoint.coordinates[1]}" lon="${waypoint.coordinates[0]}">
    <name>Stop ${index + 1}</name>
    <desc>${waypoint.address}</desc>
  </wpt>`;
      }
    });

    gpx += `
</gpx>`;
    return gpx;
  };

  // Share route
  const shareRoute = () => {
    if (!routeData) {
      toast.error('No route to share');
      return;
    }

    const stopsList = stops.filter(s => s.address).map(s => s.address.split(',')[0]).join(' → ');
    const description = `Route Details: ${stopsList}.\nDistance: ${routeStats?.distance} km • Duration: ${routeStats?.duration} min.\nPlan your trip with UrbanSetu!`;

    // Encode route details into URL for deep linking
    const sharedData = {
      stops: stops.filter(s => s.address && s.coordinates),
      mode: travelMode,
      tolls: avoidTolls,
      highways: avoidHighways,
      opt: routeOptimization
    };

    try {
      const dataStr = JSON.stringify(sharedData);
      // Safe base64 encoding for unicode strings
      const encodedData = btoa(unescape(encodeURIComponent(dataStr)));

      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('routeData', encodedData);

      const shareUrl = `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`;

      setShareConfig({
        url: shareUrl,
        title: 'Plan your route with UrbanSetu 🗺️',
        description: description
      });
      setShowSharePanel(true);
    } catch (err) {
      console.error('Error creating share link:', err);
      toast.error('Failed to generate shareable link');
    }
  };

  // Fallback share method
  const fallbackShare = (shareData) => {
    navigator.clipboard.writeText(shareData.url).then(() => {
      toast.success('Route URL copied to clipboard!');
    }).catch(() => {
      toast.error('Unable to share route');
    });
  };

  // Handle address input with debounced geocoding
  const onChangeAddress = useCallback(async (i, value) => {
    updateStop(i, value);

    if (!value || value.length < 3) {
      setPredictions(prev => {
        const copy = [...prev];
        copy[i] = [];
        return copy;
      });
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?country=in&types=address,poi&limit=5&access_token=${MAPBOX_ACCESS_TOKEN}`
      );

      if (response.ok) {
        const data = await response.json();
        setPredictions(prev => {
          const copy = [...prev];
          copy[i] = data.features || [];
          return copy;
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }, []);

  const pickPrediction = (i, prediction) => {
    updateStop(i, prediction.place_name, prediction.center);
    setPredictions(prev => {
      const copy = [...prev];
      copy[i] = [];
      return copy;
    });
  };

  // Use current location
  const useCurrentLocation = async (index) => {
    // Check for location permission in settings
    const allowLocationAccess = localStorage.getItem('allowLocationAccess');
    if (allowLocationAccess !== 'true') {
      const settingsPath = currentUser?.role?.includes('admin') ? '/admin/settings' : '/user/settings';
      toast.info(
        <div>
          Please enable Location Access in <Link to={settingsPath} className="font-bold underline">Settings &gt; Privacy</Link>
        </div>
      );
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    // Set loading state for this specific button
    setLoadingLocation(index);

    // Show loading toast
    const loadingToast = toast.loading('Getting your current location...');

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;
      const coordinates = [longitude, latitude];

      // Update current location state
      setCurrentLocation(coordinates);

      // Get address from coordinates using reverse geocoding
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi`
        );
        const data = await response.json();

        let address = 'Current Location';
        if (data.features && data.features.length > 0) {
          address = data.features[0].place_name;
        }

        // Update the stop with current location
        updateStop(index, address, coordinates);

        toast.update(loadingToast, {
          render: 'Current location added successfully!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });

      } catch (geocodingError) {
        console.warn('Reverse geocoding failed:', geocodingError);
        // Still update with coordinates even if reverse geocoding fails
        updateStop(index, 'Current Location', coordinates);

        toast.update(loadingToast, {
          render: 'Current location added!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });
      }

    } catch (error) {
      let errorMsg = 'An error occurred while getting your location. Please try again.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = 'Location access denied. Please enable location permissions in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = 'Location information is unavailable. Please check your GPS settings.';
          break;
        case error.TIMEOUT:
          errorMsg = 'Location request timed out. Please try again.';
          break;
      }
      toast.update(loadingToast, {
        render: errorMsg,
        type: 'error',
        isLoading: false,
        autoClose: 5000
      });
    } finally {
      // Clear loading state
      setLoadingLocation(null);
    }
  };

  // Show user's current location on the map with custom pulse marker and geocoded details
  const showUserLocationOnMap = async () => {
    const allowLocationAccess = localStorage.getItem('allowLocationAccess');
    if (allowLocationAccess !== 'true') {
      const settingsPath = currentUser?.role?.includes('admin') ? '/admin/settings' : '/user/settings';
      toast.info(
        <div>
          Please enable Location Access in <Link to={settingsPath} className="font-bold underline">Settings &gt; Privacy</Link>
        </div>
      );
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    const loadingToast = toast.loading('Locating you...');

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;
      const coordinates = [longitude, latitude];

      // Get reverse geocoded address for current location
      let address = 'Current Location';
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            address = data.features[0].place_name;
          }
        }
      } catch (geocodingError) {
        console.warn('Reverse geocoding failed:', geocodingError);
      }

      // Center map on user location
      if (map) {
        map.flyTo({
          center: coordinates,
          zoom: 14,
          pitch: 45,
          essential: true
            // Check if start stop (index 0) has coordinates already set
        const currentStops = stopsRef.current;
        const isStartSet = currentStops.length > 0 && currentStops[0].coordinates !== null;

        // Add popup with address, coordinates, and action buttons
        const popup = new mapboxgl.Popup({ 
          offset: 15,
          closeButton: false,
          closeOnClick: false
        })
          .setLngLat(coordinates)
          .setHTML(`
            <div class="p-3 min-w-[200px] text-gray-800 dark:text-white bg-white dark:bg-gray-800 rounded-lg shadow-xl">
              <span class="inline-block px-2 py-0.5 mb-1.5 text-[9px] font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded-full">
                📍 Live Location
              </span>
              <h3 id="popup-address" class="font-bold text-xs truncate max-w-[220px]" title="${address}">${address}</h3>
              <p class="text-[9px] text-gray-400 dark:text-blue-200 mt-1 font-mono">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>
              
              <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                ${!isStartSet ? `
                  <button id="btn-set-start" class="flex-1 py-1 px-2 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm">
                    Set as Start
                  </button>
                ` : ''}
                <button id="btn-add-stop" class="flex-1 py-1 px-2 text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded transition-colors">
                  Add Stop
                </button>
              </div>
            </div>
          `);

        // Dynamic Hover Trigger with Smooth Delay for Actions
        let closeTimeout = null;
        el.style.cursor = 'pointer';

        el.addEventListener('mouseenter', () => {
          if (closeTimeout) clearTimeout(closeTimeout);
          
          // Re-register the one-time open listener to attach fresh button handlers on every open
          popup.once('open', () => {
            // Keep popup open when hovering over the popup container itself
            const popupEl = popup.getElement();
            if (popupEl) {
              popupEl.addEventListener('mouseenter', () => {
                if (closeTimeout) clearTimeout(closeTimeout);
              });
              popupEl.addEventListener('mouseleave', () => {
                closeTimeout = setTimeout(() => {
                  popup.remove();
                }, 300);
              });
            }

            const btnSetStart = document.getElementById('btn-set-start');
            const btnAddStop = document.getElementById('btn-add-stop');
            
            if (btnSetStart) {
              btnSetStart.addEventListener('click', (e) => {
                e.stopPropagation();
                updateStop(0, address, coordinates);
                toast.success('Current location set as Start stop!');
                popup.remove();
              });
            }
            
            if (btnAddStop) {
              btnAddStop.addEventListener('click', (e) => {
                e.stopPropagation();
                setStops(s => {
                  if (s.length === 1 && !s[0].address) {
                    return [{ address, coordinates }];
                  }
                  if (s.length >= 10) {
                    toast.warning('Maximum of 10 stops allowed.');
                    return s;
                  }
                  return [...s, { address, coordinates }];
                });
                toast.success('Current location added as a stop!');
                popup.remove();
              });
            }
          });

          popup.addTo(map);
        });

        el.addEventListener('mouseleave', () => {
          closeTimeout = setTimeout(() => {
            popup.remove();
          }, 300);
        });

        // Click to keep open or toggle popup
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (closeTimeout) clearTimeout(closeTimeout);
          if (popup.isOpen()) {
            popup.remove();
          } else {
            popup.addTo(map);
          }
        });

        // Create new marker
        const newMarker = new mapboxgl.Marker(el)
          .setLngLat(coordinates)
          .setPopup(popup)
          .addTo(map);

        currentLocationMarkerRef.current = newMarker;

        toast.update(loadingToast, {
          render: 'Found your location!',
          type: 'success',
          isLoading: false,
          autoClose: 2000
        });
      }
    } catch (error) {
      console.error('Error showing user location:', error);
      let errorMsg = 'Failed to retrieve location.';
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = 'Location access denied by browser.';
      }
      toast.update(loadingToast, {
        render: errorMsg,
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
  };

  // Fetch saved routes on component mount
  useEffect(() => {
    fetchSavedRoutes();
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showSettings) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSettings]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  // 5. Handle Deep Linking / Shared Routes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedData = params.get('routeData');

    if (encodedData && !hasRestoredFromUrl) {
      try {
        const decodedStr = decodeURIComponent(escape(atob(encodedData)));
        const data = JSON.parse(decodedStr);

        if (data && data.stops && Array.isArray(data.stops) && data.stops.length >= 2) {
          setStops(data.stops);
          if (data.mode) setTravelMode(data.mode);
          if (data.tolls !== undefined) setAvoidTolls(data.tolls);
          if (data.highways !== undefined) setAvoidHighways(data.highways);
          if (data.opt !== undefined) setRouteOptimization(data.opt);

          setIsSidebarOpen(true);
          setHasRestoredFromUrl(true);
          // Using a loading toast that will be replaced by success toast in optimize()
          toast.info('Shared route found! Loading stops...', { autoClose: 2000 });
        } else {
          throw new Error('Invalid route data structure');
        }
      } catch (err) {
        console.error('Failed to parse shared route data:', err);
        setHasRestoredFromUrl(true); // Stop further attempts
        toast.error('The shared route link is invalid or has expired.');

        // Optionally clear the invalid param from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [hasRestoredFromUrl]);

  // 6. Auto-optimize if loaded from deep link once map is ready
  useEffect(() => {
    if (hasRestoredFromUrl && map && mapReady && !routeData && !optimizing) {
      const timer = setTimeout(() => {
        optimize();
      }, 1000); // Small delay to ensure map and layers are stable
      return () => clearTimeout(timer);
    }
  }, [hasRestoredFromUrl, map, mapReady, routeData, optimizing]);

  return (
    <>
      <style>{`
        @media print {
          header, nav, .main-header, .navbar { display: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
        /* Dynamic Mapbox Popup Styling for Dark & Light Mode */
        .mapboxgl-popup-content {
          background: #ffffff !important;
          color: #1f2937 !important;
          border-radius: 12px !important;
          padding: 0 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid rgba(229, 231, 235, 0.5) !important;
        }
        .mapboxgl-popup-tip {
          border-top-color: #ffffff !important;
          border-bottom-color: #ffffff !important;
        }
        
        /* Dark Theme overrides for Mapbox popups */
        .dark .mapboxgl-popup-content {
          background: #1f2937 !important; /* bg-gray-800 */
          color: #f9fafb !important;
          border: 1px solid rgba(75, 85, 99, 0.4) !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5) !important;
        }
        
        /* Arrow tip pointing directions for dark mode */
        .dark .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
          border-bottom-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
          border-top-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
          border-right-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
          border-left-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip {
          border-bottom-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip {
          border-bottom-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip {
          border-top-color: #1f2937 !important;
        }
        .dark .mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip {
          border-top-color: #1f2937 !important;
        }
        .user-location-pulse {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
          position: relative;
        }
        .premium-spinner {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid rgba(59, 130, 246, 0.2);
          border-top-color: #3b82f6;
          animation: spin-premium 0.8s infinite linear;
        }
        @keyframes spin-premium {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .user-location-pulse::after {
          content: '';
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          top: -13px;
          left: -13px;
          animation: pulse-ring 1.8s infinite ease-out;
          opacity: 0;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
      `}</style>
      <div className={`flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 overflow-hidden relative ${isFullscreen ? 'fixed inset-0 z-50 h-screen' : ''}`}>

        {/* LEFT SIDEBAR - CONTROLS & RESULTS */}
        <div className={`lg:h-full bg-white dark:bg-gray-800 shadow-2xl z-20 flex flex-col order-2 lg:order-1 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'h-[50vh] w-full lg:w-[420px] opacity-100' : 'h-16 w-full lg:w-0 lg:opacity-0 overflow-hidden'}`}>
          <div className="w-full lg:min-w-[420px] h-full flex flex-col">
            {/* Header Section */}
            <div className="p-4 bg-gradient-to-r from-blue-700 to-purple-700 text-white shadow-md flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <FaRoute className="text-yellow-300" />
                    <span>Route Planner</span>
                  </h1>
                  <span className="text-[10px] font-medium text-blue-200 mt-0.5 uppercase tracking-widest flex items-center gap-1">
                    <div className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse"></div>
                    Powered by Sentinel v2.0
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm print:hidden"
                    title={isSidebarOpen ? "Collapse" : "Expand"}
                  >
                    <FaChevronLeft className="text-white text-sm hidden lg:block" />
                    {isSidebarOpen ? (
                      <FaChevronDown className="text-white text-sm lg:hidden" />
                    ) : (
                      <FaChevronUp className="text-white text-sm lg:hidden" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                    title="Saved Routes & History"
                  >
                    <FaBookmark className="text-white text-sm" />
                  </button>

                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

              {/* 1. Travel Mode & Options */}
              <motion.div
                initial="hidden" animate="visible" variants={containerVariants}
                className="space-y-4 print:hidden"
              >
                {/* Travel Mode Tabs */}
                <div className="bg-gray-100 dark:bg-gray-700 p-1.5 rounded-xl flex gap-1">
                  {travelModes.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = travelMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setTravelMode(mode.id)}
                        className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium flex flex-col items-center gap-1 transition-all ${isActive
                          ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm scale-100'
                          : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        <Icon className={isActive ? 'text-lg' : 'text-base'} />
                        <span className="hidden sm:inline">{mode.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Collapsible Options */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <button
                      onClick={() => setRouteOptimization(prev => !prev)}
                      className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"
                    >
                      <FaFilter className="text-blue-500" /> Route Preferences
                    </button>
                    <Link
                      to={currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin/settings" : "/user/settings"}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                      title="Settings"
                    >
                      <FaCog className="text-gray-400 text-xs" />
                    </Link>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 hover:border-blue-200 transition-colors">
                      <input type="checkbox" checked={routeOptimization} onChange={(e) => setRouteOptimization(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Optimize Stops</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 hover:border-blue-200 transition-colors">
                      <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Avoid Tolls</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 hover:border-blue-200 transition-colors">
                      <input type="checkbox" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Avoid Highways</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 hover:border-blue-200 transition-colors">
                      <input type="checkbox" checked={showAlternatives} onChange={(e) => setShowAlternatives(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Alternatives</span>
                    </label>
                  </div>
                </div>
              </motion.div>

              {/* 2. Stops Input */}
              <motion.div variants={itemVariants} className="space-y-3 print:hidden">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
                    <FaMapMarkerAlt className="text-red-500" /> Stops ({stops.length})
                  </h3>
                  <button
                    onClick={addStop}
                    disabled={stops.length >= 10}
                    className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors ${stops.length >= 10 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:text-blue-800'}`}
                  >
                    <FaPlus /> Add Stop
                  </button>
                </div>

                <div className="space-y-3 relative">
                  {/* Connecting Line Visual */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-600 z-0"></div>

                  <AnimatePresence>
                    {stops.map((s, i) => (
                      <motion.div
                        key={i}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative z-10"
                      >
                        <div className="flex gap-2 items-start">
                          {/* Marker Number */}
                          <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm mt-1 z-10 ring-2 ring-white
                          ${i === 0 ? 'bg-green-500' : i === stops.length - 1 ? 'bg-red-500' : 'bg-blue-500'}
                        `}>
                            {i + 1}
                          </div>

                          {/* Input Area */}
                          <div className="flex-1 bg-white dark:bg-gray-700 p-2 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all flex gap-2">
                            <div className="flex-1 relative">
                              <input
                                value={s.address}
                                onChange={e => onChangeAddress(i, e.target.value)}
                                placeholder={i === 0 ? "Start Location" : "Destination"}
                                className="w-full text-sm outline-none bg-transparent dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                              />
                              {/* Suggestions Dropdown */}
                              {predictions[i] && predictions[i].length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                                  {predictions[i].map((pred, idx) => (
                                    <div
                                      key={idx}
                                      onMouseDown={() => pickPrediction(i, pred)}
                                      className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-xs border-b border-gray-50 dark:border-gray-700 last:border-0"
                                    >
                                      <div className="font-medium text-gray-800 dark:text-gray-200">{pred.place_name}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-1 border-l pl-2 border-gray-100 dark:border-gray-600">
                              <button
                                onClick={() => useCurrentLocation(i)}
                                disabled={loadingLocation === i}
                                className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors ${loadingLocation === i ? 'animate-pulse' : ''}`}
                                title="Current Location"
                              >
                                <FaCrosshairs className="text-xs" />
                              </button>
                              {stops.length > 1 && (
                                <button
                                  onClick={() => removeStop(i)}
                                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remove Stop"
                                >
                                  <FaTrash className="text-xs" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* 3. Action Button */}
              <motion.div variants={itemVariants} className="sticky bottom-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm pt-2 print:hidden">
                <button
                  onClick={optimize}
                  disabled={optimizing || !map}
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {optimizing ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      Finding the best route...
                    </>
                  ) : (
                    <>
                      <FaDirections className="text-lg" /> Plan Route
                    </>
                  )}
                </button>
              </motion.div>

              {/* 4. Results Section (Conditional) */}
              <AnimatePresence>
                {routeData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-gray-100 mt-4"
                  >
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="text-blue-500 dark:text-blue-300 text-xs font-semibold uppercase">Total Distance</div>
                        <div className="text-xl font-bold text-gray-800 dark:text-white">{routeStats?.distance} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">km</span></div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                        <div className="text-purple-500 dark:text-purple-300 text-xs font-semibold uppercase">Est. Duration</div>
                        <div className="text-xl font-bold text-gray-800 dark:text-white">{routeStats?.duration} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">min</span></div>
                      </div>
                    </div>

                    {/* Quick Actions Bar */}
                    <div className="grid grid-cols-2 gap-2 mt-4 print:hidden">
                      <button
                        onClick={saveRoute}
                        disabled={isRouteSaved || isSavingRoute}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${isRouteSaved ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
                      >
                        {isSavingRoute ? (
                          <>
                            <UrbanSetuSpinner size="sm" />
                            Saving...
                          </>
                        ) : isRouteSaved ? (
                          <>
                            <FaBookmark /> Saved
                          </>
                        ) : (
                          <>
                            <FaBookmark /> Save
                          </>
                        )}
                      </button>
                      <button onClick={shareRoute} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center justify-center gap-1 transition-colors">
                        <FaShare /> Share
                      </button>
                      <button onClick={exportRoute} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center justify-center gap-1 transition-colors">
                        <FaDownload /> GPX
                      </button>
                      <button onClick={() => window.print()} className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center justify-center gap-1 transition-colors">
                        <FaPrint /> Print / PDF
                      </button>
                    </div>

                    {/* Itinerary */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-700 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Trip Timeline
                      </div>
                      <div>
                        {plan.map((p, idx) => (
                          <div key={idx} className="flex group hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors p-3 items-center gap-3 border-b border-gray-50 dark:border-gray-700 last:border-0 relative">
                            {idx !== plan.length - 1 && (
                              <div className="absolute left-[27px] top-8 bottom-[-8px] w-0.5 bg-gray-200 dark:bg-gray-600 group-hover:bg-blue-100 dark:group-hover:bg-gray-500 transition-colors"></div>
                            )}
                            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-600 shadow-sm flex items-center justify-center text-xs font-bold z-10
                                  bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 group-hover:scale-110 transition-transform
                               ">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.addr}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <FaClock className="text-gray-300 dark:text-gray-500" /> {p.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CO2 & Fuel */}
                    <div className="bg-gray-900 rounded-lg p-3 text-white flex justify-around text-center">
                      <div>
                        <div className="text-gray-400 text-xs">Est. Fuel Cost</div>
                        <div className="font-bold text-lg">₹{routeStats?.fuelCost}</div>
                      </div>
                      <div className="w-px bg-gray-700"></div>
                      <div>
                        <div className="text-gray-400 text-xs">CO₂ Emission</div>
                        <div className="font-bold text-lg">{routeStats?.co2Emission}g</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>

        {/* RIGHT/BOTTOM - MAP AREA */}
        <div className="flex-1 h-[50vh] lg:h-full relative order-1 lg:order-2">
          {/* Map Container */}
          {MAPBOX_ACCESS_TOKEN ? (
            <div className="w-full h-full relative">
              <div ref={mapRef} className="w-full h-full" />

              {/* Advanced Co-Branding Map Overlay */}
              <div className="absolute bottom-4 right-0 z-20">
                <div
                  onClick={() => setBrandExpanded(!brandExpanded)}
                  className={`bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-4 py-2 border-y border-l border-gray-200 dark:border-gray-700 shadow-2xl flex items-center gap-3 transition-all duration-700 ease-in-out cursor-pointer group ${brandExpanded ? 'rounded-l-2xl translate-x-0' : 'rounded-l-xl translate-x-[calc(100%-12px)] hover:translate-x-[calc(100%-24px)]'}`}
                >
                  <div className={`flex flex-col items-end transition-all duration-500 ${brandExpanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'}`}>
                    <span className="text-[7px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] leading-none mb-1">Intelligence Layer</span>
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest whitespace-nowrap">
                      Sentinel v2.0 Neural Layer
                    </span>
                  </div>
                  <div className={`w-px h-7 bg-gray-200 dark:bg-gray-700 transition-all duration-500 ${brandExpanded ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'}`}></div>
                  <div className={`flex flex-col items-start transition-all duration-500 ${brandExpanded ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 w-0 pointer-events-none'}`}>
                    <span className="text-[7px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] leading-none mb-1">Spatial Engine</span>
                    <span className="text-[9px] text-gray-600 dark:text-gray-300 font-semibold tracking-wide whitespace-nowrap">
                      Powered by Mapbox
                    </span>
                  </div>

                  {/* Expand Indicator (Only when collapsed) */}
                  {!brandExpanded && (
                    <div className="flex items-center justify-center w-1 h-8 ml-[-12px]">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.6)]"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Map Controls */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {!isSidebarOpen && (
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors hidden lg:flex items-center justify-center text-gray-600 dark:text-gray-300"
                    title="Open Sidebar"
                  >
                    <FaChevronRight size={18} />
                  </button>
                )}
                <button
                  onClick={() => setShowMapStyles(!showMapStyles)}
                  className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center text-gray-600 dark:text-gray-300"
                  title="Change Map Style"
                >
                  <FaLayerGroup size={18} />
                </button>
                <button
                  onClick={showUserLocationOnMap}
                  className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center text-blue-600 dark:text-blue-400"
                  title="Show My Location"
                >
                  <FaCrosshairs size={18} />
                </button>
              </div>

              {/* Fullscreen control */}
              <div className="absolute top-4 right-14 z-10">
                <button
                  onClick={() => {
                    const newFullscreen = !isFullscreen;
                    setIsFullscreen(newFullscreen);
                    if (newFullscreen) hideHeader(); else showHeader();
                  }}
                  className="p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg shadow-lg transition-all"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <FaCompress /> : <FaExpand />}
                </button>
              </div>

              {/* Error Overlay */}
              {mapError && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="text-center p-6 bg-white rounded-xl shadow-2xl">
                    <FaRoute className="text-4xl text-red-500 mx-auto mb-3" />
                    <p className="text-red-600 font-medium mb-2">{mapError}</p>
                    <button onClick={() => { setMapError(null); setMapReady(false); setTimeout(() => setMapReady(true), 100); }} className="text-blue-600 hover:underline text-sm">Retry Connection</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
              <div className="text-center p-8">
                <FaRoute className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Map Unavailable</h3>
                <p className="text-gray-500 dark:text-gray-400">Please configure your Mapbox Access Token to view the map.</p>
              </div>
            </div>
          )}

          {/* Map Styles List */}
          <AnimatePresence>
            {showMapStyles && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-16 left-4 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-w-[150px]"
              >
                {Object.entries(mapStyles).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => {
                      changeMapStyle(key);
                      setShowMapStyles(false);
                    }}
                    className={`p-2 px-3 text-xs font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${mapStyle === key ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-2 border-blue-600' : 'text-gray-600 dark:text-gray-300'}`}
                    title={key}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                  </button>
                ))}
                <button onClick={toggleTraffic} className={`p-2 px-3 text-xs font-medium text-left border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${showTraffic ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' : 'text-gray-600 dark:text-gray-300'}`}>
                  Traffic {showTraffic ? 'On' : 'Off'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Saved Routes Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaBookmark className="text-blue-600" /> Saved Routes & History
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-8">
                {/* Saved Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><div className="w-2 h-6 bg-blue-500 rounded-full"></div> Saved Routes</h3>
                    {savedRoutes.length > 0 && <button onClick={deleteAllSavedRoutes} className="text-xs text-red-600 hover:underline">Clear All</button>}
                  </div>
                  {savedRoutes.length > 0 ? (
                    <div className="grid gap-3">
                      {savedRoutes.map((route) => (
                        <div key={route._id || route.id} className="bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow flex justify-between items-center group">
                          <div>
                            <div className="font-semibold text-gray-800 dark:text-white">{route.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">{new Date(route.timestamp).toLocaleDateString()} • {route.travelMode}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { loadRoute(route); setShowSettings(false); }} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">Load</button>
                            <button onClick={() => deleteSavedRoute(route._id || route.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><FaTrash /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">No saved routes used yet.</div>
                  )}
                </div>

                {/* History Section */}
                <div>
                  <h3 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4"><div className="w-2 h-6 bg-orange-500 rounded-full"></div> Recent History</h3>
                  <div className="space-y-2">
                    {routeHistory.slice(0, 5).map((route) => (
                      <div key={route.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-gray-600" onClick={() => { loadRoute(route); setShowSettings(false); }}>
                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400"><FaHistory /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{route.stops.map(s => s.address.split(',')[0]).join(' → ')}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{route.timestamp.toLocaleString()}</div>
                        </div>
                        <FaDirections className="text-gray-300 dark:text-gray-500" />
                      </div>
                    ))}
                    {routeHistory.length === 0 && <div className="text-sm text-gray-400 italic">No recent history available.</div>}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
      />
      <SocialSharePanel
        isOpen={showSharePanel}
        onClose={() => setShowSharePanel(false)}
        url={shareConfig.url}
        title={shareConfig.title}
        description={shareConfig.description}
      />
    </>
  );
}