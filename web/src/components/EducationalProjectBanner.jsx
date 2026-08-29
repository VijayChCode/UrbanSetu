import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Sparkles,
  Heart,
  MessageSquareHeart,
  Info,
  ShieldCheck,
  Code2,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from "lucide-react";

/**
 * EducationalProjectBanner
 * 
 * A highlighted informational banner showcasing UrbanSetu as an educational 
 * major capstone project built for non-commercial learning, demonstration, 
 * and community feedback.
 * 
 * @param {Object} props
 * @param {string} [props.className] - Additional wrapper styling
 * @param {boolean} [props.isUser] - True if in logged-in /user context for links
 */
export default function EducationalProjectBanner({ className = "", isUser = false }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check sessionStorage so dismissal persists for the active session if closed
  useEffect(() => {
    const dismissed = sessionStorage.getItem("urbansetu_edu_banner_dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("urbansetu_edu_banner_dismissed", "true");
  };

  const handleRestore = () => {
    setIsDismissed(false);
    sessionStorage.removeItem("urbansetu_edu_banner_dismissed");
  };

  const contactLink = isUser ? "/user/contact" : "/contact";
  const aboutLink = isUser ? "/user/about" : "/about";

  if (isDismissed) {
    return (
      <div className={`flex justify-center my-3 sm:my-4 px-2 animate-fade-in ${className}`}>
        <button
          onClick={handleRestore}
          className="group inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-200 dark:border-blue-800/60 text-[11px] sm:text-xs font-semibold text-blue-600 dark:text-blue-400 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
          title="Click to view educational project notice"
        >
          <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0 group-hover:rotate-12 transition-transform duration-300" />
          <span className="truncate max-w-[220px] sm:max-w-none">Major Project Educational Notice</span>
          <Info className="w-3 h-3 text-purple-500 shrink-0 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group relative w-full overflow-hidden rounded-2xl sm:rounded-3xl p-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 bg-[length:200%_200%] animate-gradient-x shadow-xl shadow-blue-500/10 dark:shadow-purple-950/30 transition-all duration-500 ${className}`}
    >
      {/* Dynamic Animated Ambient Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl sm:rounded-3xl blur-md opacity-25 dark:opacity-40 group-hover:opacity-60 bg-[length:200%_200%] animate-gradient-x transition duration-1000 group-hover:duration-200 pointer-events-none" />

      {/* Main Inner Card */}
      <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-[14px] sm:rounded-[22px] p-4 sm:p-6 md:p-8 text-left transition-colors duration-300 overflow-hidden">
        
        {/* Background Floating Orbs */}
        <div className="absolute -top-12 -right-12 w-40 sm:w-56 h-40 sm:h-56 bg-purple-400/15 dark:bg-purple-500/15 rounded-full blur-2xl pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-12 -left-12 w-40 sm:w-56 h-40 sm:h-56 bg-blue-400/15 dark:bg-blue-500/15 rounded-full blur-2xl pointer-events-none animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

        {/* Top Header Row: Badges & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 relative z-10">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Academic Project Badge with Pulse Indicator */}
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60 shadow-sm transition-transform duration-200 hover:scale-105">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 dark:bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 dark:bg-blue-400"></span>
              </span>
              <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Academic Major Project</span>
            </span>

            {/* Non-Commercial Notice Badge */}
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60 shadow-sm transition-transform duration-200 hover:scale-105">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Non-Commercial</span>
            </span>

            {/* Passion Badge */}
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-pink-50 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-700/60 shadow-sm transition-transform duration-200 hover:scale-105">
              <Heart className="w-3 h-3 text-pink-500 fill-pink-500 shrink-0 animate-pulse" />
              <span>Built with Passion</span>
            </span>
          </div>

          {/* Action buttons (Minimize / Dismiss) */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:scale-110 active:scale-95"
              title={isCollapsed ? "Expand details" : "Minimize"}
              aria-label={isCollapsed ? "Expand details" : "Minimize"}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all hover:scale-110 active:scale-95"
              title="Dismiss notice for this session"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Headline & Icon Section */}
        <div className="flex items-start gap-3 sm:gap-4 relative z-10">
          <div className="hidden sm:flex w-10 h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2 leading-tight">
              <span>Welcome to</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 font-extrabold">
                UrbanSetu
              </span>
              <span className="text-xs sm:text-base md:text-lg font-semibold text-gray-500 dark:text-gray-400">
                — Educational Showcase
              </span>
            </h2>

            {/* Collapsed Preview or Full Information with Transition */}
            <div className="transition-all duration-300 ease-in-out">
              {!isCollapsed ? (
                <div className="mt-2.5 sm:mt-3 space-y-2.5 sm:space-y-3.5 animate-fade-in">
                  <p className="text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed font-normal">
                    <strong className="font-semibold text-gray-900 dark:text-white">UrbanSetu</strong> is an advanced, full-stack real estate platform conceptualized and engineered exclusively as an <span className="font-semibold text-blue-600 dark:text-blue-400">educational major project</span>. This application is built solely for learning, academic demonstration, and technical experimentation, and is <strong className="font-semibold text-amber-700 dark:text-amber-400">not intended for commercial operations</strong>.
                  </p>

                  <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
                    Crafted with passion and dedication, it showcases real-time property management, AI-powered recommendations, interactive virtual tours, secure document workflows, and modern cloud architecture. We warmly invite you to <span className="font-semibold text-indigo-600 dark:text-indigo-400">experience the features</span>, explore the tools, and <span className="font-semibold text-purple-600 dark:text-purple-400">share your valuable feedback</span> to help us learn and improve!
                  </p>

                  {/* Feature Highlights Chips */}
                  <div className="pt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs font-medium text-gray-600 dark:text-gray-300">
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-all hover:scale-105 cursor-default">
                      <Code2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" />
                      Full-Stack Project Showcase
                    </span>
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-all hover:scale-105 cursor-default">
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" />
                      AI & Real-Time Demos
                    </span>
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-all hover:scale-105 cursor-default">
                      <MessageSquareHeart className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                      Open for Feedback
                    </span>
                  </div>

                  {/* Bottom Action CTAs */}
                  <div className="pt-1.5 sm:pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <Link
                      to={contactLink}
                      className="group/btn inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <MessageSquareHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 group-hover/btn:scale-110 transition-transform" />
                      <span>Give Feedback & Suggestions</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>

                    <Link
                      to={aboutLink}
                      className="group/about inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-semibold text-xs sm:text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0 group-hover/about:rotate-12 transition-transform" />
                      <span>About the Project</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-2 animate-fade-in">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                    UrbanSetu is an educational major project built with passion for academic evaluation and non-commercial demonstration.
                  </p>
                  <button
                    onClick={() => setIsCollapsed(false)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 hover:scale-105 transition-transform"
                  >
                    Read More
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
