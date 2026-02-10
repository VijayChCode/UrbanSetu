import React, { useState, useEffect } from 'react';
import {
  FaFacebook, FaLinkedin, FaWhatsapp,
  FaTelegram, FaCopy, FaCheck, FaTimes, FaShareAlt,
  FaReddit, FaPinterest, FaTumblr, FaVk, FaOdnoklassniki,
  FaChevronLeft, FaChevronRight, FaEllipsisH, FaComments, FaBlogger
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiKakaotalk, SiMix, SiGmail } from 'react-icons/si';
import { toast } from 'react-toastify';

const SocialSharePanel = ({ isOpen, onClose, url, title = "Join UrbanSetu!", description = "Discover the future of real estate with UrbanSetu." }) => {
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent background scrolling
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable background scrolling
      document.body.style.overflow = '';
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => {
        clearTimeout(timer);
      };
    }
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied! Ready to share. 💎');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy link');
    }
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(checkScroll, 100);
    }
  }, [isOpen]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 240;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleMoreClick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description,
          url: url,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      toast.info('Native sharing is not supported on this browser. Try copying the link!');
    }
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: <FaWhatsapp />,
      color: 'bg-[#25D366]',
      hover: 'hover:bg-[#128C7E]',
      link: `https://wa.me/?text=${encodeURIComponent(`${title}\n${description}\n${url}`)}`
    },
    {
      name: 'Telegram',
      icon: <FaTelegram />,
      color: 'bg-[#0088cc]',
      hover: 'hover:bg-[#006699]',
      link: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${title}\n${description}`)}`
    },
    {
      name: 'Gmail',
      icon: <SiGmail />,
      color: 'bg-white !text-[#ea4335] border border-gray-100 dark:border-gray-700',
      hover: 'hover:bg-gray-50',
      link: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${url}`)}`
    },
    {
      name: 'Messages',
      icon: <FaComments />,
      color: 'bg-[#007aff]',
      hover: 'hover:bg-[#0063d1]',
      link: `sms:?body=${encodeURIComponent(`${title}\n${description}\n${url}`)}`
    },
    {
      name: 'Facebook',
      icon: <FaFacebook />,
      color: 'bg-[#1877F2]',
      hover: 'hover:bg-[#0d65d9]',
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    },
    {
      name: 'X',
      icon: <FaXTwitter />,
      color: 'bg-[#000000]',
      hover: 'hover:bg-[#333333]',
      link: `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${title}\n${description}`)}`
    },
    {
      name: 'Reddit',
      icon: <FaReddit />,
      color: 'bg-[#FF4500]',
      hover: 'hover:bg-[#ff5722]',
      link: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
    },
    {
      name: 'Pinterest',
      icon: <FaPinterest />,
      color: 'bg-[#E60023]',
      hover: 'hover:bg-[#bd081c]',
      link: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(description)}`
    },
    {
      name: 'LinkedIn',
      icon: <FaLinkedin />,
      color: 'bg-[#0077B5]',
      hover: 'hover:bg-[#005582]',
      link: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    },
    {
      name: 'VK',
      icon: <FaVk />,
      color: 'bg-[#4C75A3]',
      hover: 'hover:bg-[#3f5d81]',
      link: `https://vk.com/share.php?url=${encodeURIComponent(url)}`
    },
    {
      name: 'OK',
      icon: <FaOdnoklassniki />,
      color: 'bg-[#EE8208]',
      hover: 'hover:bg-[#d37307]',
      link: `https://connect.ok.ru/offer?url=${encodeURIComponent(url)}`
    },
    {
      name: 'Tumblr',
      icon: <FaTumblr />,
      color: 'bg-[#35465c]',
      hover: 'hover:bg-[#2c3a4d]',
      link: `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&caption=${encodeURIComponent(description)}`
    },
    {
      name: 'KakaoTalk',
      icon: <SiKakaotalk />,
      color: 'bg-[#FEE500] !text-black',
      hover: 'hover:bg-[#fdd100]',
      link: `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(url)}`
    },
    {
      name: 'Mix',
      icon: <SiMix />,
      color: 'bg-[#ff8226]',
      hover: 'hover:bg-[#f37215]',
      link: `https://mix.com/add?url=${encodeURIComponent(url)}`
    },
    {
      name: 'Blogger',
      icon: <FaBlogger />,
      color: 'bg-[#ff5722]',
      hover: 'hover:bg-[#e64a19]',
      link: `https://www.blogger.com/blog-this.g?u=${encodeURIComponent(url)}&n=${encodeURIComponent(title)}&t=${encodeURIComponent(description)}`
    }
  ];


  if (!isOpen && !isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      />

      {/* Panel */}
      <div className={`relative bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-all duration-300 transform flex flex-col border border-gray-200 dark:border-gray-800 ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}>

        {/* Compact Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Share</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-4 overflow-hidden relative group/share">
          {/* Social Icons Row - YouTube Style */}
          <style>{`
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>

          <div className="relative">
            {/* Left Arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 bg-white dark:bg-[#2a2a2a] rounded-full shadow-lg border border-gray-100 dark:border-gray-700 items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333] transition-all"
              >
                <FaChevronLeft size={12} />
              </button>
            )}

            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex items-center gap-6 overflow-x-auto pb-4 pt-2 mb-2 no-scrollbar justify-start"
            >
              {shareOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => window.open(opt.link, '_blank')}
                  className="flex flex-col items-center gap-2 group shrink-0"
                >
                  <div className={`w-14 h-14 ${opt.color} rounded-full flex items-center justify-center text-white text-2xl transition-transform duration-200 transform group-hover:scale-110 shadow-md`}>
                    {opt.icon}
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 truncate w-14 text-center">
                    {opt.name}
                  </span>
                </button>
              ))}

              {/* More Button */}
              <button
                onClick={handleMoreClick}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div className="w-14 h-14 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-2xl transition-transform duration-200 transform group-hover:scale-110 shadow-md">
                  <FaEllipsisH />
                </div>
                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 w-14 text-center">
                  More
                </span>
              </button>
            </div>

            {/* Right Arrow */}
            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 bg-white dark:bg-[#2a2a2a] rounded-full shadow-lg border border-gray-100 dark:border-gray-700 items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333] transition-all"
              >
                <FaChevronRight size={12} />
              </button>
            )}
          </div>

          {/* Link Copy Section - More compact */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-800 rounded-xl flex items-center gap-3">
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate select-all">{url}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className={`px-4 py-2 rounded-full font-bold text-sm transition-all duration-300 shrink-0 ${copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                }`}
            >
              {copied ? (
                <span className="flex items-center gap-1.5"><FaCheck size={12} /> Copied</span>
              ) : (
                'Copy'
              )}
            </button>
          </div>

          {url.includes('ref=') && (
            <div className="mt-4 text-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <p className="text-[13px] text-blue-700 dark:text-blue-300 font-medium">
                Invite friends to <span className="font-bold">UrbanSetu</span> and earn <span className="font-bold">100 SetuCoins</span> when they join! Plus, they get <span className="font-bold">50 coins</span> as a welcome gift.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialSharePanel;
