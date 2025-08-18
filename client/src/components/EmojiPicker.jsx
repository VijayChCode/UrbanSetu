import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { BsEmojiSmile } from 'react-icons/bs';
import { FaKeyboard } from 'react-icons/fa';

const CustomEmojiPicker = ({ onEmojiClick, isOpen, setIsOpen, buttonRef, inputRef }) => {
  const pickerRef = useRef(null);
  const [position, setPosition] = useState({ bottom: true, right: true });

  // Calculate optimal position based on chatbox container bounds
  useEffect(() => {
    if (isOpen && buttonRef.current && pickerRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const chatContainer = buttonRef.current.closest('.flex-1.overflow-y-auto.space-y-2') || 
                           buttonRef.current.closest('.flex-1.overflow-y-auto') ||
                           buttonRef.current.closest('[class*="flex-1"][class*="overflow-y-auto"]');
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
      const spaceAbove = buttonRect.top - containerRect.top;
      const showAbove = spaceAbove >= pickerHeight + 16; // 16px margin
      let finalPosition;
      if (isMobile) {
        finalPosition = {
          bottom: showAbove,
          right: false,
          center: true,
          containerRect: containerRect,
          pickerWidth: pickerWidth,
          buttonRect: buttonRect
        };
      } else {
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
        const clickedInsideInput = inputRef && inputRef.current && inputRef.current.contains(event.target);
        const isMobileNow = window.innerWidth < 768;
        if (clickedInsideInput && !isMobileNow) {
          // Keep picker open on desktop when clicking input; ensure caret stays at end
          if (inputRef && inputRef.current) {
            const el = inputRef.current;
            const moveCaretToEnd = () => {
              try {
                const length = el.value.length;
                el.setSelectionRange(length, length);
              } catch (_) {}
            };
            setTimeout(() => {
              el.focus();
              moveCaretToEnd();
            }, 0);
          }
          return;
        }

        setIsOpen(false);
        // Desktop: refocus input; Mobile: keep keyboard hidden
        if (inputRef && inputRef.current) {
          const el = inputRef.current;
          if (!isMobileNow) {
            setTimeout(() => {
              el.focus();
              try {
                const length = el.value.length;
                el.setSelectionRange(length, length);
              } catch (_) {}
            }, 100);
          }
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
    // Keep picker open for multiple selections
    const isMobileNow = window.innerWidth < 768;
    if (inputRef && inputRef.current) {
      const el = inputRef.current;
      const moveCaretToEnd = () => {
        try {
          const length = el.value.length;
          el.setSelectionRange(length, length);
        } catch (_) {}
      };
      if (!isMobileNow) {
        const refocusInput = () => {
          el.focus();
          moveCaretToEnd();
          if (document.activeElement !== el) {
            el.click();
            el.focus();
            moveCaretToEnd();
          }
        };
        refocusInput();
        requestAnimationFrame(refocusInput);
        setTimeout(refocusInput, 10);
        setTimeout(refocusInput, 50);
      } else {
        // Mobile: keep keyboard open; ensure caret stays at end while inserting emojis
        const keepFocusAndCaret = () => {
          el.focus();
          moveCaretToEnd();
        };
        keepFocusAndCaret();
        requestAnimationFrame(keepFocusAndCaret);
        setTimeout(keepFocusAndCaret, 10);
        setTimeout(keepFocusAndCaret, 50);
      }
    }
  };

  if (!isOpen) return null;

  // Dynamic positioning classes and styles - constrained within chatbox
  const isMobile = window.innerWidth < 768;
  let positionClasses = `absolute z-[60] bg-white rounded-lg shadow-xl border border-gray-200 ${
    position.bottom ? 'bottom-full mb-2' : 'top-full mt-2'
  }`;
  if (position.center && isMobile) {
    positionClasses += '';
  } else {
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
  if (position.center && isMobile) {
    const containerRect = position.containerRect;
    const buttonRect = position.buttonRect;
    if (containerRect && buttonRect) {
      const containerWidth = containerRect.width;
      const containerLeft = containerRect.left;
      const buttonLeft = buttonRect.left;
      const pickerLeft = Math.max(
        16,
        Math.min(
          containerWidth - pickerWidth - 16,
          (containerWidth - pickerWidth) / 2
        )
      );
      const buttonRelativeLeft = buttonLeft - containerLeft;
      dynamicStyles.left = `${pickerLeft - buttonRelativeLeft}px`;
      dynamicStyles.right = 'auto';
    } else {
      const leftOffset = Math.max(16, (window.innerWidth - pickerWidth) / 2);
      dynamicStyles.left = `${leftOffset}px`;
      dynamicStyles.right = 'auto';
    }
  } else {
    dynamicStyles.left = position.right ? 'auto' : '0';
    dynamicStyles.right = position.right ? '0' : 'auto';
  }

  return (
    <div 
      ref={pickerRef}
      className={positionClasses}
      style={dynamicStyles}
    >
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) {
      // Keep keyboard open on mobile by maintaining focus in both cases
      if (inputRef && inputRef.current) {
        const el = inputRef.current;
        el.focus();
        const moveCaretToEnd = () => {
          const length = el.value.length;
          try { el.setSelectionRange(length, length); } catch (_) {}
        };
        moveCaretToEnd();
        requestAnimationFrame(moveCaretToEnd);
        setTimeout(moveCaretToEnd, 10);
        setTimeout(moveCaretToEnd, 50);
      }
    } else {
      if (inputRef && inputRef.current && !isPickerOpen) {
        inputRef.current.focus();
      }
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
          e.preventDefault();
        }}
        className={`flex items-center justify-center p-2 text-gray-500 hover:text-yellow-500 hover:bg-gray-100 rounded-full transition-colors duration-200 ${className}`}
        title="Add emoji"
      >
        {isMobile && isPickerOpen ? (
          <FaKeyboard className="text-lg" />
        ) : (
          <BsEmojiSmile className="text-lg" />
        )}
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

