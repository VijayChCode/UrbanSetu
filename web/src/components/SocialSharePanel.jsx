import React, { useState, useEffect } from 'react';
import {
  FaFacebook, FaLinkedin, FaWhatsapp,
  FaTelegram, FaCopy, FaCheck, FaTimes, FaShareAlt,
  FaReddit, FaPinterest, FaTumblr, FaVk, FaOdnoklassniki,
  FaEnvelope, FaChevronLeft, FaChevronRight, FaEllipsisH, FaComments,
  FaTwitter
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
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
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

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: <FaWhatsapp />,
      color: 'bg-[#25D366]',
      hover: 'hover:bg-[#128C7E]',
      link: `https://wa.me/?text=${encodeURIComponent(`${title}\n${description}\n${url}`)}`
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
      name: 'Email',
      icon: <FaEnvelope />,
      color: 'bg-gray-500',
      hover: 'hover:bg-gray-600',
      link: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${url}`)}`
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
      name: 'Telegram',
      icon: <FaTelegram />,
      color: 'bg-[#0088cc]',
      hover: 'hover:bg-[#006699]',
      link: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${title}\n${description}`)}`
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
    }
  ];

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

  if (!isOpen && !isVisible) return null;

  return (
    <div className={`fixed inset-0 z-[10000] flex items-end justify-center transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Bottom Sheet Panel */}
      <div className={`relative bg-white dark:bg-[#1a1a1a] rounded-t-[32px] shadow-2xl w-full max-w-2xl overflow-hidden transition-all duration-500 transform flex flex-col border-t border-gray-200 dark:border-gray-800/50 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>

        {/* Drag Handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-2 pb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 italic">Share</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="pb-8 overflow-hidden relative">
          <style>{`
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>

          {/* Social Icons Row */}
          <div className="relative px-6">
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex items-center gap-8 overflow-x-auto pb-6 pt-2 no-scrollbar justify-start"
            >
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank')}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center text-white text-3xl shadow-lg group-active:scale-90 transition-transform">
                  <FaWhatsapp />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">WhatsApp</span>
              </button>

              <button
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank')}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div className="w-16 h-16 bg-[#0088cc] rounded-full flex items-center justify-center text-white text-3xl shadow-lg group-active:scale-90 transition-transform">
                  <FaTelegram />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Telegram</span>
              </button>

              <button
                onClick={() => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`, '_blank')}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div className="w-16 h-16 bg-white border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center text-[#ea4335] text-3xl shadow-lg group-active:scale-90 transition-transform">
                  <SiGmail />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Gmail</span>
              </button>

              <button
                onClick={() => window.open(`sms:?body=${encodeURIComponent(`${title} ${url}`)}`, '_blank')}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div className="w-16 h-16 bg-[#007aff] rounded-full flex items-center justify-center text-white text-3xl shadow-lg group-active:scale-90 transition-transform">
                  <FaComments />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Messages</span>
              </button>

              <button
                onClick={handleMoreClick}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-3xl shadow-lg group-active:scale-90 transition-transform">
                  <FaEllipsisH />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">More</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 mx-6 mb-6" />

          {/* Action List Items */}
          <div className="px-6 space-y-2">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-xl group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                {copied ? <FaCheck className="text-green-500" /> : <FaCopy />}
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 dark:text-gray-100">{copied ? 'Copied' : 'Copy link'}</p>
              </div>
            </button>

            <button
              onClick={handleMoreClick}
              className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-xl group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                <FaShareAlt />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 dark:text-gray-100">Quick Share</p>
              </div>
            </button>
          </div>

          {url.includes('ref=') && (
            <div className="mt-8 mx-6 text-center bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-[20px] border border-blue-100/50 dark:border-blue-900/20">
              <p className="text-[13px] text-blue-700/80 dark:text-blue-300/80 font-medium leading-relaxed">
                Invite friends to <span className="font-extrabold">UrbanSetu</span> and earn <span className="font-extrabold">100 SetuCoins</span> when they join!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialSharePanel;
