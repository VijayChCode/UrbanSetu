import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, User, ArrowRight, Video, FileText, Eye, Heart } from 'lucide-react';
import AdvancedImage from './AdvancedImage';

export default function BlogGuideItem({ item, type = 'blog' }) {
  if (!item) return null;

  // Determine if it's a blog or guide if not explicitly passed
  const itemType = type || item.type || (window.location.pathname.includes('guide') ? 'guide' : 'blog');
  const detailLink = itemType === 'guide' 
    ? `/user/guide/${item.slug || item._id}` 
    : `/blog/${item.slug || item._id}`;

  const truncateText = (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="group relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col h-full">
      <Link to={detailLink} className="block flex-grow group/link">
        {/* Media Section */}
        <div className="relative aspect-[16/10] overflow-hidden">
          {item.thumbnail || (item.imageUrls && item.imageUrls.length > 0) ? (
            <AdvancedImage
              src={item.thumbnail || item.imageUrls[0]}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/link:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center">
              {itemType === 'guide' ? (
                <BookOpen className="w-12 h-12 text-blue-400 dark:text-blue-500 opacity-50" />
              ) : (
                <FileText className="w-12 h-12 text-blue-400 dark:text-blue-500 opacity-50" />
              )}
            </div>
          )}

          {/* AI Match Overlay - Same as ListingItem */}
          {item.similarityScore && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 z-10">
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-grow bg-white/20 rounded-full overflow-hidden backdrop-blur-md">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.6)]"
                    style={{ width: `${item.similarityScore * 100}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                  Match {(item.similarityScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* Type Badge */}
          <div className="absolute top-3 left-3 z-20">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-sm flex items-center gap-1.5 
              ${itemType === 'guide' 
                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' 
                : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'}`}>
              {itemType === 'guide' ? <BookOpen size={10} /> : <FileText size={10} />}
              {itemType}
            </span>
          </div>

          {/* Video Icon Overlay */}
          {item.videoUrls && item.videoUrls.length > 0 && (
            <div className="absolute top-3 right-3 z-20 w-7 h-7 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
              <Video className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <Calendar size={10} className="text-blue-500" />
                {formatDate(item.publishedAt || item.createdAt)}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              {item.views !== undefined && (
                <span className="flex items-center gap-1"><Eye size={10} /> {item.views}</span>
              )}
              {item.likes !== undefined && (
                <span className="flex items-center gap-1"><Heart size={10} className="text-red-400" /> {item.likes}</span>
              )}
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 transition-colors">
            {item.title}
          </h3>

          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
            {truncateText(item.excerpt || item.content, 80)}
          </p>
        </div>
      </Link>

      <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-400">
          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 border border-blue-200">
            {item.author?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="truncate max-w-[60px]">{item.author?.username || 'Team'}</span>
        </div>
        
        <Link
          to={detailLink}
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-blue-600 hover:text-blue-700 transition-colors"
        >
          Read Article <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
