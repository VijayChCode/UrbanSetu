// Utility function to mask property addresses for unauthenticated users
export const maskAddress = (addressData, isLoggedIn) => {
  if (!addressData) return '';
  
  if (isLoggedIn) {
    return formatFullAddress(addressData);
  }
  
  // For unauthenticated users, show only city/area information
  if (typeof addressData === 'string') {
    // Handle legacy single address field
    return maskLegacyAddress(addressData);
  } else if (typeof addressData === 'object') {
    // Handle new structured address fields
    return maskStructuredAddress(addressData);
  }
  
  return 'Location available after sign in';
};

// Format full address for authenticated users
export const formatFullAddress = (addressData) => {
  if (typeof addressData === 'string') {
    return addressData;
  } else if (typeof addressData === 'object') {
    const parts = [];
    
    if (addressData.propertyNumber) {
      parts.push(addressData.propertyNumber);
    }
    
    if (addressData.landmark) {
      parts.push(addressData.landmark);
    }
    
    if (addressData.city) {
      parts.push(addressData.city);
    }
    
    if (addressData.district) {
      parts.push(addressData.district);
    }
    
    if (addressData.state) {
      parts.push(addressData.state);
    }
    
    if (addressData.pincode) {
      parts.push(addressData.pincode);
    }
    
    return parts.join(', ');
  }
  
  return '';
};

// Mask legacy single address field
const maskLegacyAddress = (fullAddress) => {
  if (!fullAddress) return '';
  
  // Split the address by common delimiters
  const addressParts = fullAddress.split(/[,\-]/).map(part => part.trim());
  
  // Try to extract city/area information
  let maskedAddress = '';
  
  // If address has multiple parts, show the last meaningful part (usually city/area)
  if (addressParts.length > 1) {
    // Remove common building/floor indicators and take the last meaningful part
    const meaningfulParts = addressParts.filter(part => 
      !part.match(/^\d+/) && // Remove parts starting with numbers (building numbers)
      !part.match(/floor|st|nd|rd|th/i) && // Remove floor indicators
      !part.match(/flat|apartment|apt|room/i) && // Remove apartment indicators
      part.length > 2 // Remove very short parts
    );
    
    if (meaningfulParts.length > 0) {
      maskedAddress = meaningfulParts[meaningfulParts.length - 1];
    } else {
      // Fallback: take the last part that's not a number
      const lastPart = addressParts[addressParts.length - 1];
      if (lastPart && !lastPart.match(/^\d+$/)) {
        maskedAddress = lastPart;
      }
    }
  } else {
    // Single part address - show it but truncate if too long
    maskedAddress = fullAddress.length > 20 ? fullAddress.substring(0, 20) + '...' : fullAddress;
  }
  
  // If we couldn't extract meaningful location info, show a generic message
  if (!maskedAddress || maskedAddress.length < 3) {
    maskedAddress = 'Location available after sign in';
  }
  
  return `${maskedAddress} (Sign in to view full address)`;
};

// Mask structured address fields
const maskStructuredAddress = (addressData) => {
  const parts = [];
  
  // Show district and state for unauthenticated users
  if (addressData.district) {
    parts.push(addressData.district);
  }
  
  if (addressData.state) {
    parts.push(addressData.state);
  }
  
  // If no district/state, try city
  if (parts.length === 0 && addressData.city) {
    parts.push(addressData.city);
  }
  
  // If still no meaningful location, show generic message
  if (parts.length === 0) {
    return 'Location available after sign in (Sign in to view full address)';
  }
  
  return `${parts.join(', ')} (Sign in to view full address)`;
};

// Function to check if location link should be shown
export const shouldShowLocationLink = (isLoggedIn) => {
  return isLoggedIn;
};

// Function to get location link display text
export const getLocationLinkText = (isLoggedIn) => {
  return isLoggedIn ? 'Locate on Map' : 'Sign in to view location';
}; 