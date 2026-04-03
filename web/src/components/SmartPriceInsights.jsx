import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { FaChartLine, FaArrowUp, FaCalculator, FaHome, FaBuilding, FaPercentage, FaClock, FaMapMarkerAlt, FaStar, FaInfoCircle } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const SmartPriceInsights = ({ listing, currentUser }) => {
  const [priceTrends, setPriceTrends] = useState([]);
  const [areaTrends, setAreaTrends] = useState([]);
  const [fairPriceScore, setFairPriceScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rentVsBuyData, setRentVsBuyData] = useState({
    monthlyRent: 0,
    propertyPrice: 0,
    downPayment: 0,
    loanAmount: 0,
    interestRate: 8.5,
    loanTenure: 20
  });

  // Generate mock price trend data (6 months)
  const generatePriceTrends = () => {
    const currentPrice = listing.offer ? listing.discountPrice : listing.regularPrice;
    const trends = [];
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 6; i++) {
      const basePrice = currentPrice * (0.85 + Math.random() * 0.3); // ±15% variation
      const areaPrice = basePrice * (0.9 + Math.random() * 0.2); // Area average
      
      trends.push({
        month: months[i],
        propertyPrice: Math.round(basePrice),
        areaAverage: Math.round(areaPrice),
        pricePerSqft: Math.round(basePrice / (listing.area || 1000))
      });
    }
    
    return trends;
  };

  // Calculate amenities count (same logic as main page)
  const getAmenitiesCount = () => {
    let count = 0;
    if (listing.parking) count++;
    if (listing.furnished) count++;
    if (listing.garden) count++;
    if (listing.swimmingPool) count++;
    if (listing.wifi) count++;
    if (listing.security) count++;
    if (listing.gym) count++;
    if (listing.lift) count++;
    return count;
  };

  // Get location string (same logic as main page)
  const getLocationString = () => {
    if (listing.city) {
      return `${listing.city}${listing.district ? `, ${listing.district}` : ''}${listing.state ? `, ${listing.state}` : ''}`;
    }
    return listing.location || 'N/A';
  };

  // Calculate demand score (same logic as Property Insights)
  const getDemandScore = () => {
    return listing.bedrooms >= 3 ? 'High' : listing.bedrooms === 2 ? 'Medium' : 'Standard';
  };

  // Calculate ROI Potential (consistent with Property Insights)
  const getROIPotential = () => {
    return listing.type === 'rent' ? '5-8%' : '8-12%';
  };

  // Calculate dynamic area growth based on property characteristics
  const getAreaGrowth = () => {
    if (!listing) return '+8.0%';
    
    // Use property ID hash for consistent but varied results
    const propertyId = listing._id;
    const hash = propertyId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Base growth rate
    let baseGrowth = 8.0;
    
    // Adjust based on property type
    if (listing.type === 'sale') baseGrowth += 2.0;
    
    // Adjust based on bedrooms (more bedrooms = higher growth potential)
    if (listing.bedrooms >= 3) baseGrowth += 3.0;
    else if (listing.bedrooms === 2) baseGrowth += 1.5;
    
    // Adjust based on city (major cities have higher growth)
    const majorCities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
    if (majorCities.includes(listing.city)) baseGrowth += 2.0;
    
    // Add some variation based on property ID hash
    const variation = (Math.abs(hash) % 50) / 10; // 0-5% variation
    baseGrowth += variation;
    
    return `+${baseGrowth.toFixed(1)}%`;
  };

  // Calculate dynamic ROI percentage (consistent with Property Insights range)
  const getROIPercentage = () => {
    if (!listing) return '8.2%';
    
    // Use property ID hash for consistent but varied results
    const propertyId = listing._id;
    const hash = propertyId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Base ROI based on property type
    let baseROI = listing.type === 'rent' ? 6.5 : 10.0;
    
    // Adjust based on bedrooms
    if (listing.bedrooms >= 3) baseROI += 1.0;
    else if (listing.bedrooms === 2) baseROI += 0.5;
    
    // Adjust based on city
    const majorCities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
    if (majorCities.includes(listing.city)) baseROI += 0.8;
    
    // Add some variation based on property ID hash
    const variation = (Math.abs(hash) % 30) / 10; // 0-3% variation
    baseROI += variation;
    
    return `${baseROI.toFixed(1)}%`;
  };

  // Calculate fair price score (0-100)
  const calculateFairPriceScore = () => {
    const currentPrice = listing.offer ? listing.discountPrice : listing.regularPrice;
    const pricePerSqft = currentPrice / (listing.area || 1000);
    
    // Base score
    let score = 50;
    
    // Adjust based on property type
    if (listing.type === 'sale') {
      if (pricePerSqft < 3000) score += 20; // Good value
      else if (pricePerSqft > 8000) score -= 20; // Overpriced
    } else {
      const rentPerSqft = currentPrice / (listing.area || 1000);
      if (rentPerSqft < 30) score += 20;
      else if (rentPerSqft > 80) score -= 20;
    }
    
    // Adjust based on amenities (use actual count)
    const amenityCount = getAmenitiesCount();
    score += Math.min(amenityCount * 2, 15);
    
    // Adjust based on location (mock data)
    const locationScore = Math.random() * 20 - 10; // -10 to +10
    score += locationScore;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  // Calculate rent vs buy analysis
  const calculateRentVsBuy = () => {
    const propertyPrice = listing.offer ? listing.discountPrice : listing.regularPrice;
    const monthlyRent = listing.type === 'rent' ? propertyPrice : propertyPrice * 0.004; // 0.4% of property value as monthly rent
    const downPayment = propertyPrice * 0.2; // 20% down payment
    const loanAmount = propertyPrice - downPayment;
    const monthlyEMI = calculateEMI(loanAmount, rentVsBuyData.interestRate, rentVsBuyData.loanTenure);
    
    const annualRent = monthlyRent * 12;
    const annualEMI = monthlyEMI * 12;
    const rentYield = (annualRent / propertyPrice) * 100;
    const priceToRentRatio = propertyPrice / annualRent;
    
    return {
      monthlyRent: Math.round(monthlyRent),
      propertyPrice: Math.round(propertyPrice),
      downPayment: Math.round(downPayment),
      loanAmount: Math.round(loanAmount),
      monthlyEMI: Math.round(monthlyEMI),
      annualRent: Math.round(annualRent),
      annualEMI: Math.round(annualEMI),
      rentYield: Math.round(rentYield * 100) / 100,
      priceToRentRatio: Math.round(priceToRentRatio * 100) / 100,
      recommendation: priceToRentRatio < 20 ? 'Buy' : priceToRentRatio > 25 ? 'Rent' : 'Consider both options'
    };
  };

  // EMI calculation
  const calculateEMI = (principal, rate, tenure) => {
    const monthlyRate = rate / 100 / 12;
    const months = tenure * 12;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  };

  // Get score color and label
  const getScoreInfo = (score) => {
    if (score >= 80) return { color: 'text-green-600', bg: 'bg-green-100', label: 'Excellent Value' };
    if (score >= 60) return { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Good Value' };
    if (score >= 40) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Fair Value' };
    return { color: 'text-red-600', bg: 'bg-red-100', label: 'Overpriced' };
  };

  useEffect(() => {
    const loadData = () => {
      setLoading(true);
      
      // Generate mock data
      const trends = generatePriceTrends();
      setPriceTrends(trends);
      setAreaTrends(trends);
      
      // Calculate fair price score
      const score = calculateFairPriceScore();
      setFairPriceScore(score);
      
      // Set rent vs buy data
      const rentVsBuy = calculateRentVsBuy();
      setRentVsBuyData(prev => ({ ...prev, ...rentVsBuy }));
      
      setLoading(false);
    };
    
    loadData();
  }, [listing]);

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 bg-white shadow-md rounded-lg mb-6">
        <div className="flex flex-col items-center justify-center py-8">
          <UrbanSetuSpinner size="lg" />
          <p className="mt-4 text-lg font-semibold text-purple-600 animate-pulse">Analyzing Market Insights...</p>
        </div>
      </div>
    );
  }

  const scoreInfo = getScoreInfo(fairPriceScore);
  const rentVsBuy = calculateRentVsBuy();

  return (
    <div className="p-6 bg-white shadow-md rounded-lg mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg">
          <FaChartLine className="text-white text-xl" />
        </div>
        <div>
          <h4 className="text-2xl font-bold text-gray-800">Smart Price Insights</h4>
          <p className="text-gray-600">Data-driven property analysis and market trends</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Trends Chart */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <FaArrowUp className="text-blue-600" />
            <h5 className="text-lg font-semibold text-blue-800">6-Month Price Trends</h5>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={(value) => `₹${(value/100000).toFixed(0)}L`} />
                <Tooltip 
                  formatter={(value, name) => [formatINR(value), name === 'propertyPrice' ? 'Property Price' : 'Area Average']}
                  labelStyle={{ color: '#374151' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="propertyPrice" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="areaAverage" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700">This Property</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-dashed"></div>
              <span className="text-gray-700">Area Average</span>
            </div>
          </div>
        </div>

        {/* Fair Price Score */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <FaStar className="text-green-600" />
            <h5 className="text-lg font-semibold text-green-800">Fair Price Score</h5>
          </div>
          <div className="text-center mb-4">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${scoreInfo.bg} mb-3`}>
              <span className={`text-3xl font-bold ${scoreInfo.color}`}>{fairPriceScore}</span>
            </div>
            <p className={`text-lg font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</p>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Price per sq ft</span>
              <span className="font-semibold text-gray-800">
                ₹{Math.round((listing.offer ? listing.discountPrice : listing.regularPrice) / (listing.area || 1000)).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Amenities</span>
              <span className="font-semibold text-gray-800">{getAmenitiesCount()} features</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Location</span>
              <span className="font-semibold text-gray-800">{getLocationString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rent vs Buy Calculator */}
      <div className="mt-6 bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <FaCalculator className="text-purple-600" />
          <h5 className="text-lg font-semibold text-purple-800">Rent vs Buy Analysis</h5>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h6 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FaBuilding className="text-blue-500" />
                Renting Analysis
              </h6>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Monthly Rent</span>
                  <span className="font-semibold text-blue-600">{formatINR(rentVsBuy.monthlyRent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Annual Rent</span>
                  <span className="font-semibold text-blue-600">{formatINR(rentVsBuy.annualRent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rent Yield</span>
                  <span className="font-semibold text-blue-600">{rentVsBuy.rentYield}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h6 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FaHome className="text-green-500" />
                Buying Analysis
              </h6>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Property Price</span>
                  <span className="font-semibold text-green-600">{formatINR(rentVsBuy.propertyPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Down Payment (20%)</span>
                  <span className="font-semibold text-green-600">{formatINR(rentVsBuy.downPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Monthly EMI</span>
                  <span className="font-semibold text-green-600">{formatINR(rentVsBuy.monthlyEMI)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Price-to-Rent Ratio</span>
                  <span className="font-semibold text-green-600">{rentVsBuy.priceToRentRatio}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FaInfoCircle className="text-purple-600" />
            <h6 className="font-semibold text-gray-800">Recommendation</h6>
          </div>
          <p className="text-gray-700">
            Based on current market conditions and price analysis, we recommend{' '}
            <span className={`font-semibold ${
              rentVsBuy.recommendation === 'Buy' ? 'text-green-600' : 
              rentVsBuy.recommendation === 'Rent' ? 'text-blue-600' : 'text-yellow-600'
            }`}>
              {rentVsBuy.recommendation.toLowerCase()}
            </span>
            {rentVsBuy.recommendation === 'Buy' && ' - The property offers good value for money and favorable price-to-rent ratio.'}
            {rentVsBuy.recommendation === 'Rent' && ' - Renting may be more cost-effective given current market conditions.'}
            {rentVsBuy.recommendation === 'Consider both options' && ' - Both options have merits; consider your long-term plans and financial situation.'}
          </p>
        </div>
      </div>

      {/* Market Insights */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FaMapMarkerAlt className="text-orange-600" />
            <h6 className="font-semibold text-orange-800">Area Growth</h6>
          </div>
          <p className="text-2xl font-bold text-orange-600">{getAreaGrowth()}</p>
          <p className="text-sm text-gray-600">YoY price growth</p>
        </div>
        
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FaClock className="text-indigo-600" />
            <h6 className="font-semibold text-indigo-800">Market Activity</h6>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{getDemandScore()}</p>
          <p className="text-sm text-gray-600">Property demand</p>
        </div>
        
        <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FaPercentage className="text-teal-600" />
            <h6 className="font-semibold text-teal-800">ROI Potential</h6>
          </div>
          <p className="text-2xl font-bold text-teal-600">{getROIPercentage()}</p>
          <p className="text-sm text-gray-600">Expected annual return</p>
        </div>
      </div>
    </div>
  );
};

export default SmartPriceInsights;
