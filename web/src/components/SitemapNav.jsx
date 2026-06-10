import React from 'react';
import { Link } from 'react-router-dom';

/**
 * SitemapNav component provides hidden but crawler-accessible links to all public pages.
 * This helps search engine crawlers discover and index all parts of the website efficiently,
 * which is a recommended SEO practice for complex SPAs.
 */
const SitemapNav = () => {
    const publicLinks = [
        { name: 'Home', path: '/' },
        { name: 'About Us', path: '/about' },
        { name: 'Real Estate Blogs', path: '/blogs' },
        { name: 'Property Buying Guides', path: '/guides' },
        { name: 'Frequently Asked Questions', path: '/faqs' },
        { name: 'Property Search', path: '/search' },
        { name: 'Find Real Estate Agents', path: '/agents' },
        { name: 'Market Trends', path: '/market-trends' },
        { name: 'Neighborhood Community', path: '/community' },
        { name: 'Platform Updates', path: '/updates' },
        { name: 'Help Center', path: '/help-center' },
        { name: 'App Downloads', path: '/download' },
        { name: 'Contact Support', path: '/contact' },
        { name: 'Terms of Service', path: '/terms' },
        { name: 'Privacy Policy', path: '/privacy' },
        { name: 'Cookie Policy', path: '/cookie-policy' },
        { name: 'Community Guidelines', path: '/community-guidelines' },
        { name: 'Sign In', path: '/sign-in' },
        { name: 'Sign Up', path: '/sign-up' },
        { name: 'Forgot Password', path: '/forgot-password' },
        { name: 'Error Codes Reference', path: '/error-codes' }
    ];

    return (
        <nav
            id="sitemap-navigation"
            aria-label="Sitemap Navigation"
            className="sr-only" /* sr-only: Hidden visually but accessible to screen readers and crawlers */
            style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: '0',
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                borderWidth: '0'
            }}
        >
            <ul>
                {publicLinks.map((link) => (
                    <li key={link.path}>
                        <Link to={link.path}>{link.name}</Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default SitemapNav;
