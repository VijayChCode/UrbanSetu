import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const resolveMentionHref = (listingId) => {
    const isAdmin = window.location.pathname.includes('/admin');
    if (listingId.startsWith('blog:')) {
        const id = listingId.split(':')[1];
        return isAdmin ? `/admin/blog/${id}` : `/user/blog/${id}`;
    }
    if (listingId.startsWith('guide:')) {
        const id = listingId.split(':')[1];
        return isAdmin ? `/admin/guide/${id}` : `/user/guide/${id}`;
    }
    if (listingId.startsWith('listing:') || listingId.startsWith('prop:')) {
        const id = listingId.split(':')[1];
        return isAdmin ? `/admin/listing/${id}` : `/user/listing/${id}`;
    }
    return isAdmin ? `/admin/listing/${listingId}` : `/user/listing/${listingId}`;
};

const withMentions = (content) =>
    content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (_, name, id) => `[@${name}](${resolveMentionHref(id)})`);

export default function CommunityMarkdown({ content, variant = 'post', className = '' }) {
    if (!content) return null;

    const sizeClass = variant === 'comment' ? 'prose-sm' : 'prose-sm sm:prose-base';

    return (
        <div
            className={`prose ${sizeClass} prose-blue dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-2
                prose-li:text-gray-600 dark:prose-li:text-gray-300 prose-li:my-0.5
                prose-ul:my-2 prose-ol:my-2
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:font-medium hover:prose-a:underline
                prose-blockquote:border-blue-200 dark:prose-blockquote:border-blue-800
                prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-300
                last:prose-p:mb-0 ${className}`}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => {
                        const isInternal = href?.startsWith('/');
                        return (
                            <a
                                href={href}
                                target={isInternal ? '_self' : '_blank'}
                                rel={isInternal ? undefined : 'noopener noreferrer'}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {children}
                            </a>
                        );
                    }
                }}
            >
                {withMentions(content)}
            </ReactMarkdown>
        </div>
    );
}
