import express from 'express';
import Listing from '../models/listing.model.js';
import Blog from '../models/blog.model.js';
import HelpArticle from '../models/helpArticle.model.js';
import ForumPost from '../models/forumPost.model.js';
import Agent from '../models/agent.model.js';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const getBaseUrl = (req) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const requestedDomain = req.query.domain;
    if (host.includes('urbansetuglobal.onrender.com') || requestedDomain === 'global') {
        return 'https://urbansetuglobal.onrender.com';
    }
    return 'https://urbansetu.vercel.app';
};

// Route for the XSL stylesheet
router.get('/sitemap.xsl', (req, res) => {
    try {
        const xslPath = path.join(__dirname, '../public/sitemap.xsl');
        if (fs.existsSync(xslPath)) {
            res.header('Content-Type', 'text/xsl');
            return res.sendFile(xslPath);
        }

        // Fallback for Render or different structures
        const altPath = path.resolve('public/sitemap.xsl');
        if (fs.existsSync(altPath)) {
            res.header('Content-Type', 'text/xsl');
            return res.sendFile(altPath);
        }

        res.status(404).send('Stylesheet not found');
    } catch (error) {
        res.status(500).send('Error serving stylesheet');
    }
});

// Main Sitemap Index
router.get('/sitemap.xml', async (req, res) => {
    const baseUrl = getBaseUrl(req);
    const now = new Date().toISOString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    const sitemaps = [
        'sitemap-pages.xml',
        'sitemap-listings.xml',
        'sitemap-blogs.xml',
        'sitemap-help.xml',
        'sitemap-community.xml',
        'sitemap-agents.xml'
    ];

    sitemaps.forEach(sm => {
        xml += `
  <sitemap>
    <loc>${baseUrl}/${sm}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;
    });

    xml += '\n</sitemapindex>';
    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
});

// Pages Sitemap
router.get('/sitemap-pages.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const staticRoutes = [
        '', '/about', '/blogs', '/guides', '/market-trends', '/help-center',
        '/community', '/community-guidelines', '/download', '/faqs',
        '/search', '/contact', '/sign-in', '/sign-up', '/forgot-password',
        '/updates', '/setuai', '/terms', '/privacy', '/cookie-policy', '/agents',
        '/error-codes'
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    staticRoutes.forEach(route => {
        xml += `
  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>${route === '' ? 'daily' : 'monthly'}</changefreq>
    <priority>${route === '' ? '1.0' : '0.5'}</priority>
  </url>`;
    });

    xml += '\n</urlset>';
    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
});

// Listings Sitemap
router.get('/sitemap-listings.xml', async (req, res, next) => {
    try {
        const baseUrl = getBaseUrl(req);
        const listings = await Listing.find().select('_id updatedAt');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        listings.forEach(listing => {
            xml += `
  <url>
    <loc>${baseUrl}/listing/${listing._id}</loc>
    <lastmod>${listing.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
        });

        xml += '\n</urlset>';
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (e) { next(e); }
});

// Blogs Sitemap
router.get('/sitemap-blogs.xml', async (req, res, next) => {
    try {
        const baseUrl = getBaseUrl(req);
        const blogs = await Blog.find({ published: true }).select('slug _id type updatedAt');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        blogs.forEach(blog => {
            const slug = blog.slug || blog._id;
            xml += `
  <url>
    <loc>${baseUrl}/blog/${slug}</loc>
    <lastmod>${blog.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        });

        xml += '\n</urlset>';
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (e) { next(e); }
});

// Help Center Sitemap
router.get('/sitemap-help.xml', async (req, res, next) => {
    try {
        const baseUrl = getBaseUrl(req);
        // Find all help articles (assuming they have a field to check if published, or just fetch all if no such field exists)
        const articles = await HelpArticle.find({}).select('slug _id updatedAt');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        articles.forEach(article => {
            const slug = article.slug || article._id;
            xml += `
  <url>
    <loc>${baseUrl}/help-center/article/${slug}</loc>
    <lastmod>${article.updatedAt.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
        });

        xml += '\n</urlset>';
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (e) { next(e); }
});

// Community Forum Posts Sitemap
router.get('/sitemap-community.xml', async (req, res, next) => {
    try {
        const baseUrl = getBaseUrl(req);
        const posts = await ForumPost.find().select('_id updatedAt');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        posts.forEach(post => {
            xml += `
  <url>
    <loc>${baseUrl}/community/post/${post._id}</loc>
    <lastmod>${post.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        });

        xml += '\n</urlset>';
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (e) { next(e); }
});

// Agents Sitemap
router.get('/sitemap-agents.xml', async (req, res, next) => {
    try {
        const baseUrl = getBaseUrl(req);
        const agents = await Agent.find({ status: 'approved' }).select('_id updatedAt');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        agents.forEach(agent => {
            xml += `
  <url>
    <loc>${baseUrl}/agents/${agent._id}</loc>
    <lastmod>${agent.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
        });

        xml += '\n</urlset>';
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (e) { next(e); }
});

export default router;
