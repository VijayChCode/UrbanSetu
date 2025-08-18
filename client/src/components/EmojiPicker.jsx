import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { BsEmojiSmile } from 'react-icons/bs';

const CustomEmojiPicker = ({ onEmojiClick, isOpen, setIsOpen, buttonRef }) => {
  const pickerRef = useRef(null);

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

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full mb-2 right-0 z-50 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{ 
        transform: 'translateY(-8px)',
        minWidth: '350px'
      }}
    >
      {/* Emoji Picker - uses built-in search functionality */}
      <div className="emoji-picker-container">
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          searchDisabled={false}
          searchPlaceholder="Search emojis..."
          previewConfig={{
            showPreview: true,
            defaultCaption: "Pick an emoji!",
            defaultEmoji: "1f60a"
          }}
          skinTonesDisabled={false}
          width={350}
          height={400}
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