import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaMapMarkerAlt, FaHome, FaRupeeSign } from 'react-icons/fa';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const SearchSuggestions = ({
  searchTerm,
  onSuggestionClick,
  onClose,
  isVisible,
  className = "",
  placeholder = "Search properties..."
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // Fetch suggestions from API
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/api/search/suggestions?q=${encodeURIComponent(searchTerm)}&limit=8`
        );
        const data = await response.json();

        if (data.success) {
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isVisible || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSuggestionClick(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, suggestions, selectedIndex, onClose]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSuggestionClick = (suggestion, event) => {
    // Prevent the blur event from hiding suggestions
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onSuggestionClick(suggestion);
    setSuggestions([]);
  };

  const formatPrice = (price) => {
    if (!price) return '';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (!isVisible || (!loading && suggestions.length === 0 && searchTerm.trim().length < 2)) {
    return null;
  }

  return (
    <div
      ref={suggestionsRef}
      className={`absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto ${className}`}
    >
      {loading ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-center">
            <UrbanSetuSpinner size="sm" className="mr-2" />
            Searching...
          </div>
        </div>
      ) : suggestions.length > 0 ? (
        <div className="py-2">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              onClick={(event) => handleSuggestionClick(suggestion, event)}
              onMouseDown={(event) => event.preventDefault()}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${index === selectedIndex ? 'bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-blue-900' : ''
                }`}
            >
              <div className="flex items-start space-x-3">
                {suggestion.image ? (
                  <img
                    src={suggestion.image}
                    alt={suggestion.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <FaHome className="text-gray-400 dark:text-gray-500" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {suggestion.name}
                    </h4>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                      {suggestion.type}
                    </span>
                  </div>

                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <FaMapMarkerAlt className="mr-1" />
                    <span className="truncate">
                      {suggestion.address && `${suggestion.address}, `}
                      {suggestion.city}
                      {suggestion.state && `, ${suggestion.state}`}
                    </span>
                  </div>

                  <div className="flex items-center text-sm font-semibold text-green-600 dark:text-green-400">
                    <FaRupeeSign className="mr-1" />
                    {formatPrice(suggestion.price)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            Press Enter to select, ↑↓ to navigate, Esc to close
          </div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <FaSearch className="mx-auto w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No properties found</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Try adjusting your search or area</p>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;
