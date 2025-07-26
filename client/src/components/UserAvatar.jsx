import React from 'react';

const UserAvatar = ({ 
  user, 
  size = 'w-24 h-24', 
  textSize = 'text-2xl', 
  className = '',
  showBorder = true 
}) => {
  // Function to get initials from username
  const getInitials = (name) => {
    if (!name) return 'U'; // Default fallback
    
    const words = name.trim().split(' ');
    if (words.length === 1) {
      // Single word - take first character
      return words[0].charAt(0).toUpperCase();
    } else if (words.length >= 2) {
      // Multiple words - take first character of first two words
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    
    return name.charAt(0).toUpperCase();
  };

  // Generate a consistent vibrant gradient background based on the user's name
  const getBackgroundColor = (name) => {
    if (!name) return 'bg-gradient-to-br from-gray-500 to-gray-600';
    
    const gradients = [
      'bg-gradient-to-br from-red-500 to-pink-600',
      'bg-gradient-to-br from-blue-500 to-purple-600', 
      'bg-gradient-to-br from-green-500 to-teal-600',
      'bg-gradient-to-br from-yellow-500 to-orange-600',
      'bg-gradient-to-br from-purple-500 to-indigo-600',
      'bg-gradient-to-br from-pink-500 to-rose-600',
      'bg-gradient-to-br from-indigo-500 to-blue-600',
      'bg-gradient-to-br from-teal-500 to-green-600',
      'bg-gradient-to-br from-orange-500 to-red-600',
      'bg-gradient-to-br from-cyan-500 to-blue-600',
      'bg-gradient-to-br from-emerald-500 to-teal-600',
      'bg-gradient-to-br from-violet-500 to-purple-600',
      'bg-gradient-to-br from-fuchsia-500 to-pink-600',
      'bg-gradient-to-br from-sky-500 to-blue-600',
      'bg-gradient-to-br from-lime-500 to-green-600'
    ];
    
    // Use name to generate consistent gradient
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return gradients[Math.abs(hash) % gradients.length];
  };

  const borderClass = showBorder && !className.includes('border-') ? 'border-4 border-blue-200' : '';
  const baseClasses = `${size} rounded-full ${borderClass} flex items-center justify-center text-white font-bold ${className}`;

  if (user?.avatar) {
    return (
      <img
        alt="avatar"
        src={user.avatar}
        className={`${baseClasses} object-cover shadow-lg aspect-square`}
        style={{ aspectRatio: '1/1' }}
        onError={e => { e.target.onerror = null; e.target.src = ''; }}
      />
    );
  }

  // Show initials with colored background
  const initials = getInitials(user?.username);
  const bgColor = getBackgroundColor(user?.username);

  return (
    <div className={`${baseClasses} ${bgColor} shadow-lg aspect-square`}>
      <span className={`${textSize} font-semibold`}>
        {initials}
      </span>
    </div>
  );
};

export default UserAvatar;