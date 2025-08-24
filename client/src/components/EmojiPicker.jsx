import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker from 'emoji-picker-react';
import { BsEmojiSmile } from 'react-icons/bs';
import { FaKeyboard, FaTimes } from 'react-icons/fa';

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
        // Desktop: always place the picker ABOVE the button to avoid covering the input area
        // Keep horizontal alignment logic the same
        finalPosition = {
          bottom: true,
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

  // Robustly prevent background/page scroll while emoji picker is open
  useEffect(() => {
    if (!isOpen) return;

    const isMobileNow = window.innerWidth < 768;

    // Save scroll position and lock body
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overscroll: document.documentElement.style.overscrollBehavior,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    // Helps on mobile Safari to avoid rubber-band
    document.documentElement.style.overscrollBehavior = 'none';

    const preventBackgroundScroll = (event) => {
      // Allow interactions and scrolling inside the picker
      if (pickerRef.current && pickerRef.current.contains(event.target)) {
        return;
      }
      // Only prevent if cancelable
      if (event && event.cancelable) {
        event.preventDefault();
      }
    };
    const keepScroll = () => {
      // On desktop, pin scroll to original
      window.scrollTo(0, scrollY);
    };

    // Block scroll gestures outside the picker
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    if (!isMobileNow) {
      window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
      window.addEventListener('scroll', keepScroll, { passive: false });
    }

    return () => {
      // Restore body
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.documentElement.style.overscrollBehavior = previous.overscroll;
      // Restore scroll position
      const y = Math.abs(parseInt(previous.top || '0', 10)) || scrollY;
      window.scrollTo(0, y);
      // Cleanup listeners
      document.removeEventListener('touchmove', preventBackgroundScroll);
      document.removeEventListener('wheel', preventBackgroundScroll);
      if (!isMobileNow) {
        window.removeEventListener('wheel', preventBackgroundScroll);
        window.removeEventListener('scroll', keepScroll);
      }
    };
  }, [isOpen]);

  // Handle emoji selection
  const handleEmojiSelect = (emojiObject) => {
    onEmojiClick(emojiObject.emoji);
    // Keep the picker open after selection for better user experience
    // setIsOpen(false); // Removed to keep picker open
    // Do not force focus on mobile; only maintain focus if already focused
    const wasFocused = inputRef && inputRef.current && document.activeElement === inputRef.current;
    if (wasFocused) {
      try { inputRef.current.focus(); } catch (_) {}
    }
  };

  if (!isOpen) return null;

  // Dynamic positioning classes and styles - constrained within chatbox (desktop), fixed overlay (mobile)
  const isMobile = window.innerWidth < 768;
  // Force above positioning on desktop to avoid overlapping the input area
  let positionClasses = `absolute z-[60] bg-white rounded-lg shadow-xl border border-gray-200 ${
    true ? 'bottom-full mb-2' : 'top-full mt-2'
  }`;
  if (position.center && isMobile) {
    positionClasses += '';
  } else {
    positionClasses += ` ${position.right ? 'right-0' : 'left-0'}`;
  }
  const pickerWidth = window.innerWidth < 400 ? window.innerWidth - 32 : 350;
  const pickerHeight = window.innerWidth < 400 ? 350 : 400;
  const viewportMax = Math.floor(window.innerHeight * (isMobile ? 0.45 : 0.6));
  const effectiveMaxHeight = Math.min(pickerHeight, viewportMax);
  const dynamicStyles = {
    transform: position.bottom ? 'translateY(-8px)' : 'translateY(8px)',
    width: `${pickerWidth}px`,
    maxWidth: '350px',
    maxHeight: `${effectiveMaxHeight}px`
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

  // Ensure extra bottom spacing on desktop so the picker never collides with the input area visually
  if (!isMobile) {
    dynamicStyles.marginBottom = '8px';
  }

  // For mobile: render in a fixed portal anchored to viewport to avoid being affected by footer/keyboard shifts
  if (isMobile) {
    const viewportLeft = Math.max(16, (window.innerWidth - pickerWidth) / 2);
    const fixedStyles = {
      position: 'fixed',
      left: `${viewportLeft}px`,
      right: 'auto',
      bottom: `88px`,
      zIndex: 9999,
      width: `${pickerWidth}px`,
      maxWidth: '350px',
      maxHeight: `${effectiveMaxHeight}px`,
      background: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      border: '1px solid rgba(229,231,235,1)',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch', // momentum scroll on iOS
      touchAction: 'pan-y',
      overscrollBehavior: 'contain'
    };

    return createPortal(
      <div
        ref={pickerRef}
        style={fixedStyles}
        onMouseDown={(e) => { e.preventDefault(); }}
        onWheel={(e) => { e.stopPropagation(); }}
        onTouchStart={(e) => { e.stopPropagation(); }}
        onTouchMove={(e) => { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-white sticky top-0 z-10 rounded-t-lg">
          <span className="text-sm font-semibold text-gray-700">Emoji</span>
          <button
            type="button"
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setIsOpen(false)}
            aria-label="Close emoji picker"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          onEmojiMouseDown={(e) => { e.preventDefault?.(); }}
          searchDisabled={false}
          searchPlaceholder="Search emojis..."
          autoFocusSearch={true}
          previewConfig={{ showPreview: false }}
          skinTonesDisabled={false}
          suggestedEmojisMode="recent"
          width={pickerWidth}
          height={pickerHeight}
          lazyLoadEmojis={true}
          theme="light"
          emojiStyle="google"
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
      </div>,
      document.body
    );
  }

  // Desktop: render in a fixed portal anchored to viewport near the button to avoid overlapping input
  const desktopMargin = 12;
  const buttonRect = buttonRef.current ? buttonRef.current.getBoundingClientRect() : null;
  const viewportLeftClamp = (x) => Math.max(16, Math.min(x, window.innerWidth - pickerWidth - 16));
  const spaceAboveViewport = buttonRect ? buttonRect.top : window.innerHeight / 2;
  const spaceBelowViewport = buttonRect ? (window.innerHeight - buttonRect.bottom) : window.innerHeight / 2;
  const placeAbove = spaceAboveViewport >= effectiveMaxHeight + desktopMargin || spaceAboveViewport >= spaceBelowViewport;
  const computedTop = buttonRect
    ? (placeAbove
        ? Math.max(16, buttonRect.top - effectiveMaxHeight - desktopMargin)
        : Math.min(window.innerHeight - effectiveMaxHeight - 16, buttonRect.bottom + desktopMargin))
    : Math.max(16, window.innerHeight - effectiveMaxHeight - 88);
  const computedLeft = buttonRect
    ? viewportLeftClamp(buttonRect.right - pickerWidth)
    : viewportLeftClamp((window.innerWidth - pickerWidth) / 2);

  const desktopFixedStyles = {
    position: 'fixed',
    left: `${computedLeft}px`,
    top: `${computedTop}px`,
    zIndex: 9999,
    width: `${pickerWidth}px`,
    maxWidth: '350px',
    height: `${effectiveMaxHeight}px`,
    background: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    border: '1px solid rgba(229,231,235,1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  };

  return createPortal(
    <div
      ref={pickerRef}
      style={desktopFixedStyles}
      onMouseDown={(e) => { e.preventDefault(); }}
      onWheel={(e) => { e.stopPropagation(); }}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onTouchMove={(e) => { e.stopPropagation(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white sticky top-0 z-10 rounded-t-lg">
        <span className="text-sm font-semibold text-gray-700">Emoji</span>
        <button
          type="button"
          className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          onClick={() => setIsOpen(false)}
          aria-label="Close emoji picker"
        >
          <FaTimes className="w-4 h-4" />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
        onWheel={(e) => { e.stopPropagation(); }}
        onTouchMove={(e) => { e.stopPropagation(); }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          onEmojiMouseDown={(e) => { e.preventDefault?.(); }}
          searchDisabled={false}
          searchPlaceholder="Search emojis..."
          autoFocusSearch={true}
          previewConfig={{ showPreview: false }}
          skinTonesDisabled={false}
          suggestedEmojisMode="recent"
          width={pickerWidth}
          height={effectiveMaxHeight - 60}
          lazyLoadEmojis={true}
          theme="light"
          emojiStyle="google"
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
    </div>,
    document.body
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

  // Close the emoji picker when a global event is dispatched (e.g., after sending a message)
  useEffect(() => {
    const closeHandler = () => setIsPickerOpen(false);
    window.addEventListener('closeEmojiPicker', closeHandler);
    return () => window.removeEventListener('closeEmojiPicker', closeHandler);
  }, []);

  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const inputEl = inputRef && inputRef.current ? inputRef.current : null;
    const wasFocused = !!(inputEl && document.activeElement === inputEl);
    const openingPicker = !isPickerOpen;

    if (isMobile) {
      if (openingPicker) {
        // Opening emoji picker: keep keyboard open only if it was already open
        if (wasFocused && inputEl) {
          const moveCaretToEnd = () => {
            const length = inputEl.value.length;
            try { inputEl.setSelectionRange(length, length); } catch (_) {}
          };
          inputEl.focus();
          moveCaretToEnd();
          requestAnimationFrame(moveCaretToEnd);
          setTimeout(moveCaretToEnd, 10);
          setTimeout(moveCaretToEnd, 50);
        }
      } else {
        // Closing emoji picker via keyboard icon: ALWAYS focus input to open keyboard
        if (inputEl) {
          const moveCaretToEnd = () => {
            const length = inputEl.value.length;
            try { inputEl.setSelectionRange(length, length); } catch (_) {}
          };
          inputEl.focus();
          moveCaretToEnd();
          requestAnimationFrame(moveCaretToEnd);
          setTimeout(moveCaretToEnd, 10);
          setTimeout(moveCaretToEnd, 50);
        }
      }
    } else {
      // Desktop: when opening picker, focus input for better caret behavior
      if (openingPicker && inputEl) {
        try { inputEl.focus(); } catch (_) {}
      }
    }
    setIsPickerOpen(openingPicker);
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        className={`w-9 h-9 flex items-center justify-center text-gray-600 bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 hover:text-yellow-600 rounded-full transition-all ${className}`}
        title="Add emoji"
      >
        {isMobile && isPickerOpen ? (
          <FaKeyboard className="text-lg" />
        ) : (
          <BsEmojiSmile className="text-xl" />
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
