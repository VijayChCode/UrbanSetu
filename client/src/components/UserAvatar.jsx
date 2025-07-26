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

  // Generate a consistent background color based on the user's name
  const getBackgroundColor = (name) => {
    if (!name) return 'bg-gray-500';
    
    const colors = [
      'bg-red-500',
      'bg-blue-500', 
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500'
    ];
    
    // Use name to generate consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const borderClass = showBorder ? 'border-4 border-blue-200' : '';
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