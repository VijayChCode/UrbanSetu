import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { usePageTitle } from '../hooks/usePageTitle';
import AdminFraudManagementSkeleton from '../components/skeletons/AdminFraudManagementSkeleton';
import { FaShieldAlt } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminFraudManagement() {
  // Set page title
  usePageTitle("Fraud Management - Security Monitoring");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ suspiciousListings: 0, suspectedFakeReviews: 0, lastScan: null });
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sortBy, setSortBy] = useState('severity');
  const [pageL, setPageL] = useState(1);
  const [pageR, setPageR] = useState(1);
  const pageSize = 10;
  const [selectedRows, setSelectedRows] = useState({ listings: new Set(), reviews: new Set() });
  const [includeLowSeverity, setIncludeLowSeverity] = useState(false);
  const [resolvedListings, setResolvedListings] = useState(() => new Set(JSON.parse(localStorage.getItem('fraud_resolved_listings') || '[]')));
  const [resolvedReviews, setResolvedReviews] = useState(() => new Set(JSON.parse(localStorage.getItem('fraud_resolved_reviews') || '[]')));
  const [showSelectMode, setShowSelectMode] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [fraudRes, allListingsRes, allReviewsRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/api/ai/fraud/stats`),
        authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=10000`),
        authenticatedFetch(`${API_BASE_URL}/api/review/admin/all?status=approved&limit=1000&sort=date&order=desc`)
      ]);
      const fraud = await fraudRes.json();
      const allListings = await allListingsRes.json();
      const allReviews = await allReviewsRes.json();
      setStats(fraud);
      // Heuristic flags in UI
      const prices = allListings.map(l => (l.offer && l.discountPrice) ? l.discountPrice : l.regularPrice).filter(Boolean);
      const mean = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const variance = prices.length ? prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length : 0;
      const std = Math.sqrt(variance) || 1;
      const upper = mean + 3 * std; const lower = Math.max(0, mean - 3 * std);

      // Precompute maps for cross-listing checks
      const descMap = new Map();
      const addressToCities = new Map();
      const contactMap = new Map(); // phone/email -> set of userRefs
      const ownerRecentCounts = new Map(); // userRef -> listings created in last 24h
      const now = Date.now();
      const phoneRegex = /\b(?:\+?\d[\s-]?){7,15}\b/g;
      const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

      (allListings || []).forEach(l => {
        const d = norm(l.description || '');
        if (d) descMap.set(d, (descMap.get(d) || 0) + 1);
        const addr = norm(l.address || `${l.propertyNumber || ''} ${l.landmark || ''}`);
        const cityKey = `${l.city || ''},${l.state || ''}`;
        if (addr) {
          const set = addressToCities.get(addr) || new Set();
          set.add(cityKey);
          addressToCities.set(addr, set);
        }
        const contacts = new Set([...(d.match(phoneRegex) || []), ...(d.match(emailRegex) || [])]);
        contacts.forEach(c => {
          const key = c;
          const set = contactMap.get(key) || new Set();
          set.add((l.userRef && (l.userRef._id || l.userRef)) || 'unknown');
          contactMap.set(key, set);
        });
        const createdAt = new Date(l.createdAt || 0).getTime();
        if (now - createdAt <= 24 * 60 * 60 * 1000) {
          const owner = (l.userRef && (l.userRef._id || l.userRef)) || 'unknown';
          ownerRecentCounts.set(owner, (ownerRecentCounts.get(owner) || 0) + 1);
        }
      });

      const suspiciousPhrases = [
        'advance payment only', 'send money before visit', 'contact on whatsapp only',
        'no site visit', 'only online deal', 'pay booking amount first', 'urgent sale',
        'quick deal', 'cash only', 'no broker', 'direct owner', 'immediate possession',
        'bank loan not required', 'black money accepted', 'under table', 'negotiable',
        'call now', 'whatsapp me', 'serious buyers only', 'time wasters stay away'
      ];

      // Pre-hash images for duplicate detection using a simple perceptual hash (average hash)
      const imageHashMap = new Map(); // hash -> list of listingIds
      const listingIdToImageHashes = new Map();
      const isSameOrigin = (src) => {
        try {
          const url = new URL(src, window.location.origin);
          return url.origin === window.location.origin;
        } catch {
          return false;
        }
      };

      const computeAverageHash = async (src) => {
        try {
          if (!isSameOrigin(src)) {
            return null; // Skip cross-origin images to avoid CORS taint and console errors
          }
          // Use offscreen canvas for quick aHash (8x8 grayscale)
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const loaded = await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
          const canvas = document.createElement('canvas');
          canvas.width = 8; canvas.height = 8;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 8, 8);
          const data = ctx.getImageData(0, 0, 8, 8).data;
          const pixels = [];
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            pixels.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
          }
          const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
          let hash = '';
          pixels.forEach(p => { hash += (p >= avg) ? '1' : '0'; });
          return hash;
        } catch { return null; }
      };

      // Best-effort compute hashes (limit to first 2 images per listing to keep it light)
      const hashPromises = (allListings || []).map(async (lst) => {
        const urls = (lst.imageUrls || []).slice(0, 2);
        const hashes = [];
        for (const url of urls) {
          const h = await computeAverageHash(url);
          if (h) hashes.push(h);
        }
        listingIdToImageHashes.set(lst._id, hashes);
        hashes.forEach(h => {
          const arr = imageHashMap.get(h) || [];
          arr.push(lst._id);
          imageHashMap.set(h, arr);
        });
      });
      await Promise.all(hashPromises);

      const simpleWatermarkDetected = async (src) => {
        try {
          if (!isSameOrigin(src)) {
            return false; // Skip cross-origin images
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
          const canvas = document.createElement('canvas');
          const w = 64, h = 64; // sample corners at low-res
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const sampleBoxes = [
            [0, 0, 16, 16], // top-left
            [w - 16, 0, 16, 16], // top-right
            [0, h - 16, 16, 16], // bottom-left
            [w - 16, h - 16, 16, 16], // bottom-right
          ];
          let cornerTextLike = 0;
          for (const [sx, sy, sw, sh] of sampleBoxes) {
            const data = ctx.getImageData(sx, sy, sw, sh).data;
            // crude heuristic: high-contrast, many near-white pixels suggests overlaid logo/text
            let nearWhite = 0, nearBlack = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
              if (l > 235) nearWhite++;
              if (l < 20) nearBlack++;
            }
            const ratioWhite = nearWhite / (data.length / 4);
            const ratioBlack = nearBlack / (data.length / 4);
            if (ratioWhite > 0.25 && ratioBlack > 0.05) cornerTextLike++;
          }
          return cornerTextLike >= 2; // watermark likely present in at least two corners
        } catch { return false; }
      };

      const flaggedListings = allListings.map(l => {
        const price = (l.offer && l.discountPrice) ? l.discountPrice : l.regularPrice;
        const reasons = [];
        if (!l.imageUrls || l.imageUrls.length === 0) reasons.push('No images');
        if (price && (price > upper || price < lower)) reasons.push('Price outlier');
        // Extra strict low-price detection (potential scam) - below 1 lakh
        if (price && price < 100000) reasons.push('Unrealistically low price');
        // Absolute unrealistic threshold as safety net (currency INR)
        if (price && price <= 1000) reasons.push('Suspiciously low absolute price');
        // Duplicate / fake content: description reused
        const d = norm(l.description || '');
        if (d && (descMap.get(d) || 0) >= 2) reasons.push('Description duplicated');
        // Suspicious language in description
        if (d && suspiciousPhrases.some(p => d.includes(p))) reasons.push('Suspicious language');
        // Same contact used across different owners
        const contacts = new Set([...(d.match(phoneRegex) || []), ...(d.match(emailRegex) || [])]);
        const owner = (l.userRef && (l.userRef._id || l.userRef)) || 'unknown';
        let reusedContact = false;
        contacts.forEach(c => { if ((contactMap.get(c) || new Set()).size > 1) reusedContact = true; });
        if (reusedContact) reasons.push('Contact reused across accounts');
        // Address used in multiple cities
        const addr = norm(l.address || `${l.propertyNumber || ''} ${l.landmark || ''}`);
        if (addr && (addressToCities.get(addr) || new Set()).size > 1) reasons.push('Same address in different cities');
        // Owner risk: many listings in short time
        if ((ownerRecentCounts.get(owner) || 0) >= 5) reasons.push('High posting velocity');

        // Additional fraud detection criteria
        // Very short description (potential spam)
        if (d && d.length < 20) reasons.push('Very short description');

        // All caps description (spam indicator)
        if (d && d === d.toUpperCase() && d.length > 10) reasons.push('All caps description');

        // Multiple exclamation marks (spam indicator)
        if (d && (d.match(/!/g) || []).length >= 3) reasons.push('Excessive exclamation marks');

        // Suspicious contact patterns
        const phoneCount = (d.match(phoneRegex) || []).length;
        const emailCount = (d.match(emailRegex) || []).length;
        if (phoneCount >= 2 || emailCount >= 2) reasons.push('Multiple contact methods');

        // Price inconsistency with property details
        if (price && l.bedrooms && l.bedrooms >= 3 && price < 500000) {
          reasons.push('Low price for multi-bedroom property');
        }

        // Suspicious location patterns
        if (l.city && l.city.toLowerCase().includes('test')) reasons.push('Test city name');

        return { ...l, _fraudReasons: reasons };
      }).filter(l => l._fraudReasons.length > 0);

      const reviewMap = new Map();
      (allReviews.reviews || allReviews || []).forEach(r => {
        const t = (r.comment || '').trim().toLowerCase();
        if (!t) return; reviewMap.set(t, (reviewMap.get(t) || 0) + 1);
      });
      const repetitiveTexts = new Set(Array.from(reviewMap.entries()).filter(([, c]) => c >= 3).map(([t]) => t));
      const suspiciousReviewPhrases = [
        'scam', 'fraud', 'don\'t book', 'best deal', 'don\'t miss', 'very cheap', 'cheat', 'fake', 'beware',
        'don\'t trust', 'spam', 'promotion', 'too good to be true', 'advance payment', 'deposit first', 'pay first',
        'upi', 'gpay', 'paytm', 'whatsapp only', 'no visit', 'online only', 'deal outside platform', 'refund for review',
        'cashback for review', '5 star for discount', 'paid review', 'incentivized review', 'excellent service',
        'highly recommended', 'must try', 'amazing experience', 'perfect', 'outstanding', 'brilliant', 'fantastic',
        'wonderful', 'incredible', 'superb', 'exceptional', 'marvelous', 'phenomenal', 'extraordinary', 'remarkable'
      ];
      const reviewsArr = (allReviews.reviews || allReviews || []);
      // Build maps for burst/time/city behaviors
      const byListing = new Map();
      const byUser = new Map();
      reviewsArr.forEach(r => {
        const lid = (r.listingId && (r.listingId._id || r.listingId)) || r.listingId;
        const uid = (r.userId && (r.userId._id || r.userId)) || r.userId;
        const created = new Date(r.createdAt || 0).getTime();
        if (!byListing.has(lid)) byListing.set(lid, []);
        byListing.get(lid).push(r);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push(r);
        r._created = created;
      });
      // Rating flood detection per listing (last 3 days)
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const listingFlood = new Map();
      byListing.forEach((arr, lid) => {
        const recent = arr.filter(r => r._created >= threeDaysAgo);
        const fiveStar = recent.filter(r => (r.rating || 0) >= 5).length;
        const oneStar = recent.filter(r => (r.rating || 0) <= 1).length;
        listingFlood.set(lid, { fiveStar, oneStar });
      });
      // Burst activity: >5 reviews within 30 minutes per listing
      const burstByListing = new Map();
      byListing.forEach((arr, lid) => {
        const sorted = [...arr].sort((a, b) => a._created - b._created);
        let burst = false;
        for (let i = 0; i < sorted.length; i++) {
          const start = sorted[i]._created;
          let count = 1;
          for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j]._created - start <= 30 * 60 * 1000) count++; else break;
          }
          if (count >= 5) { burst = true; break; }
        }
        burstByListing.set(lid, burst);
      });
      // Reviewer behavior: multi-city within 60 minutes
      const userCityTimeFlag = new Map();
      byUser.forEach((arr, uid) => {
        const sorted = [...arr].sort((a, b) => a._created - b._created);
        let flag = false;
        for (let i = 0; i < sorted.length; i++) {
          const cityA = (sorted[i].listingId && sorted[i].listingId.city) || '';
          for (let j = i + 1; j < sorted.length; j++) {
            const cityB = (sorted[j].listingId && sorted[j].listingId.city) || '';
            if (cityA && cityB && cityA !== cityB && (sorted[j]._created - sorted[i]._created) <= 60 * 60 * 1000) { flag = true; break; }
          }
          if (flag) break;
        }
        userCityTimeFlag.set(uid, flag);
      });

      const flaggedReviews = reviewsArr.map(r => {
        const reasons = [];
        const text = (r.comment || '').trim().toLowerCase();
        if (repetitiveTexts.has(text)) reasons.push('Identical text across accounts');
        if (suspiciousReviewPhrases.some(p => text.includes(p))) reasons.push('Suspicious language');
        const lid = (r.listingId && (r.listingId._id || r.listingId)) || r.listingId;
        const flood = listingFlood.get(lid) || { fiveStar: 0, oneStar: 0 };
        if (flood.fiveStar >= 10) reasons.push('5-star flood');
        if (flood.oneStar >= 10) reasons.push('1-star flood');
        const uid = (r.userId && (r.userId._id || r.userId)) || r.userId;
        if (userCityTimeFlag.get(uid)) reasons.push('Reviewer multi-city in short time');

        // Additional review fraud detection criteria
        // Very short reviews (potential spam)
        if (text.length < 10) reasons.push('Very short review');

        // All caps reviews (spam indicator)
        if (r.comment && r.comment === r.comment.toUpperCase() && r.comment.length > 10) {
          reasons.push('All caps review');
        }

        // Excessive punctuation
        if (r.comment && ((r.comment.match(/!/g) || []).length >= 3 || (r.comment.match(/\?/g) || []).length >= 3)) {
          reasons.push('Excessive punctuation');
        }

        // Rating inconsistency with comment sentiment
        const rating = r.rating || 0;
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'nice', 'helpful', 'fast', 'clean', 'spacious', 'recommended'];
        const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'hate', 'dirty', 'small', 'slow', 'rude', 'noisy', 'not recommended', 'worst'];

        let sentimentScore = 0;
        positiveWords.forEach(w => { if (text.includes(w)) sentimentScore++; });
        negativeWords.forEach(w => { if (text.includes(w)) sentimentScore--; });

        if (rating >= 4 && sentimentScore < 0) reasons.push('Rating-comment mismatch (high rating, negative sentiment)');
        if (rating <= 2 && sentimentScore > 0) reasons.push('Rating-comment mismatch (low rating, positive sentiment)');

        // Generic template reviews
        const genericTemplates = [
          'good property', 'nice place', 'worth it', 'satisfied', 'happy with',
          'recommended', 'good service', 'nice experience', 'will visit again'
        ];
        if (genericTemplates.some(template => text.includes(template)) && text.length < 30) {
          reasons.push('Generic template review');
        }

        // Suspicious rating patterns (all 5-star or all 1-star from same user)
        const userReviews = byUser.get(uid) || [];
        if (userReviews.length >= 3) {
          const userRatings = userReviews.map(ur => ur.rating || 0);
          const allSameRating = userRatings.every(rating => rating === userRatings[0]);
          if (allSameRating && (userRatings[0] === 5 || userRatings[0] === 1)) {
            reasons.push('Suspicious rating pattern');
          }
        }

        return { ...r, _fraudReasons: reasons };
      }).filter(r => r._fraudReasons.length > 0);

      // Enhance listing reasons with image-based checks
      const enhancedListings = await Promise.all(flaggedListings.map(async (lst) => {
        const reasons = new Set(lst._fraudReasons || []);
        // Reverse image duplicate based on hash collision across different listings
        const hashes = listingIdToImageHashes.get(lst._id) || [];
        let duplicateFound = false;
        for (const h of hashes) {
          const arr = imageHashMap.get(h) || [];
          const others = arr.filter(id => String(id) !== String(lst._id));
          if (others.length >= 1) { duplicateFound = true; break; }
        }
        if (duplicateFound) reasons.add('Stolen images suspected');
        // Watermark/logo heuristic on first image only to keep it cheap
        const firstImage = (lst.imageUrls || [])[0];
        if (firstImage) {
          const wm = await simpleWatermarkDetected(firstImage);
          if (wm) reasons.add('Watermark/logo detected');
        }
        // Fake phone heuristic in description
        const text = (lst.description || '').toLowerCase();
        const digits = (text.match(/\d/g) || []).length;
        if (digits >= 10) {
          // If too many repeating digits like 9999999999 or obvious sequences
          if (/([0-9])\1{5,}/.test(text) || /(123456|987654)/.test(text)) {
            reasons.add('Suspicious phone number pattern');
          }
        }
        return { ...lst, _fraudReasons: Array.from(reasons) };
      }));

      const filteredListings = enhancedListings.filter(l => !resolvedListings.has(String(l._id)));
      const filteredReviews = flaggedReviews.filter(r => !resolvedReviews.has(String(r._id)));
      setListings(filteredListings);
      setReviews(filteredReviews);
      // Update visible counters to match current data
      setStats(prev => ({
        ...prev,
        suspiciousListings: filteredListings.length,
        suspectedFakeReviews: filteredReviews.length,
        lastScan: new Date().toISOString()
      }));
    } catch (e) {
      setError('Failed to load fraud data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return <AdminFraudManagementSkeleton />;
  }

  const finalListings = listings
    .filter(l => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const fields = [
        l.name,
        l.city,
        l.state,
        (l.description || ''),
        (l._fraudReasons || []).join(' ')
      ].join(' ').toLowerCase();
      return fields.includes(q);
    })
    .filter(l => includeLowSeverity ? true : (l._fraudReasons || []).length >= 2)
    .filter(l => reasonFilter === 'all' ? true : (l._fraudReasons || []).includes(reasonFilter))
    .sort((a, b) => {
      if (sortBy === 'alpha') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      const sa = (a._fraudReasons || []).length, sb = (b._fraudReasons || []).length; return sb - sa;
    });

  const finalReviews = reviews
    .filter(r => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const fields = [
        (r.listingId?.name) || String(r.listingId || ''),
        (r.userId?.email) || String(r.userId || ''),
        (r.comment || ''),
        (r._fraudReasons || []).join(' ')
      ].join(' ').toLowerCase();
      return fields.includes(q);
    })
    .filter(r => includeLowSeverity ? true : (r._fraudReasons || []).length >= 2)
    .filter(r => reasonFilter === 'all' ? true : (r._fraudReasons || []).includes(reasonFilter))
    .sort((a, b) => {
      if (sortBy === 'alpha') return String(a.listingId?.name || '').localeCompare(String(b.listingId?.name || ''));
      if (sortBy === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      const sa = (a._fraudReasons || []).length, sb = (b._fraudReasons || []).length; return sb - sa;
    });

  const totalPagesL = Math.max(1, Math.ceil(finalListings.length / pageSize));
  const totalPagesR = Math.max(1, Math.ceil(finalReviews.length / pageSize));

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-slate-900 dark:to-slate-950 min-h-screen py-6 sm:py-10 px-2 md:px-8">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="w-full mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <h3 className="text-3xl font-extrabold text-blue-700 dark:text-indigo-400 drop-shadow">Fraud Management</h3>
          <div className="flex gap-2 flex-wrap">
            <button className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60 text-sm hover:bg-blue-700 transition-colors" disabled={loading} onClick={fetchData}>{loading ? 'Scanning…' : 'Scan Now'}</button>
            <button className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1.5" onClick={() => navigate('/admin/sentinel')}>
              <FaShieldAlt /> Sentinel Command
            </button>
            <button className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors flex items-center gap-1.5" onClick={() => navigate('/admin/audit-trail')}>
              View Audit Trail
            </button>
            <button className="px-3 py-2 bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-all" onClick={() => navigate('/admin')}>Back</button>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700" checked={includeLowSeverity} onChange={(e) => { setIncludeLowSeverity(e.target.checked); setPageL(1); setPageR(1); }} />
              Include low severity
            </label>
          </div>
        </div>
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <div className="text-sm text-gray-600 dark:text-gray-400">Suspicious Listings</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.suspiciousListings}</div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                <div className="text-sm text-gray-600 dark:text-gray-400">Suspected Fake Reviews</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.suspectedFakeReviews}</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <div className="text-sm text-gray-600 dark:text-gray-400">Last Scan</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{stats.lastScan ? new Date(stats.lastScan).toLocaleString() : 'N/A'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="all">All</option>
                <option value="listings">Suspicious Listings</option>
                <option value="reviews">Suspected Fake Reviews</option>
              </select>
              <select value={reasonFilter} onChange={(e) => { setReasonFilter(e.target.value); setPageL(1); setPageR(1); }} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="all">All reasons</option>
                {/* Listing fraud reasons */}
                <option value="Price outlier">Price outlier</option>
                <option value="Unrealistically low price">Unrealistically low price</option>
                <option value="Suspiciously low absolute price">Suspiciously low absolute price</option>
                <option value="Description duplicated">Description duplicated</option>
                <option value="Suspicious language">Suspicious language</option>
                <option value="Contact reused across accounts">Contact reused</option>
                <option value="Same address in different cities">Address conflict</option>
                <option value="High posting velocity">High posting velocity</option>
                <option value="No images">No images</option>
                <option value="Very short description">Very short description</option>
                <option value="All caps description">All caps description</option>
                <option value="Excessive exclamation marks">Excessive exclamation marks</option>
                <option value="Multiple contact methods">Multiple contact methods</option>
                <option value="Low price for multi-bedroom property">Low price for multi-bedroom</option>
                <option value="Test city name">Test city name</option>
                <option value="Stolen images suspected">Stolen images suspected</option>
                <option value="Watermark/logo detected">Watermark/logo detected</option>
                {/* Review fraud reasons */}
                <option value="Identical text across accounts">Identical text</option>
                <option value="5-star flood">5-star flood</option>
                <option value="1-star flood">1-star flood</option>
                <option value="Reviewer multi-city in short time">Reviewer anomaly</option>
                <option value="Very short review">Very short review</option>
                <option value="All caps review">All caps review</option>
                <option value="Excessive punctuation">Excessive punctuation</option>
                <option value="Rating-comment mismatch (high rating, negative sentiment)">Rating-comment mismatch</option>
                <option value="Generic template review">Generic template review</option>
                <option value="Suspicious rating pattern">Suspicious rating pattern</option>
              </select>
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); }} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="severity">Sort: Severity</option>
                <option value="recent">Sort: Most Recent</option>
                <option value="alpha">Sort: Alphabetical</option>
              </select>
              {/* Search and Sort */}
              <input
                className="border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400 rounded p-2 text-sm flex-1 min-w-[180px] outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Search text, reasons, city, user, listing…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm" onClick={() => {
                // CSV export minimal
                const rows = [
                  ['Type', 'Listing', 'User', 'Reasons', 'Comment'],
                  ...listings.map(l => ['listing', l.name, '', (l._fraudReasons || []).join('|'), (l.description || '').replace(/\n/g, ' ')]),
                  ...reviews.map(r => ['review', (r.listingId?.name) || String(r.listingId), (r.userId?.email) || String(r.userId), (r._fraudReasons || []).join('|'), (r.comment || '').replace(/\n/g, ' ')])
                ];
                const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'fraud-report.csv'; a.click();
                URL.revokeObjectURL(url);
              }}>Export CSV</button>
              {showSelectMode ? (
                <div className="flex gap-2">
                  <button className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm" onClick={() => {
                    // Bulk resolve: persist hidden IDs and remove from current view
                    const newResolvedListings = new Set(JSON.parse(localStorage.getItem('fraud_resolved_listings') || '[]'));
                    selectedRows.listings.forEach(id => newResolvedListings.add(String(id)));
                    localStorage.setItem('fraud_resolved_listings', JSON.stringify(Array.from(newResolvedListings)));
                    const newResolvedReviews = new Set(JSON.parse(localStorage.getItem('fraud_resolved_reviews') || '[]'));
                    selectedRows.reviews.forEach(id => newResolvedReviews.add(String(id)));
                    localStorage.setItem('fraud_resolved_reviews', JSON.stringify(Array.from(newResolvedReviews)));
                    setListings(prev => prev.filter(x => !selectedRows.listings.has(x._id)));
                    setReviews(prev => prev.filter(x => !selectedRows.reviews.has(x._id)));
                    setSelectedRows({ listings: new Set(), reviews: new Set() });
                    setShowSelectMode(false);
                  }}>Resolve Selected</button>
                  <button className="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm" onClick={() => {
                    setShowSelectMode(false);
                    setSelectedRows({ listings: new Set(), reviews: new Set() });
                  }}>Cancel</button>
                </div>
              ) : (
                <button className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm" onClick={() => {
                  setShowSelectMode(true);
                }}>Select</button>
              )}
            </div>

            {(filter === 'all' || filter === 'listings') && (
              <div className="mb-8">
                <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Suspicious Listings</h4>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                      <tr>
                        {showSelectMode && <th className="p-3 text-left w-8">Select</th>}
                        <th className="p-3 text-left">Name</th>
                        <th className="p-3 text-left">City</th>
                        <th className="p-3 text-left">Reasons</th>
                        <th className="p-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {finalListings
                        .slice((pageL - 1) * pageSize, pageL * pageSize)
                        .map((l, index) => (
                          <tr key={l._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}>
                            {showSelectMode && <td className="p-3"><input type="checkbox" className="rounded dark:bg-gray-700 dark:border-gray-600" checked={selectedRows.listings.has(l._id)} onChange={(e) => {
                              const ns = new Set(selectedRows.listings); if (e.target.checked) ns.add(l._id); else ns.delete(l._id);
                              setSelectedRows(s => ({ ...s, listings: ns }));
                            }} /></td>}
                            <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{l.name}</td>
                            <td className="p-3 text-gray-600 dark:text-gray-400">{l.city}, {l.state}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {(l._fraudReasons || []).map((reason, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-[10px] font-bold">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3"><div className="flex flex-wrap gap-2">
                              <Link to={`/admin/listing/${l._id}`} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs sm:text-sm transition-colors">Open</Link>
                              <button className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs sm:text-sm transition-colors" onClick={() => window.open(`/admin/listing/${l._id}`, '_blank')}>New Tab</button>
                            </div></td>
                          </tr>
                        ))}
                      {finalListings.length === 0 && (
                        <tr><td className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center italic" colSpan={showSelectMode ? 5 : 4}>No suspicious listings found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination for listings */}
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50" disabled={pageL === 1} onClick={() => setPageL(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Page {pageL} of {totalPagesL}</span>
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={pageL === totalPagesL} onClick={() => setPageL(p => Math.min(totalPagesL, p + 1))}>Next</button>
                </div>
              </div>
            )}

            {(filter === 'all' || filter === 'reviews') && (
              <div>
                <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Suspected Fake Reviews</h4>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                      <tr>
                        {showSelectMode && <th className="p-3 text-left w-8">Select</th>}
                        <th className="p-3 text-left text-xs uppercase tracking-wider font-bold">Listing</th>
                        <th className="p-3 text-left text-xs uppercase tracking-wider font-bold">User</th>
                        <th className="p-3 text-left text-xs uppercase tracking-wider font-bold">Comment</th>
                        <th className="p-3 text-left text-xs uppercase tracking-wider font-bold">Reasons</th>
                        <th className="p-3 text-left text-xs uppercase tracking-wider font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {finalReviews
                        .slice((pageR - 1) * pageSize, pageR * pageSize)
                        .map((r, index) => (
                          <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}>
                            {showSelectMode && <td className="p-3"><input type="checkbox" className="rounded dark:bg-gray-700 dark:border-gray-600" checked={selectedRows.reviews.has(r._id)} onChange={(e) => {
                              const ns = new Set(selectedRows.reviews); if (e.target.checked) ns.add(r._id); else ns.delete(r._id);
                              setSelectedRows(s => ({ ...s, reviews: ns }));
                            }} /></td>}
                            <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{r.listingId?.name || r.listingId}</td>
                            <td className="p-3 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">{r.userId?.email || r.userId}</td>
                            <td className="p-3 max-w-[10rem] sm:max-w-md truncate text-gray-600 dark:text-gray-300 italic" title={r.comment}>"{r.comment}"</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {(r._fraudReasons || []).map((reason, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-[10px] font-bold">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3"><div className="flex flex-wrap gap-2">
                              <a href={`/admin/listing/${r.listingId?._id || r.listingId}`} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs sm:text-sm transition-colors">Open</a>
                              <button className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs sm:text-sm transition-colors" onClick={() => window.open(`/admin/listing/${r.listingId?._id || r.listingId}`, '_blank')}>New Tab</button>
                            </div></td>
                          </tr>
                        ))}
                      {finalReviews.length === 0 && (
                        <tr><td className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center italic" colSpan={showSelectMode ? 6 : 5}>No suspected fake reviews found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination for reviews */}
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50" disabled={pageR === 1} onClick={() => setPageR(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Page {pageR} of {totalPagesR}</span>
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={pageR === totalPagesR} onClick={() => setPageR(p => Math.min(totalPagesR, p + 1))}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}