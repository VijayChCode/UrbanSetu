import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, keywords, image, url, type = 'website', schema, noindex = false, nofollow = false }) => {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://urbansetu.vercel.app';
    const siteTitle = "UrbanSetu · India's #1 Smart Real Estate Platform | Buy, Sell & Rent";
    const fullTitle = title ? title : siteTitle;
    const defaultDescription = "UrbanSetu is India's No.1 verified real estate platform. Buy, sell, and rent properties with confidence using our Rent Lock and trust-verified listings.";
    const metaDescription = description || defaultDescription;
    const metaImage = image || `${currentOrigin}/assets/images/og-image.png`;
    const metaUrl = url || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : currentOrigin);
    const metaKeywords = keywords || "UrbanSetu, real estate platform India, buy verified property, rent verified home, smart real estate searching, rent lock India, Hyderabad property portal, Mumbai real estate, Bangalore apartments";

    const robotsValue = [
        noindex ? 'noindex' : null,
        nofollow ? 'nofollow' : null
    ].filter(Boolean).join(', ');

    return (
        <Helmet>
            {/* Standard metadata tags */}
            <title>{fullTitle}</title>
            <meta name='description' content={metaDescription} />
            <meta name='keywords' content={metaKeywords} />

            {robotsValue && <meta name="robots" content={robotsValue} />}

            {/* Open Graph / Facebook tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={metaImage} />
            <meta property="og:url" content={metaUrl} />

            {/* Twitter tags */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />

            {/* Canonical link */}
            <link rel="canonical" href={metaUrl} />

            {/* JSON-LD Structured Data */}
            {schema && (
                <script type="application/ld+json">
                    {JSON.stringify(schema)}
                </script>
            )}
        </Helmet>
    );
};

export default SEO;
