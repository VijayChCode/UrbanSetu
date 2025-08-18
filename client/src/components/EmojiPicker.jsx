import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { BsEmojiSmile } from 'react-icons/bs';

const CustomEmojiPicker = ({ onEmojiClick, isOpen, setIsOpen, buttonRef }) => {
  const pickerRef = useRef(null);
  const [position, setPosition] = useState({ bottom: true, right: true });

  // Calculate optimal position based on viewport
  useEffect(() => {
    if (isOpen && buttonRef.current && pickerRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const pickerWidth = 350;
      const pickerHeight = 400;
      
      // Check if there's space above (preferred position)
      const spaceAbove = buttonRect.top;
      const showAbove = spaceAbove >= pickerHeight + 16; // 16px margin
      
      // Check if there's space on the right
      const spaceRight = viewportWidth - buttonRect.left;
      const showRight = spaceRight >= pickerWidth + 16; // 16px margin
      
      setPosition({
        bottom: showAbove,
        right: showRight
      });
    }
  }, [isOpen, buttonRef]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen, buttonRef]);

  // Handle emoji selection
  const handleEmojiSelect = (emojiObject) => {
    onEmojiClick(emojiObject.emoji);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  // Dynamic positioning classes and styles
  const positionClasses = `absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 ${
    position.bottom ? 'bottom-full mb-2' : 'top-full mt-2'
  } ${
    position.right ? 'right-0' : 'left-0'
  }`;

  const dynamicStyles = {
    transform: position.bottom ? 'translateY(-8px)' : 'translateY(8px)',
    width: window.innerWidth < 400 ? `${window.innerWidth - 32}px` : '350px',
    maxWidth: '350px'
  };

  return (
    <div 
      ref={pickerRef}
      className={positionClasses}
      style={dynamicStyles}
    >
      {/* Emoji Picker - uses built-in search functionality */}
      <div className="emoji-picker-container">
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          searchDisabled={false}
          searchPlaceholder="Search emojis..."
          autoFocusSearch={false}
          previewConfig={{
            showPreview: true,
            defaultCaption: "Pick an emoji!",
            defaultEmoji: "1f60a"
          }}
          skinTonesDisabled={false}
          width={window.innerWidth < 400 ? window.innerWidth - 32 : 350}
          height={window.innerWidth < 400 ? 350 : 400}
          lazyLoadEmojis={true}
          theme="light"
          emojiStyle="native"
          categories={[
            'suggested',
            'smileys_people', 
            'animals_nature',
            'food_drink',
            'travel_places',
            'activities',
            'objects',
            'symbols',
            'flags'
          ]}
        />
      </div>
    </div>
  );
};

// Emoji Button Component
export const EmojiButton = ({ onEmojiClick, className = "" }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const buttonRef = useRef(null);

  const handleButtonClick = () => {
    setIsPickerOpen(!isPickerOpen);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        className={`flex items-center justify-center p-2 text-gray-500 hover:text-yellow-500 hover:bg-gray-100 rounded-full transition-colors duration-200 ${className}`}
        title="Add emoji"
      >
        <BsEmojiSmile className="text-lg" />
      </button>
      
      <CustomEmojiPicker
        onEmojiClick={onEmojiClick}
        isOpen={isPickerOpen}
        setIsOpen={setIsPickerOpen}
        buttonRef={buttonRef}
      />
    </div>
  );
};

export default CustomEmojiPicker;