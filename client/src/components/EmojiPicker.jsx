import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { BsEmojiSmile } from 'react-icons/bs';

const CustomEmojiPicker = ({ onEmojiClick, isOpen, setIsOpen, buttonRef, inputRef }) => {
  const pickerRef = useRef(null);
  const [position, setPosition] = useState({ bottom: true, right: true });

  // Calculate optimal position based on chatbox container bounds
  useEffect(() => {
    if (isOpen && buttonRef.current && pickerRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      
      // Find the chatbox container to constrain the picker within it
      const chatContainer = buttonRef.current.closest('[class*="chatContainer"], .flex-1.overflow-y-auto');
      const containerRect = chatContainer ? chatContainer.getBoundingClientRect() : {
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      const isMobile = window.innerWidth < 768; // Mobile breakpoint
      const pickerWidth = window.innerWidth < 400 ? window.innerWidth - 32 : 350;
      const pickerHeight = window.innerWidth < 400 ? 350 : 400;
      
      // Check if there's space above within the container (preferred position)
      const spaceAbove = buttonRect.top - containerRect.top;
      const showAbove = spaceAbove >= pickerHeight + 16; // 16px margin
      
      let finalPosition;
      
      if (isMobile) {
        // Mobile: Center the picker within the chatbox
        finalPosition = {
          bottom: showAbove,
          right: false, // Don't use right positioning
          center: true, // Custom flag for centering
          containerWidth: containerRect.width,
          containerLeft: containerRect.left,
          pickerWidth: pickerWidth
        };
      } else {
        // Desktop: Use existing logic
        const spaceRight = containerRect.right - buttonRect.left;
        const showRight = spaceRight >= pickerWidth + 16; // 16px margin
        
        finalPosition = {
          bottom: showAbove,
          right: showRight || spaceRight < pickerWidth / 2 ? false : true,
          center: false
        };
      }
      
      setPosition(finalPosition);
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
        // Refocus input to maintain keyboard on mobile
        if (inputRef && inputRef.current) {
          setTimeout(() => {
            inputRef.current.focus();
            // Ensure cursor is at the end
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          }, 100);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen, buttonRef, inputRef]);

  // Handle emoji selection
  const handleEmojiSelect = (emojiObject) => {
    onEmojiClick(emojiObject.emoji);
    // Don't close the modal - let users select multiple emojis
    // setIsOpen(false); // Removed to keep modal open
    
    // Immediately refocus input to maintain keyboard on mobile
    if (inputRef && inputRef.current) {
      // Use multiple strategies to maintain focus
      const refocusInput = () => {
        inputRef.current.focus();
        // Ensure cursor is at the end
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
        
        // Force the input to be the active element on mobile
        if (document.activeElement !== inputRef.current) {
          inputRef.current.click();
          inputRef.current.focus();
        }
      };
      
      // Multiple attempts to maintain focus for mobile devices
      refocusInput(); // Immediate focus
      requestAnimationFrame(refocusInput); // Focus after DOM updates
      setTimeout(refocusInput, 10); // Quick fallback
      setTimeout(refocusInput, 50); // Additional fallback for slower devices
    }
  };

  if (!isOpen) return null;

  // Dynamic positioning classes and styles - constrained within chatbox
  const isMobile = window.innerWidth < 768;
  
  // Base classes for positioning
  let positionClasses = `absolute z-[60] bg-white rounded-lg shadow-xl border border-gray-200 ${
    position.bottom ? 'bottom-full mb-2' : 'top-full mt-2'
  }`;
  
  // Add horizontal positioning classes
  if (position.center && isMobile) {
    // Mobile: No left/right classes, we'll use custom positioning
    positionClasses += '';
  } else {
    // Desktop: Use existing logic
    positionClasses += ` ${position.right ? 'right-0' : 'left-0'}`;
  }

  const pickerWidth = window.innerWidth < 400 ? window.innerWidth - 32 : 350;
  const pickerHeight = window.innerWidth < 400 ? 350 : 400;

  const dynamicStyles = {
    transform: position.bottom ? 'translateY(-8px)' : 'translateY(8px)',
    width: `${pickerWidth}px`,
    maxWidth: '350px',
    maxHeight: `${pickerHeight}px`,
  };

  // Handle positioning based on device type
  if (position.center && isMobile) {
    // Mobile: Center within the chatbox container
    const containerWidth = position.containerWidth || window.innerWidth;
    const leftOffset = Math.max(16, (containerWidth - pickerWidth) / 2); // 16px minimum margin
    dynamicStyles.left = `${leftOffset}px`;
    dynamicStyles.right = 'auto';
  } else {
    // Desktop: Use existing positioning logic
    dynamicStyles.left = position.right ? 'auto' : '0';
    dynamicStyles.right = position.right ? '0' : 'auto';
  }

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
          width={pickerWidth}
          height={pickerHeight}
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
export const EmojiButton = ({ onEmojiClick, className = "", inputRef }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const buttonRef = useRef(null);

  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent keyboard from closing by maintaining focus on input
    if (inputRef && inputRef.current && !isPickerOpen) {
      // Keep the input focused when opening emoji picker
      inputRef.current.focus();
    }
    
    setIsPickerOpen(!isPickerOpen);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onMouseDown={(e) => {
          // Prevent default mousedown behavior that might blur the input
          e.preventDefault();
        }}
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
        inputRef={inputRef}
      />
    </div>
  );
};

export default CustomEmojiPicker;