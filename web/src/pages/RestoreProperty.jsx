import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/auth';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Home,
  MapPin,
  DollarSign,
  HelpCircle,
  Building,
  Image as ImageIcon
} from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import ContactSupportWrapper from '../components/ContactSupportWrapper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const RestoreProperty = () => {
  // Set page title
  usePageTitle("Restore Property - Property Restoration");

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState(searchParams.get('token') || '');
  const [inputToken, setInputToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [propertyData, setPropertyData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      verifyToken(urlToken);
    }
  }, [searchParams]);

  const verifyToken = async (tokenToVerify) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/property-restoration/verify/${tokenToVerify}`);
      const data = await response.json();

      if (data.success) {
        setPropertyData(data.deletedListing);
      } else {
        setError(data.message || 'Invalid or expired restoration token');
      }
    } catch (err) {
      console.error('Error verifying token:', err);
      setError('Failed to verify restoration token. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualTokenSubmit = (e) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    setSearchParams({ token: inputToken.trim() });
  };

  const handleRestore = async () => {
    if (!confirmRestore) {
      setError('Please check the confirmation box to proceed.');
      return;
    }

    setRestoring(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/property-restoration/restore/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmRestore: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/user/my-listings');
        }, 3000);
      } else {
        setError(data.message || 'Failed to restore property');
      }
    } catch (err) {
      console.error('Error restoring property:', err);
      setError('Failed to restore property. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return 0;
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getProgressPercentage = (expiryDate) => {
    // Assuming 30 days is the standard window
    const days = getDaysRemaining(expiryDate);
    return Math.min(100, Math.max(0, (days / 30) * 100));
  };

  return (
    <div className="min-h-screen bg-transparent dark:bg-gray-950 flex flex-col justify-center relative overflow-hidden py-6 sm:py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-red-100/40 to-orange-100/40 dark:from-red-900/20 dark:to-orange-900/20 blur-3xl animate-blob" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-pink-100/40 to-red-100/40 dark:from-pink-900/20 dark:to-red-900/20 blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        {/* Brand Area */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-4 ring-1 ring-gray-100 dark:ring-gray-700">
            <Building className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Property Restoration
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto">
            Restore your accidentally deleted property listings
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl py-6 sm:py-8 px-4 shadow-2xl rounded-2xl sm:rounded-3xl sm:px-10 border border-white/50 dark:border-gray-700/50 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8 sm:py-12">
              <UrbanSetuSpinner size="lg" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2">Verifying Token</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Validating revocation details...</p>
            </div>
          )}

          {/* Success State */}
          {!loading && success && (
            <div className="text-center py-6 sm:py-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Restoration Complete!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                Your property <span className="font-semibold dark:text-white">"{propertyData?.propertyName}"</span> is now active and visible to buyers.
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="bg-green-500 h-1.5 rounded-full animate-progress-loading w-full origin-left duration-[3000ms]"></div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Redirecting to your listings...</p>
            </div>
          )}

          {/* Input/Error State */}
          {!loading && !success && (!token || error) && (
            <div className="text-center py-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-short">
                {error ? <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 dark:text-red-400" /> : <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-gray-500" />}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
                {error ? 'Restoration Failed' : 'Enter Restoration Token'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm leading-relaxed max-w-sm mx-auto">
                {error || 'Please enter the restoration token sent to your email to recover your property listing.'}
              </p>

              <form onSubmit={handleManualTokenSubmit} className="mb-8">
                <div className="relative max-w-sm mx-auto">
                  <input
                    type="text"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="Paste token here..."
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-colors p-1.5"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Check your email inbox or spam folder</p>
              </form>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                <button
                  onClick={() => navigate('/user/my-listings')}
                  className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  My Listings
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </button>
              </div>
            </div>
          )}

          {/* Property Data State (Verify Success) */}
          {!loading && !success && !error && propertyData && (
            <div className="animate-fade-in-up">

              {/* Status Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Recovery Window</span>
                  <span className={`font-bold ${getDaysRemaining(propertyData.tokenExpiry) < 3 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                    {getDaysRemaining(propertyData.tokenExpiry)} Days Remaining
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${getDaysRemaining(propertyData.tokenExpiry) < 5 ? 'bg-red-500' : 'bg-blue-600 dark:bg-blue-500'}`}
                    style={{ width: `${getProgressPercentage(propertyData.tokenExpiry)}%` }}
                  ></div>
                </div>
              </div>

              {/* Property Details Card */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="flex gap-4">
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden relative">
                    {propertyData.propertyImages?.[0] ? (
                      <img
                        src={propertyData.propertyImages[0]}
                        alt="Property"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate mb-1">{propertyData.propertyName}</h3>
                    <div className="space-y-1.5">
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{propertyData.propertyAddress || 'No address'}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <DollarSign className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        <span className="font-semibold text-gray-900 dark:text-white">₹{propertyData.propertyPrice?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center text-xs text-red-500 dark:text-red-400">
                        <Clock className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        <span>Deleted on {new Date(propertyData.deletedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Restoration Information */}
              <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-200/60 dark:border-green-800/40 rounded-xl p-4 mb-4 text-sm transition-colors">
                <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Restoration Information
                </h4>
                <div className="space-y-1 text-green-800 dark:text-green-400">
                  <p><span className="font-medium dark:text-green-300">Expiry Date:</span> {new Date(propertyData.tokenExpiry).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p><span className="font-medium dark:text-green-300">Owner:</span> {propertyData.ownerUsername} ({propertyData.ownerEmail})</p>
                  <p className="mt-2 text-green-700/80 dark:text-green-400/80">
                    This property can be restored within 30 days of deletion. After restoration, it will appear in your property listings with all original data intact.
                  </p>
                </div>
              </div>

              {/* Important Notice */}
              <div className="bg-yellow-50/50 dark:bg-yellow-900/20 border border-yellow-200/60 dark:border-yellow-800/40 rounded-xl p-4 mb-6 text-sm transition-colors">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Important Notice
                </h4>
                <p className="mb-2 text-yellow-800 dark:text-yellow-400">Before restoring this property, please confirm:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 dark:text-yellow-400 ml-1">
                  <li>You want to restore this property to your listings</li>
                  <li>All original property data will be restored</li>
                  <li>The property will be visible to potential buyers again</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              {/* Confirmation Box - Simplified for user action */}
              <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-1">Confirm Restoration</h4>
                    <label className="flex items-start gap-2 cursor-pointer group">
                      <div className="relative flex items-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={confirmRestore}
                          onChange={(e) => setConfirmRestore(e.target.checked)}
                          className="peer h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 cursor-pointer bg-white dark:bg-gray-700"
                        />
                      </div>
                      <span className="text-xs text-yellow-800 dark:text-yellow-400 leading-snug group-hover:text-yellow-900 dark:group-hover:text-yellow-300 transition-colors">
                        I confirm specifically that I want to restore this listing and make it publicly visible again.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="space-y-3">
                <button
                  onClick={handleRestore}
                  disabled={restoring || !confirmRestore}
                  className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {restoring ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} className="mr-2" />
                      Restoring Property...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                      Restore Property
                    </>
                  )}
                </button>

                <button
                  onClick={() => navigate('/user/my-listings')}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white py-2 transition-colors"
                >
                  Cancel and return to listings
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer Help */}
        <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Need help? <a href="/contact" className="font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 hover:underline">Contact Support</a>
          </p>
        </div>

      </div>
      <ContactSupportWrapper />
    </div>
  );
};

export default RestoreProperty;
