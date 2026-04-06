import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaHome, FaCity, FaHeart, FaStar, FaCoins, FaRocket, FaFlag,
    FaChevronRight, FaChevronLeft, FaShareAlt, FaChartLine, FaUsers,
    FaShieldAlt, FaDownload, FaCalendarAlt, FaBuilding, FaMagic,
    FaFire, FaStamp, FaHandshake, FaTimes, FaCloud,
    FaComments, FaTools, FaCalculator, FaPenNib, FaTruck,
    FaRobot, FaSearchPlus, FaBell, FaMapMarkerAlt, FaPhone
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import SocialSharePanel from '../components/SocialSharePanel';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const YearInReview = ({ isAdmin = false }) => {
    const { year } = useParams();
    const navigate = useNavigate();
    usePageTitle(`Year in Review ${year} - UrbanSetu`);
    const { currentUser } = useSelector((state) => state.user);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [shareUrl, setShareUrl] = useState(window.location.href);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [error, setError] = useState(null);
    const flashbackRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const endpoint = isAdmin
                    ? `${API_BASE_URL}/api/year-in-review/admin/${year}`
                    : `${API_BASE_URL}/api/year-in-review/user/${year}`;

                const res = await authenticatedFetch(endpoint);
                const json = await res.json();

                if (res.ok) {
                    setData(json);
                    setError(null);
                } else {
                    setError(json.message || 'Flashback data currently unavailable');
                }
            } catch (error) {
                console.error('Error fetching flashback:', error);
                toast.error('Network error. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [year, isAdmin]);

    useEffect(() => {
        // Disable scroll when in cinematic view
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const slideContent = isAdmin ? {
        intro: {
            title: `Admin System Review ${year}`,
            subtitle: "Platform Excellence",
            content: "Driving the future of real estate management.",
            icon: <FaShieldAlt className="text-8xl text-indigo-400 mb-6" />,
            color: "from-gray-900 via-indigo-950 to-gray-900",
        },
        stats: {
            title: "Platform Growth",
            content: data?.stats?.users > 0
                ? `You managed ${data.stats.users} new users and oversaw ${data.stats.listings} total listings.`
                : "System logs show consistent platform uptime and growth.",
            subtitle: `${data?.stats?.bookings || 0} bookings and ${data?.stats?.referrals || 0} referrals handled flawlessly.`,
            icon: <FaChartLine className="text-8xl text-emerald-400 mb-6" />,
            color: "from-gray-900 via-emerald-950 to-gray-900",
        },
        moderation: {
            title: "Safety First",
            content: `You resolved ${data?.stats?.resolvedDisputes || 0} disputes this year.`,
            subtitle: `Currently monitoring ${data?.stats?.activeReports || 0} active reports.`,
            icon: <FaHandshake className="text-8xl text-blue-400 mb-6" />,
            color: "from-gray-900 via-blue-950 to-gray-900",
        },
        verification: {
            title: "Trust Builder",
            content: `Issued ${data?.stats?.verifications || 0} Property Verification Badges.`,
            subtitle: "Ensuring every listing meets UrbanSetu standards.",
            icon: <FaStamp className="text-8xl text-purple-400 mb-6" />,
            color: "from-gray-900 via-purple-950 to-gray-900",
        },
        finance: {
            id: 'admin-finance',
            title: "Economic Impact",
            content: data?.stats?.revenue > 0
                ? `₹${(data.stats.revenue).toLocaleString()} in platform transactions.`
                : "Scaling revenue streams for the next quarter.",
            subtitle: `Top Activity Hub: ${data?.stats?.topCity || 'Multiple Regions'}`,
            icon: <FaCoins className="text-8xl text-yellow-500 mb-6" />,
            color: "from-gray-900 via-yellow-950 to-gray-900",
        },
        operational: {
            title: "Operational Excellence",
            content: `Handled ${(data?.stats?.serviceRequests || 0) + (data?.stats?.moversRequests || 0)} service and relocation requests.`,
            subtitle: `Plus ${data?.stats?.loans || 0} rental loans approved and ${data?.stats?.rentalRatings || 0} rental ratings mutualized.`,
            icon: <FaTools className="text-8xl text-orange-400 mb-6" />,
            color: "from-gray-900 via-orange-950 to-gray-900",
        },
        content: {
            title: "Content Dynasty",
            content: `Published ${data?.stats?.blogs || 0} blog posts and moderated ${data?.stats?.forumPosts || 0} forum topics.`,
            subtitle: "Feeding the knowledge ecosystem.",
            icon: <FaPenNib className="text-8xl text-pink-400 mb-6" />,
            color: "from-gray-900 via-pink-950 to-gray-900",
        },
        insight: {
            title: "Insight Engine",
            content: `Platform users performed ${data?.stats?.calculations || 0} real estate calculations.`,
            subtitle: "Data-driven decisions start here.",
            icon: <FaCalculator className="text-8xl text-sky-400 mb-6" />,
            color: "from-gray-900 via-sky-950 to-gray-900",
        },
        engagement: {
            title: "Digital Ecosystem",
            content: `${data?.stats?.aiMessages || 0} AI assistant queries and ${data?.stats?.savedSearches || 0} tailored searches.`,
            subtitle: `Platform heartbeat: ${data?.stats?.notifications || 0} notifications delivered.`,
            icon: <FaRobot className="text-8xl text-violet-400 mb-6" />,
            color: "from-gray-900 via-violet-950 to-gray-900",
        },
        persona: {
            title: `Your ${year} Identity`,
            content: data?.personality?.type || "The Urban Architect",
            subtitle: data?.personality?.desc || "Building the foundations of future city living.",
            icon: <FaRocket className="text-8xl text-emerald-400 mb-6" />,
            color: "from-gray-900 via-emerald-950 to-gray-900",
            highlight: true
        },
        outro: {
            title: `Forward to ${parseInt(year) + 1}`,
            content: "Successfully steering the platform into the future.",
            subtitle: `Admin Log: ${(data?.stats?.listings || 0) + (data?.stats?.users || 0)} key milestones recorded.`,
            icon: <FaFlag className="text-8xl text-white mb-6" />,
            color: "from-[#0f172a] via-[#1e293b] to-[#0f172a]",
            outro: true
        }
    } : {
        intro: {
            title: `Your ${year} Flashback`,
            subtitle: "UrbanSetu Journeys",
            content: `Hey ${currentUser?.username}, ready for your highlight reel?`,
            icon: <FaHome className="text-8xl text-blue-400 mb-6" />,
            color: "from-blue-950 via-[#0a192f] to-blue-950",
        },
        streak: {
            title: "Pure Consistency",
            content: data?.stats?.activeDays > 0 ? `You used UrbanSetu for ${data.stats.activeDays} days this year!` : "You didn't engage in any daily usage streaks this year.",
            subtitle: data?.stats?.maxStreak > 1
                ? `Your longest activity streak was ${data.stats.maxStreak} days.`
                : "Consistency wasn't your strong suit this year.",
            icon: <FaFire className="text-8xl text-red-500 mb-6 animate-pulse" />,
            color: "from-red-950 via-[#1a0500] to-red-950",
        },
        peak: {
            title: "Peak Energy",
            content: data?.stats?.views > 0
                ? `You were on fire in ${data?.stats?.peakMonth}!`
                : "Your journey picked up speed this year.",
            subtitle: "Browsing properties like a pro hunter.",
            icon: <FaCalendarAlt className="text-8xl text-orange-400 mb-6" />,
            color: "from-orange-950 via-[#1a0f00] to-orange-950",
        },
        type: {
            title: "Your Signature Style",
            content: data?.stats?.views > 0
                ? `You couldn't stop looking at ${data?.stats?.topType}s.`
                : "Defining your unique property taste...",
            subtitle: "An eye for the extraordinary.",
            icon: <FaMagic className="text-8xl text-cyan-400 mb-6" />,
            color: "from-cyan-950 via-[#001a1a] to-cyan-950",
        },
        views: {
            title: "The Explorer",
            content: data?.stats?.views > 0 ? `You unlocked the details of ${data.stats.views} homes!` : "You didn't view any specific property details this year.",
            subtitle: data?.topCities?.length > 0
                ? `Exploring: ${data.topCities.join(', ')}`
                : "Next year, the world is your oyster.",
            icon: <FaCity className="text-8xl text-purple-400 mb-6" />,
            color: "from-purple-950 via-[#14001a] to-purple-950",
        },
        heart: {
            title: "Most Loved",
            content: data?.stats?.wishlist > 0 ? `Saved ${data.stats.wishlist} wishlist favorites.` : "You didn't save any properties to your wishlist this year.",
            subtitle: data?.stats?.favorites > 0 ? `You also loved ${data.stats.favorites} stunning property photos.` : "No favorite photos were marked this year.",
            icon: <FaHeart className="text-8xl text-pink-400 mb-6" />,
            color: "from-pink-950 via-[#1a000a] to-pink-950",
        },
        secured: {
            title: "Action Taker",
            content: data?.stats?.bookings > 0 ? `You completed ${data.stats.bookings} property bookings!` : "No property bookings were made by you this year.",
            subtitle: data?.stats?.rentals > 0
                ? `Plus ${data.stats.rentals} active Rental Contracts secured.`
                : "And no active rental contracts were found for this period.",
            icon: <FaHandshake className="text-8xl text-emerald-400 mb-6" />,
            color: "from-emerald-950 via-[#001a0a] to-emerald-950",
        },
        mogul: {
            title: "Property Mogul",
            content: data?.stats?.listingsCreated > 0 ? `You listed ${data.stats.listingsCreated} properties on market.` : "You didn't list any properties for sale or rent this year.",
            subtitle: (data?.stats?.listingsSold > 0 || data?.stats?.listingsRented > 0)
                ? `Successfully sold ${data?.stats?.listingsSold} and rented out ${data?.stats?.listingsRented} units!`
                : "Your real estate portfolio remained unchanged.",
            icon: <FaBuilding className="text-8xl text-indigo-500 mb-6" />,
            color: "from-indigo-950 via-[#0a001a] to-indigo-950",
        },
        reviews: {
            title: "Critical Eye",
            content: (data?.stats?.reviews > 0 || data?.stats?.reviewReplies > 0) ? `You posted ${data?.stats?.reviews || 0} reviews and engaged with ${data?.stats?.reviewReplies || 0} replies.` : "You didn't write any reviews or replies this year.",
            subtitle: data?.stats?.helpfulVotesReceived > 0
                ? `Your insights got ${data?.stats?.helpfulVotesReceived} helpful votes from the community!`
                : "No helpful votes were received on your contributions this year.",
            icon: <FaStar className="text-8xl text-orange-400 mb-6" />,
            color: "from-orange-950 via-[#1a0f00] to-orange-950",
        },
        coins: {
            title: "SetuCoins Milestone",
            content: data?.stats?.coins > 0 ? `You stacked up ${data.stats.coins} SetuCoins!` : "No SetuCoins were earned during this year.",
            subtitle: "Your engagement is literally paying off.",
            icon: <FaCoins className="text-8xl text-yellow-400 mb-6" />,
            color: "from-yellow-950 via-[#1a1500] to-yellow-950",
        },
        forum: {
            title: "Community Voice",
            content: (data?.stats?.forumPosts > 0 || data?.stats?.forumEngagement > 0) ? `You started ${data?.stats?.forumPosts || 0} discussions and contribued ${data?.stats?.forumEngagement || 0} replies!` : "You didn't start discussions or post replies this year.",
            subtitle: data?.stats?.blogComments > 0
                ? `You also shared ${data?.stats?.blogComments} insights on our blog posts.`
                : "The community didn't hear from you in the blogs this year.",
            icon: <FaComments className="text-8xl text-indigo-400 mb-6" />,
            color: "from-indigo-950 via-[#05001a] to-indigo-950",
        },
        concierge: {
            title: "Home Concierge",
            content: ((data?.stats?.serviceRequests || 0) + (data?.stats?.moversRequests || 0)) > 0 ? `Used ${data?.stats?.serviceRequests || 0} UrbanSetu services and planned ${data?.stats?.moversRequests || 0} moves.` : "You didn't book any movers or service requests this year.",
            subtitle: "Making city living effortless.",
            icon: <FaTools className="text-8xl text-amber-400 mb-6" />,
            color: "from-amber-950 via-[#1a0a00] to-amber-950",
        },
        trust: {
            title: "Trusted Member",
            content: data?.stats?.rentalRatings > 0 ? `You participated in ${data.stats.rentalRatings} verified rating exchanges.` : "You didn't participate in verified rating exchanges this year.",
            subtitle: data?.stats?.verificationsEarned > 0
                ? `And earned ${data?.stats?.verificationsEarned} Verified Property Badges! 🛡️`
                : "Building a reputation that opens doors.",
            icon: <FaShieldAlt className="text-8xl text-blue-500 mb-6" />,
            color: "from-blue-950 via-[#000a1a] to-blue-950",
        },
        communication: {
            title: "Communication Hub",
            content: data?.stats?.totalCalls > 0 ? `You connected via ${data.stats.totalCalls} calls for ${data.stats.callDuration} minutes.` : "You didn't make or receive any calls on the platform this year.",
            subtitle: (data?.stats?.videoCalls > 0)
                ? `Including ${data?.stats?.videoCalls} video calls and ${data?.stats?.audioCalls} audio calls!`
                : "Making meaningful connections, one call at a time.",
            icon: <FaPhone className="text-8xl text-emerald-500 mb-6" />,
            color: "from-emerald-950 via-[#001a0f] to-emerald-950",
        },
        pathfinder: {
            title: "Urban Navigator",
            content: data?.stats?.routesSaved > 0 ? `You planned ${data.stats.routesSaved} smart routes using our Navigator.` : "You didn't save any navigation routes this year.",
            subtitle: data?.stats?.routeDistance > 0
                ? `Covering ${data?.stats?.routeDistance}km across ${data?.stats?.routeStops} waypoints!`
                : "Finding the fastest path to your dream property.",
            icon: <FaMapMarkerAlt className="text-8xl text-rose-500 mb-6" />,
            color: "from-rose-950 via-[#1a0005] to-rose-950",
        },
        architect: {
            title: "Financial Architect",
            content: data?.stats?.calculations > 0 ? `You performed ${data.stats.calculations} smart real estate calculations!` : "You didn't run any financial calculations this year.",
            subtitle: "Planning your future with precision.",
            icon: <FaCalculator className="text-8xl text-teal-400 mb-6" />,
            color: "from-teal-950 via-[#001a1a] to-teal-950",
        },
        loans: {
            title: "Smart Finance",
            content: data?.stats?.loans > 0 ? `You secured ${data.stats.loans} rental loans to manage your cash flow.` : "You didn't apply for any rental loans this year.",
            subtitle: "Empowering your move with financial flexibility.",
            icon: <FaCoins className="text-8xl text-green-500 mb-6" />,
            color: "from-green-950 via-[#051a00] to-green-950",
        },
        networker: {
            title: "Community Growth",
            content: data?.stats?.referrals > 0 ? `You introduced ${data.stats.referrals} new members to UrbanSetu!` : "You didn't refer any new members this year.",
            subtitle: "The community grows stronger through you.",
            icon: <FaUsers className="text-8xl text-pink-400 mb-6" />,
            color: "from-pink-950 via-[#1a000d] to-pink-950",
        },
        digital: {
            title: "Digital Footprint",
            content: (data?.stats?.aiMessages > 0 || data?.stats?.savedSearches > 0) ? `You asked our AI assistant ${data?.stats?.aiMessages || 0} questions and tracked ${data?.stats?.savedSearches || 0} specific markets.` : "You didn't interact with our AI or save searches this year.",
            subtitle: data?.stats?.notifications > 0 ? `Stayed connected with ${data.stats.notifications} smart notifications.` : "Notifications were quiet for your account.",
            icon: <FaRobot className="text-8xl text-violet-400 mb-6" />,
            color: "from-violet-950 via-[#0a001a] to-violet-950",
        },
        persona: {
            title: `Your ${year} Identity`,
            content: data?.personality?.type || "The Urban Resident",
            subtitle: data?.personality?.desc || "A visionary hunter of perfect spaces.",
            icon: <FaRocket className="text-8xl text-green-400 mb-6" />,
            color: "from-green-950 via-[#001a0a] to-green-950",
            highlight: true
        },
        outro: {
            title: `Next Stop: ${parseInt(year) + 1}`,
            content: `Thanks for building ${year} with UrbanSetu.`,
            icon: <FaFlag className="text-8xl text-white mb-6" />,
            color: "from-[#0f172a] via-[#1e293b] to-[#0f172a]",
            outro: true
        }
    };

    const slides = Object.entries(slideContent).map(([key, val]) => ({ id: key, ...val }));

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(prev => prev + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const handleShare = async () => {
        setIsUploading(true);
        try {
            if (!flashbackRef.current) return;

            const canvas = await html2canvas(flashbackRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore')
            });

            const base64Image = canvas.toDataURL('image/png');

            const res = await authenticatedFetch(`${API_BASE_URL}/api/year-in-review/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, year }),
            });

            const json = await res.json();
            if (res.ok) {
                setShareUrl(json.imageUrl);
                setIsShareOpen(true);
            } else {
                toast.error('Cloudinary upload failed. Sharing direct link instead.');
                setIsShareOpen(true);
            }
        } catch (error) {
            console.error('Share upload failed:', error);
            setIsShareOpen(true);
        } finally {
            setIsUploading(false);
        }
    };

    const downloadFlashback = async () => {
        if (!flashbackRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(flashbackRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore')
            });
            const link = document.createElement('a');
            link.download = `UrbanSetu_Flashback_${year}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success('Flashback saved to gallery! ✨');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Download failed. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center text-white p-6">
                <div className="flex flex-col items-center justify-center gap-6 max-w-md w-full">
                    <UrbanSetuSpinner size="xl" isBright={true} />
                    <h2 className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase bg-gradient-to-r from-indigo-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-pulse text-center">
                        Reliving {year}
                    </h2>
                </div>
            </div>
        );
    }

    const currentData = slides[currentSlide];

    // Check if the year has actual activity
    const hasData = isAdmin ? data?.hasActivity : (data?.stats?.totalInteractions > 0);

    if (!loading && (error || !hasData)) {
        const isFuture = parseInt(year) > new Date().getFullYear();
        // If the error suggests it's just not ready yet (time based), use a "Coming Soon" vibe
        const isPending = error && (error.includes("prepared") || error.includes("Not Ready"));
        const isBeforeTime = error && error.includes("member");

        return (
            <div className={`fixed inset-0 z-[1000] bg-[#0f172a] text-white flex flex-col items-center justify-center p-10 text-center font-inter`}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md"
                >
                    <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-8 mx-auto border border-white/10">
                        {isFuture || isPending ? <FaRocket className="text-4xl text-blue-400 opacity-50" /> : (isBeforeTime ? <FaCalendarAlt className="text-4xl text-orange-400 opacity-50" /> : <FaMagic className="text-4xl text-indigo-400 opacity-50" />)}
                    </div>
                    <h1 className="text-4xl font-black mb-4 tracking-tighter">
                        {isFuture ? "Mission to the Future?" : (isPending ? "Coming Soon" : (isBeforeTime ? "Before Your Time" : `Quiet Year in ${year}`))}
                    </h1>
                    <p className="text-white/60 mb-10 leading-relaxed font-medium">
                        {error || (isFuture
                            ? "The future hasn't been written yet. Start your journey today to see it here next year!"
                            : (data?.isCurrentYear
                                ? "Your journey for this year has just begun. Start exploring properties to build your flashback!"
                                : `We couldn't find any memory for ${year}. It looks like you didn't interact with UrbanSetu much during this time.`))}
                    </p>
                    <button
                        onClick={() => navigate(isAdmin ? '/admin' : '/user')}
                        className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl"
                    >
                        Back to Dashboard
                    </button>
                </motion.div>

                {/* Subtle Branding */}
                <div className="absolute bottom-10 opacity-10 font-black tracking-widest text-xs uppercase">UrbanSetu Flashback</div>
            </div>
        );
    }

    return (
        <div ref={flashbackRef} className={`fixed inset-0 z-[1000] bg-gradient-to-br ${currentData.color} text-white flex flex-col overflow-hidden transition-all duration-1000 font-inter`}>
            {/* Dynamic Background Effects */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.5, 1], x: [0, 100, 0], y: [0, 50, 0], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[20%] -left-[20%] w-[70%] h-[70%] bg-blue-500/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{ scale: [1.2, 1, 1.2], x: [0, -100, 0], y: [0, -50, 0], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-indigo-500/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], x: [0, 50, -50, 0], y: [0, -30, 30, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[90px]"
                />
            </div>

            {/* Slide Progress */}
            <div data-html2canvas-ignore="true" className="absolute top-0 left-0 right-0 p-4 flex gap-1 z-50">
                {slides.map((_, idx) => (
                    <div key={idx} className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-md">
                        <motion.div
                            className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]"
                            initial={{ width: "0%" }}
                            animate={{ width: idx < currentSlide ? "100%" : (idx === currentSlide ? "100%" : "0%") }}
                            transition={{ duration: idx === currentSlide ? 6 : 0.4, ease: "linear" }}
                            onAnimationComplete={() => { if (idx === currentSlide && !isDownloading && !isShareOpen) nextSlide(); }}
                        />
                    </div>
                ))}
            </div>

            {/* Navigation Areas */}
            <div data-html2canvas-ignore="true" className="absolute inset-0 z-40 flex pointer-events-none">
                <div className="w-[30%] h-full cursor-left-arrow pointer-events-auto" onClick={prevSlide} />
                <div className="w-[70%] h-full cursor-right-arrow pointer-events-auto" onClick={nextSlide} />
            </div>

            {/* Branding Overlay - Premium Style */}
            <div className="absolute inset-0 z-10 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                <h1 className="text-[15vw] font-black tracking-tighter uppercase whitespace-nowrap">UrbanSetu</h1>
            </div>

            {/* Header UI */}
            <div data-html2canvas-ignore="true" className="absolute top-8 right-6 left-6 z-50 flex justify-between items-center pointer-events-none">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-center">
                        <span className="font-black text-xs text-white">US</span>
                    </div>
                    <span className="font-black tracking-[0.2em] text-xs uppercase opacity-70">UrbanSetu</span>
                </div>
                <div className="flex gap-2 pointer-events-auto">
                    <button
                        onClick={downloadFlashback}
                        disabled={isDownloading}
                        className="w-11 h-11 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl backdrop-blur-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                    >
                        <FaDownload className={isDownloading ? "animate-bounce" : ""} />
                    </button>
                    <button
                        onClick={() => navigate(isAdmin ? '/admin' : '/user')}
                        className="w-11 h-11 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl backdrop-blur-xl flex items-center justify-center transition-all active:scale-95"
                    >
                        <FaTimes />
                    </button>
                </div>
            </div>

            {/* Main Slide Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-50 pointer-events-none">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentData.id}
                        initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -40, scale: 1.1, filter: "blur(15px)" }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        className="max-w-3xl w-full pointer-events-auto"
                    >
                        <motion.div
                            animate={{ y: [0, -15, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                            className="inline-block"
                        >
                            {currentData.icon}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, tracking: "0.5em" }}
                            animate={{ opacity: 1, tracking: "0.15em" }}
                            transition={{ delay: 0.3 }}
                            className="text-[10px] md:text-xs font-black uppercase text-indigo-400 mb-4 block"
                        >
                            {currentData.subtitle}
                        </motion.div>

                        <h2 className={`text-6xl md:text-8xl font-black mb-8 leading-[0.9] tracking-tighter ${currentData.highlight ? 'bg-gradient-to-br from-yellow-300 via-orange-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-lg' : 'text-white'}`}>
                            {currentData.title}
                        </h2>

                        <p className="text-xl md:text-3xl font-medium text-indigo-100/80 max-w-xl mx-auto leading-relaxed">
                            {currentData.content}
                        </p>

                        {currentData.outro && (
                            <motion.div
                                data-html2canvas-ignore="true"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2 }}
                                className="mt-12 flex flex-col items-center gap-6"
                            >
                                <button
                                    onClick={handleShare}
                                    disabled={isUploading}
                                    className="flex items-center gap-4 bg-white text-gray-900 px-10 py-5 rounded-2xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <>
                                            <UrbanSetuSpinner size="sm" />
                                            Preparing...
                                        </>
                                    ) : (
                                        <>
                                            <FaCloud className="animate-pulse" /> Cloud Share
                                        </>
                                    )}
                                </button>
                                <button onClick={() => navigate(isAdmin ? '/admin' : '/user')} className="text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors pb-4">Back to Dashboard</button>
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer / Brand Indicator */}
            <div data-html2canvas-ignore="true" className="absolute bottom-10 left-0 right-0 flex justify-center items-center flex-col gap-2 z-50">
                <p className="text-[10px] font-black tracking-widest uppercase opacity-20">Verified Story • {year}</p>
                <div className="flex gap-1.5">
                    {slides.map((_, idx) => (
                        <div key={idx} className={`h-1 rounded-full transition-all duration-500 ${idx === currentSlide ? 'bg-indigo-400 w-10' : 'bg-white/10 w-2'}`} />
                    ))}
                </div>
            </div>

            {/* Social Share Panel Overlay */}
            <SocialSharePanel
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                url={shareUrl}
                title={`My UrbanSetu Flashback ${year}`}
                description={`I explored ${data?.stats?.views} properties and my ${year} persona is "${data?.personality?.type}"! Check out your own flashback at UrbanSetu.`}
            />

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .cursor-left-arrow { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m15 18-6-6 6-6'/%3E%3C/svg%3E"), auto; }
        .cursor-right-arrow { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 18 6-6-6-6'/%3E%3C/svg%3E"), auto; }
      `}</style>
        </div>
    );
};

export default YearInReview;
