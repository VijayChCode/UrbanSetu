import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import VideoPreview from '../components/VideoPreview';
import { FaPlay, FaExclamationTriangle, FaClock, FaArrowLeft, FaShieldAlt } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const VideoEmbed = () => {
    const { token } = useParams();
    const { currentUser } = useSelector((state) => state.user);
    const [videoUrl, setVideoUrl] = useState(null);
    const [title, setTitle] = useState('UrbanSetu Video');
    const [listingId, setListingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [errorType, setErrorType] = useState(null); // 'notfound' | 'expired' | 'error'
    const [playerOpen, setPlayerOpen] = useState(false);

    useEffect(() => {
        const resolveVideo = async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await fetch(`${API_BASE_URL}/api/video/resolve/${token}`);
                const data = await res.json();

                if (!res.ok) {
                    if (res.status === 410) {
                        setErrorType('expired');
                        setError(data.message || 'This video link has expired');
                    } else if (res.status === 404) {
                        setErrorType('notfound');
                        setError(data.message || 'Video not found');
                    } else {
                        setErrorType('error');
                        setError(data.message || 'Failed to load video');
                    }
                    return;
                }

                setVideoUrl(data.videoUrl);
                setTitle(data.title || 'UrbanSetu Video');
                setListingId(data.listingId);

                // Auto-open the player
                setPlayerOpen(true);
            } catch (err) {
                console.error('Failed to resolve video:', err);
                setErrorType('error');
                setError('Network error. Please check your connection.');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            resolveVideo();
        }
    }, [token]);

    // Update page title
    useEffect(() => {
        document.title = title ? `${title} — UrbanSetu` : 'Video — UrbanSetu';
    }, [title]);

    // Loading state
    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
                <div className="flex flex-col items-center gap-6 animate-pulse">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-white/10 flex items-center justify-center">
                            <FaPlay className="text-white text-3xl ml-1.5 opacity-60" />
                        </div>
                        <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-t-blue-500 animate-spin" />
                    </div>
                    <div className="space-y-2 text-center">
                        <p className="text-white/80 font-bold text-lg tracking-wide">Loading Video</p>
                        <p className="text-white/30 text-xs font-mono tracking-widest uppercase">UrbanSetu Player</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center z-[9999]">
                <div className="max-w-md w-full mx-4 text-center">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${errorType === 'expired'
                        ? 'bg-amber-500/10 border-2 border-amber-500/20'
                        : errorType === 'notfound'
                            ? 'bg-red-500/10 border-2 border-red-500/20'
                            : 'bg-gray-500/10 border-2 border-gray-500/20'
                        }`}>
                        {errorType === 'expired' ? (
                            <FaClock className="text-amber-400 text-3xl" />
                        ) : errorType === 'notfound' ? (
                            <FaShieldAlt className="text-red-400 text-3xl" />
                        ) : (
                            <FaExclamationTriangle className="text-gray-400 text-3xl" />
                        )}
                    </div>

                    <h1 className="text-2xl font-black text-white mb-3 tracking-tight">
                        {errorType === 'expired' ? 'Link Expired' : errorType === 'notfound' ? 'Video Not Found' : 'Something Went Wrong'}
                    </h1>

                    <p className="text-gray-400 mb-8 leading-relaxed">
                        {error}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to={!currentUser ? "/" : (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin" : "/user"}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105"
                        >
                            <FaArrowLeft className="text-xs" />
                            Go to UrbanSetu
                        </Link>
                    </div>

                    <p className="mt-10 text-gray-600 text-[10px] font-bold tracking-widest uppercase">
                        UrbanSetu Native Player v2.5
                    </p>
                </div>
            </div>
        );
    }

    // Player view
    return (
        <>
            {/* If player is closed, show a re-open button */}
            {!playerOpen && videoUrl && (
                <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center z-[9999]">
                    <div className="text-center">
                        <button
                            onClick={() => setPlayerOpen(true)}
                            className="group relative w-28 h-28 mx-auto mb-6 rounded-full bg-white/5 border-2 border-white/10 hover:border-blue-500/50 flex items-center justify-center transition-all duration-300 hover:scale-110"
                        >
                            <div className="absolute inset-0 rounded-full bg-blue-500/20 scale-0 group-hover:scale-100 transition-transform duration-500" />
                            <FaPlay className="text-white text-4xl ml-2 relative z-10 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                        <p className="text-gray-500 text-sm mb-6">Tap to play</p>

                        {listingId && (
                            <Link
                                to={`/listing/${listingId}`}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                            >
                                View Property Details →
                            </Link>
                        )}

                        <div className={`${listingId ? 'mt-4' : ''}`}>
                            <Link
                                to={!currentUser ? "/" : (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? "/admin" : "/user"}
                                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105"
                            >
                                <FaArrowLeft className="text-xs" />
                                Go to UrbanSetu
                            </Link>
                        </div>

                        <p className="mt-10 text-gray-600 text-[10px] font-bold tracking-widest uppercase">
                            UrbanSetu Native Player v2.5
                        </p>
                    </div>
                </div>
            )}

            {/* The actual VideoPreview player */}
            {videoUrl && (
                <VideoPreview
                    isOpen={playerOpen}
                    onClose={() => setPlayerOpen(false)}
                    videos={[videoUrl]}
                    initialIndex={0}
                    listingId={listingId}
                />
            )}
        </>
    );
};

export default VideoEmbed;
