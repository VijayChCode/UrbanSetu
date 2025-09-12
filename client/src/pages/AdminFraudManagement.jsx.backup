import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminFraudManagement() {
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
        fetch(`${API_BASE_URL}/api/ai/fraud/stats`),
        fetch(`${API_BASE_URL}/api/listing/get?limit=10000`),
        fetch(`${API_BASE_URL}/api/review/admin/all?status=approved&limit=1000&sort=date&order=desc`, { credentials: 'include' })
      ]);
      const fraud = await fraudRes.json();
      const allListings = await allListingsRes.json();
      const allReviews = await allReviewsRes.json();
      setStats(fraud);
      // Heuristic flags in UI
      const prices = allListings.map(l => (l.offer && l.discountPrice) ? l.discountPrice : l.regularPrice).filter(Boolean);
      const mean = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : 0;
      const variance = prices.length ? prices.reduce((a,b)=>a+Math.pow(b-mean,2),0)/prices.length : 0;
      const std = Math.sqrt(variance) || 1;
      const upper = mean + 3*std; const lower = Math.max(0, mean - 3*std);

      // Precompute maps for cross-listing checks
      const descMap = new Map();
      const addressToCities = new Map();
      const contactMap = new Map(); // phone/email -> set of userRefs
      const ownerRecentCounts = new Map(); // userRef -> listings created in last 24h
      const now = Date.now();
      const phoneRegex = /\b(?:\+?\d[\s-]?){7,15}\b/g;
      const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
      const norm = (s) => (s||'').toLowerCase().replace(/\s+/g,' ').trim();

      (allListings || []).forEach(l => {
        const d = norm(l.description||'');
        if (d) descMap.set(d, (descMap.get(d)||0)+1);
        const addr = norm(l.address || `${l.propertyNumber||''} ${l.landmark||''}`);
        const cityKey = `${l.city||''},${l.state||''}`;
        if (addr) {
          const set = addressToCities.get(addr) || new Set();
          set.add(cityKey);
          addressToCities.set(addr, set);
        }
        const contacts = new Set([...(d.match(phoneRegex)||[]), ...(d.match(emailRegex)||[])]);
        contacts.forEach(c => {
          const key = c;
          const set = contactMap.get(key) || new Set();
          set.add((l.userRef && (l.userRef._id||l.userRef)) || 'unknown');
          contactMap.set(key, set);
        });
        const createdAt = new Date(l.createdAt||0).getTime();
        if (now - createdAt <= 24*60*60*1000) {
          const owner = (l.userRef && (l.userRef._id||l.userRef)) || 'unknown';
          ownerRecentCounts.set(owner, (ownerRecentCounts.get(owner)||0)+1);
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
          const data = ctx.getImageData(0,0,8,8).data;
          const pixels = [];
          for (let i=0;i<data.length;i+=4){
            const r=data[i], g=data[i+1], b=data[i+2];
            pixels.push(Math.round(0.299*r+0.587*g+0.114*b));
          }
          const avg = pixels.reduce((a,b)=>a+b,0)/pixels.length;
          let hash = '';
          pixels.forEach(p => { hash += (p >= avg) ? '1' : '0'; });
          return hash;
        } catch { return null; }
      };

      // Best-effort compute hashes (limit to first 2 images per listing to keep it light)
      const hashPromises = (allListings || []).map(async (lst) => {
        const urls = (lst.imageUrls || []).slice(0,2);
        const hashes = [];
        for (const url of urls){
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
            [0,0,16,16], // top-left
            [w-16,0,16,16], // top-right
            [0,h-16,16,16], // bottom-left
            [w-16,h-16,16,16], // bottom-right
          ];
          let cornerTextLike = 0;
          for (const [sx,sy,sw,sh] of sampleBoxes){
            const data = ctx.getImageData(sx,sy,sw,sh).data;
            // crude heuristic: high-contrast, many near-white pixels suggests overlaid logo/text
            let nearWhite = 0, nearBlack = 0;
            for (let i=0;i<data.length;i+=4){
              const r=data[i], g=data[i+1], b=data[i+2];
              const l = Math.round(0.299*r+0.587*g+0.114*b);
              if (l > 235) nearWhite++;
              if (l < 20) nearBlack++;
            }
            const ratioWhite = nearWhite / (data.length/4);
            const ratioBlack = nearBlack / (data.length/4);
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
        const d = norm(l.description||'');
        if (d && (descMap.get(d)||0) >= 2) reasons.push('Description duplicated');
        // Suspicious language in description
        if (d && suspiciousPhrases.some(p => d.includes(p))) reasons.push('Suspicious language');
        // Same contact used across different owners
        const contacts = new Set([...(d.match(phoneRegex)||[]), ...(d.match(emailRegex)||[])]);
        const owner = (l.userRef && (l.userRef._id||l.userRef)) || 'unknown';
        let reusedContact = false;
        contacts.forEach(c => { if ((contactMap.get(c)||new Set()).size > 1) reusedContact = true; });
        if (reusedContact) reasons.push('Contact reused across accounts');
        // Address used in multiple cities
        const addr = norm(l.address || `${l.propertyNumber||''} ${l.landmark||''}`);
        if (addr && (addressToCities.get(addr)||new Set()).size > 1) reasons.push('Same address in different cities');
        // Owner risk: many listings in short time
        if ((ownerRecentCounts.get(owner)||0) >= 5) reasons.push('High posting velocity');
        
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
        const t = (r.comment||'').trim().toLowerCase();
        if (!t) return; reviewMap.set(t, (reviewMap.get(t)||0)+1);
      });
      const repetitiveTexts = new Set(Array.from(reviewMap.entries()).filter(([,c])=>c>=3).map(([t])=>t));
      const suspiciousReviewPhrases = [
        'scam','fraud','don\'t book','best deal','don\'t miss','very cheap','cheat','fake','beware',
        'don\'t trust','spam','promotion','too good to be true','advance payment','deposit first','pay first',
        'upi','gpay','paytm','whatsapp only','no visit','online only','deal outside platform','refund for review',
        'cashback for review','5 star for discount','paid review','incentivized review','excellent service',
        'highly recommended','must try','amazing experience','perfect','outstanding','brilliant','fantastic',
        'wonderful','incredible','superb','exceptional','marvelous','phenomenal','extraordinary','remarkable'
      ];
      const reviewsArr = (allReviews.reviews || allReviews || []);
      // Build maps for burst/time/city behaviors
      const byListing = new Map();
      const byUser = new Map();
      reviewsArr.forEach(r => {
        const lid = (r.listingId && (r.listingId._id||r.listingId)) || r.listingId;
        const uid = (r.userId && (r.userId._id||r.userId)) || r.userId;
        const created = new Date(r.createdAt||0).getTime();
        if (!byListing.has(lid)) byListing.set(lid, []);
        byListing.get(lid).push(r);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push(r);
        r._created = created;
      });
      // Rating flood detection per listing (last 3 days)
      const threeDaysAgo = Date.now() - 3*24*60*60*1000;
      const listingFlood = new Map();
      byListing.forEach((arr, lid) => {
        const recent = arr.filter(r => r._created >= threeDaysAgo);
        const fiveStar = recent.filter(r => (r.rating||0) >= 5).length;
        const oneStar = recent.filter(r => (r.rating||0) <= 1).length;
        listingFlood.set(lid, { fiveStar, oneStar });
      });
      // Burst activity: >5 reviews within 30 minutes per listing
      const burstByListing = new Map();
      byListing.forEach((arr, lid) => {
        const sorted = [...arr].sort((a,b)=>a._created-b._created);
        let burst = false;
        for (let i=0;i<sorted.length;i++){
          const start = sorted[i]._created;
          let count = 1;
          for (let j=i+1;j<sorted.length;j++){
            if (sorted[j]._created - start <= 30*60*1000) count++; else break;
          }
          if (count >= 5) { burst = true; break; }
        }
        burstByListing.set(lid, burst);
      });
      // Reviewer behavior: multi-city within 60 minutes
      const userCityTimeFlag = new Map();
      byUser.forEach((arr, uid) => {
        const sorted = [...arr].sort((a,b)=>a._created-b._created);
        let flag = false;
        for (let i=0;i<sorted.length;i++){
          const cityA = (sorted[i].listingId && sorted[i].listingId.city) || '';
          for (let j=i+1;j<sorted.length;j++){
            const cityB = (sorted[j].listingId && sorted[j].listingId.city) || '';
            if (cityA && cityB && cityA !== cityB && (sorted[j]._created - sorted[i]._created) <= 60*60*1000) { flag = true; break; }
          }
          if (flag) break;
        }
        userCityTimeFlag.set(uid, flag);
      });

      const flaggedReviews = reviewsArr.map(r => {
        const reasons = [];
        const text = (r.comment||'').trim().toLowerCase();
        if (repetitiveTexts.has(text)) reasons.push('Identical text across accounts');
        if (suspiciousReviewPhrases.some(p => text.includes(p))) reasons.push('Suspicious language');
        const lid = (r.listingId && (r.listingId._id||r.listingId)) || r.listingId;
        const flood = listingFlood.get(lid) || { fiveStar:0, oneStar:0 };
        if (flood.fiveStar >= 10) reasons.push('5-star flood');
        if (flood.oneStar >= 10) reasons.push('1-star flood');
        const uid = (r.userId && (r.userId._id||r.userId)) || r.userId;
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
        const positiveWords = ['good','great','excellent','amazing','love','nice','helpful','fast','clean','spacious','recommended'];
        const negativeWords = ['bad','poor','terrible','awful','hate','dirty','small','slow','rude','noisy','not recommended','worst'];
        
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
        for (const h of hashes){
          const arr = imageHashMap.get(h) || [];
          const others = arr.filter(id => String(id) !== String(lst._id));
          if (others.length >= 1){ duplicateFound = true; break; }
        }
        if (duplicateFound) reasons.add('Stolen images suspected');
        // Watermark/logo heuristic on first image only to keep it cheap
        const firstImage = (lst.imageUrls || [])[0];
        if (firstImage){
          const wm = await simpleWatermarkDetected(firstImage);
          if (wm) reasons.add('Watermark/logo detected');
        }
        // Fake phone heuristic in description
        const text = (lst.description || '').toLowerCase();
        const digits = (text.match(/\d/g) || []).length;
        if (digits >= 10){
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

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 min-h-screen py-6 sm:py-10 px-2 md:px-8">
      <div className="w-full mx-auto bg-white rounded-xl shadow-2xl p-4 sm:p-6 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-20 h-20 bg-red-200 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute top-32 right-20 w-16 h-16 bg-orange-200 rounded-full opacity-20 animate-bounce"></div>
          <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-yellow-200 rounded-full opacity-20 animate-ping"></div>
          <div className="absolute bottom-32 right-1/3 w-24 h-24 bg-pink-200 rounded-full opacity-20 animate-pulse"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h3 className="text-4xl font-extrabold bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
                🛡️ Fraud Management
              </h3>
              <p className="text-gray-600">Monitor and manage suspicious activities across the platform</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl disabled:opacity-60 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" disabled={loading} onClick={fetchData}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Scanning…
                  </div>
                ) : (
                  '🔍 Scan Now'
                )}
              </button>
              <button className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" onClick={() => navigate('/admin')}>
                ← Back
              </button>
              <label className="flex items-center gap-2 text-sm bg-gray-50 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
                <input type="checkbox" checked={includeLowSeverity} onChange={(e)=>{ setIncludeLowSeverity(e.target.checked); setPageL(1); setPageR(1); }} className="w-4 h-4 text-blue-600" />
                Include low severity
              </label>
            </div>
          </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-lg font-semibold text-blue-600">Analyzing platform for fraud patterns...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 max-w-md mx-auto">
              <div className="text-red-500 text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-red-700 mb-2">Analysis Error</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-500 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-600">Suspicious Listings</div>
                    <div className="text-3xl font-bold text-blue-700">{stats.suspiciousListings}</div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border-2 border-red-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-red-500 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-red-600">Suspected Fake Reviews</div>
                    <div className="text-3xl font-bold text-red-700">{stats.suspectedFakeReviews}</div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gray-500 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-600">Last Scan</div>
                    <div className="text-sm font-bold text-gray-800">{stats.lastScan ? new Date(stats.lastScan).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Filters and Controls */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-2xl mb-8 border-2 border-gray-200 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-800">🔍 Filters & Controls</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">📊 View Type</label>
                  <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                    <option value="all">All Items</option>
                    <option value="listings">Suspicious Listings</option>
                    <option value="reviews">Suspected Fake Reviews</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">⚠️ Fraud Reason</label>
                  <select value={reasonFilter} onChange={(e)=>{setReasonFilter(e.target.value); setPageL(1); setPageR(1);}} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                    <option value="all">All reasons</option>
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
                    <option value="Incentivized review">Incentivized review</option>
                    <option value="Paid promotion">Paid promotion</option>
                    <option value="External contact promotion">External contact promotion</option>
                    <option value="Coordinated review activity">Coordinated review activity</option>
                    <option value="Unverified owner claim">Unverified owner claim</option>
                    <option value="Stolen images suspected">Stolen images suspected</option>
                    <option value="Image-text mismatch">Image-text mismatch</option>
                    <option value="Contact off-platform">Contact off-platform</option>
                    <option value="Advance payment solicitation">Advance payment solicitation</option>
                    <option value="Third-party payment request">Third-party payment request</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">📈 Sort By</label>
                  <select value={sortBy} onChange={(e)=>{setSortBy(e.target.value);}} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                    <option value="severity">Sort: Severity</option>
                    <option value="recent">Sort: Most Recent</option>
                    <option value="alpha">Sort: Alphabetical</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">🔍 Search</label>
                  <input
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    placeholder="Search text, reasons, city, user, listing…"
                    value={searchQuery}
                    onChange={(e)=>setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2" onClick={() => {
                  // CSV export minimal
                  const rows = [
                    ['Type','Listing','User','Reasons','Comment'],
                    ...listings.map(l=>['listing', l.name, '', (l._fraudReasons||[]).join('|'), (l.description||'').replace(/\n/g,' ')]),
                    ...reviews.map(r=>['review', (r.listingId?.name)||String(r.listingId), (r.userId?.email)||String(r.userId), (r._fraudReasons||[]).join('|'), (r.comment||'').replace(/\n/g,' ')])
                  ];
                  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'fraud-report.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                
                {showSelectMode ? (
                  <div className="flex gap-3">
                    <button className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" onClick={()=>{
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
                    }}>✅ Resolve Selected</button>
                    <button className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" onClick={()=>{
                      setShowSelectMode(false);
                      setSelectedRows({ listings: new Set(), reviews: new Set() });
                    }}>❌ Cancel</button>
                  </div>
                ) : (
                  <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" onClick={()=>{
                    setShowSelectMode(true);
                  }}>☑️ Select Items</button>
                )}
              </div>
            </div>

            {(filter==='all' || filter==='listings') && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h4 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">🏠 Suspicious Listings</h4>
                </div>
                <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border-2 border-gray-200">
                  <table className="min-w-full w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <tr>
                        {showSelectMode && <th className="p-4 text-left w-12 font-semibold text-gray-700">☑️</th>}
                        <th className="p-4 text-left font-semibold text-gray-700">Property Name</th>
                        <th className="p-4 text-left font-semibold text-gray-700">📍 Location</th>
                        <th className="p-4 text-left font-semibold text-gray-700">⚠️ Fraud Reasons</th>
                        <th className="p-4 text-left font-semibold text-gray-700">🔧 Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings
                        .filter(l => {
                        const q = searchQuery.trim().toLowerCase();
                        if (!q) return true;
                        const fields = [
                          l.name,
                          l.city,
                          l.state,
                          (l.description||''),
                          (l._fraudReasons||[]).join(' ')
                        ].join(' ').toLowerCase();
                        return fields.includes(q);
                      })
                        .filter(l => includeLowSeverity ? true : (l._fraudReasons||[]).length >= 2)
                        .filter(l => reasonFilter==='all' ? true : (l._fraudReasons||[]).includes(reasonFilter))
                        .sort((a,b)=>{
                          if (sortBy==='alpha') return String(a.name||'').localeCompare(String(b.name||''));
                          if (sortBy==='recent') return new Date(b.createdAt||0) - new Date(a.createdAt||0);
                          const sa=(a._fraudReasons||[]).length, sb=(b._fraudReasons||[]).length; return sb-sa;
                        })
                        .slice((pageL-1)*pageSize, pageL*pageSize)
                        .map(l => (
                        <tr key={l._id} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                          {showSelectMode && <td className="p-4"><input type="checkbox" checked={selectedRows.listings.has(l._id)} onChange={(e)=>{
                            const ns = new Set(selectedRows.listings); if (e.target.checked) ns.add(l._id); else ns.delete(l._id);
                            setSelectedRows(s => ({ ...s, listings: ns }));
                          }} className="w-4 h-4 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500" /></td>}
                          <td className="p-4 font-medium text-gray-900">{l.name}</td>
                          <td className="p-4 text-gray-600">{l.city}, {l.state}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {(l._fraudReasons||[]).map((reason, idx) => (
                                <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <Link to={`/admin/listing/${l._id}`} className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-xs font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 shadow-md">
                                🔍 Open
                              </Link>
                              <button className="px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg text-xs font-semibold hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-105 shadow-md" onClick={() => window.open(`/admin/listing/${l._id}`, '_blank')}>
                                🆕 New Tab
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {listings
                        .filter(l => {
                        const q = searchQuery.trim().toLowerCase();
                        if (!q) return true;
                        const fields = [l.name,l.city,l.state,(l.description||''),(l._fraudReasons||[]).join(' ')].join(' ').toLowerCase();
                        return fields.includes(q);
                      })
                        .filter(l => reasonFilter==='all' ? true : (l._fraudReasons||[]).includes(reasonFilter))
                        .length === 0 && (
                        <tr><td className="p-3 text-sm text-gray-500" colSpan={showSelectMode ? 5 : 4}>No suspicious listings</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Enhanced Pagination for listings */}
                <div className="flex items-center justify-between mt-6 px-4">
                  <div className="text-sm text-gray-600">
                    Showing {((pageL-1)*pageSize)+1} to {Math.min(pageL*pageSize, listings.filter(l => {
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return true;
                      const fields = [l.name,l.city,l.state,(l.description||''),(l._fraudReasons||[]).join(' ')].join(' ').toLowerCase();
                      return fields.includes(q);
                    }).filter(l => includeLowSeverity ? true : (l._fraudReasons||[]).length >= 2).filter(l => reasonFilter==='all' ? true : (l._fraudReasons||[]).includes(reasonFilter)).length)} of {listings.filter(l => {
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return true;
                      const fields = [l.name,l.city,l.state,(l.description||''),(l._fraudReasons||[]).join(' ')].join(' ').toLowerCase();
                      return fields.includes(q);
                    }).filter(l => includeLowSeverity ? true : (l._fraudReasons||[]).length >= 2).filter(l => reasonFilter==='all' ? true : (l._fraudReasons||[]).includes(reasonFilter)).length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg text-sm font-semibold hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-105 shadow-md disabled:opacity-50" onClick={()=>setPageL(p=>Math.max(1,p-1))} disabled={pageL === 1}>
                      ← Prev
                    </button>
                    <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">Page {pageL}</span>
                    <button className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg text-sm font-semibold hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-105 shadow-md" onClick={()=>setPageL(p=>p+1)}>
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(filter==='all' || filter==='reviews') && (
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-3">Suspected Fake Reviews</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full w-full border text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        {showSelectMode && <th className="p-2 text-left w-8">Select</th>}
                        <th className="p-2 text-left">Listing</th>
                        <th className="p-2 text-left">User</th>
                        <th className="p-2 text-left">Comment</th>
                        <th className="p-2 text-left">Reasons</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews
                        .filter(r => {
                        const q = searchQuery.trim().toLowerCase();
                        if (!q) return true;
                        const fields = [
                          (r.listingId?.name)||String(r.listingId||''),
                          (r.userId?.email)||String(r.userId||''),
                          (r.comment||''),
                          (r._fraudReasons||[]).join(' ')
                        ].join(' ').toLowerCase();
                        return fields.includes(q);
                      })
                        .filter(r => includeLowSeverity ? true : (r._fraudReasons||[]).length >= 2)
                        .filter(r => reasonFilter==='all' ? true : (r._fraudReasons||[]).includes(reasonFilter))
                        .sort((a,b)=>{
                          if (sortBy==='alpha') return String(a.listingId?.name||'').localeCompare(String(b.listingId?.name||''));
                          if (sortBy==='recent') return new Date(b.createdAt||0) - new Date(a.createdAt||0);
                          const sa=(a._fraudReasons||[]).length, sb=(b._fraudReasons||[]).length; return sb-sa;
                        })
                        .slice((pageR-1)*pageSize, pageR*pageSize)
                        .map(r => (
                        <tr key={r._id} className="border-t">
                          {showSelectMode && <td className="p-2 text-sm"><input type="checkbox" checked={selectedRows.reviews.has(r._id)} onChange={(e)=>{
                            const ns = new Set(selectedRows.reviews); if (e.target.checked) ns.add(r._id); else ns.delete(r._id);
                            setSelectedRows(s => ({ ...s, reviews: ns }));
                          }} /></td>}
                          <td className="p-2">{r.listingId?.name || r.listingId}</td>
                          <td className="p-2">{r.userId?.email || r.userId}</td>
                          <td className="p-2 max-w-[10rem] sm:max-w-md truncate" title={r.comment}>{r.comment}</td>
                          <td className="p-2">{(r._fraudReasons||[]).join(', ')}</td>
                          <td className="p-2"><div className="flex flex-wrap gap-2">
                            <a href={`/admin/listing/${r.listingId?._id || r.listingId}`} className="px-2 py-1 bg-blue-600 text-white rounded text-xs sm:text-sm">Open</a>
                            <button className="px-2 py-1 bg-gray-200 rounded text-xs sm:text-sm" onClick={() => window.open(`/admin/listing/${r.listingId?._id || r.listingId}`, '_blank')}>New Tab</button>
                          </div></td>
                        </tr>
                      ))}
                      {reviews
                        .filter(r => {
                        const q = searchQuery.trim().toLowerCase();
                        if (!q) return true;
                        const fields = [
                          (r.listingId?.name)||String(r.listingId||''),
                          (r.userId?.email)||String(r.userId||''),
                          (r.comment||''),
                          (r._fraudReasons||[]).join(' ')
                        ].join(' ').toLowerCase();
                        return fields.includes(q);
                      })
                        .filter(r => reasonFilter==='all' ? true : (r._fraudReasons||[]).includes(reasonFilter))
                        .length === 0 && (
                        <tr><td className="p-3 text-sm text-gray-500" colSpan={showSelectMode ? 6 : 5}>No suspected fake reviews</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination for reviews */}
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button className="px-2 py-1 bg-gray-200 rounded text-xs" onClick={()=>setPageR(p=>Math.max(1,p-1))}>Prev</button>
                  <span className="text-xs">Page {pageR}</span>
                  <button className="px-2 py-1 bg-gray-200 rounded text-xs" onClick={()=>setPageR(p=>p+1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
