import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaShieldAlt, FaHandshake, FaComments, FaPhone, FaHome,
    FaStar, FaUserShield, FaExclamationTriangle, FaCheckCircle,
    FaChevronDown, FaChevronUp, FaVideo, FaFileAlt, FaUsers,
    FaGavel, FaEye, FaBullhorn, FaLock, FaHeart, FaArrowRight, FaEnvelope,
    FaMicrophone, FaCamera, FaEdit, FaTrashAlt, FaDownload, FaFingerprint
} from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import SEO from '../components/SEO';

export default function CommunityGuidelines() {
    usePageTitle("Community Guidelines - UrbanSetu");
    const [expandedSection, setExpandedSection] = useState(null);

    const guidelines = [
        {
            id: 'respect',
            icon: <FaHeart className="text-3xl text-red-500" />,
            title: "Respectful Communication",
            color: "red",
            rules: [
                "Treat all users with respect and courtesy in chats, calls, and reviews",
                "Use professional and appropriate language at all times",
                "No harassment, bullying, discrimination, or hate speech",
                "Respect privacy - don't share personal information without consent",
                "Be patient and understanding during property viewings and negotiations"
            ]
        },
        {
            id: 'listings',
            icon: <FaHome className="text-3xl text-blue-500" />,
            title: "Honest Property Listings",
            color: "blue",
            rules: [
                "Provide accurate and truthful property information",
                "Use real, recent photos of the property - no misleading images",
                "Clearly state all features, amenities, and any issues/defects",
                "Set fair and realistic prices - no price manipulation",
                "Update listings promptly when property status changes",
                "Only list properties you have legal authority to rent/sell",
                "Include accurate ESG (Environmental, Social, Governance) data"
            ]
        },
        {
            id: 'calls',
            icon: <FaVideo className="text-3xl text-purple-500" />,
            title: "Audio & Video Call Conduct",
            color: "purple",
            rules: [
                "Be punctual - join scheduled calls on time",
                "Ensure proper lighting and audio quality for video calls",
                "Dress appropriately and maintain professional appearance",
                "Stay focused - no multitasking or distractions during calls",
                "Use mute when not speaking to reduce background noise",
                "No recording of calls without explicit consent from all parties",
                "Calls may be monitored by admins for quality and safety",
                "Report any inappropriate behavior immediately"
            ]
        },
        {
            id: 'chat',
            icon: <FaComments className="text-3xl text-green-500" />,
            title: "Chat & Messaging Policies",
            color: "green",
            rules: [
                "💬 Messaging Conduct: Keep all conversations relevant to property transactions, inquiries, and appointments",
                "No spam, promotional content, unsolicited advertising, or flooding of messages",
                "Don't share external links to competing platforms or suspicious URLs",
                "Use professional and appropriate language — no hate speech, threats, or harassment",
                "Respect response times — allow reasonable time for replies before following up",
                "📎 File Sharing: Only share property-related files — Photos (JPG, PNG, GIF, WebP ≤ 10MB), Videos (MP4, WebM, MOV, MKV ≤ 100MB), Documents (PDF, DOCX, XLSX, TXT ≤ 10MB), Audio (MP3, WAV, M4A ≤ 10MB)",
                "No sharing of inappropriate, offensive, illegal, or copyrighted content as attachments",
                "Add meaningful captions to shared media — describe property details, room names, or context",
                "📸 Camera Capture: Direct photo capture from your device is available — use it only for property-related photos",
                "Do not capture or share photos of people without their explicit consent",
                "🎤 Audio Messages: Keep voice messages concise, relevant, and professional",
                "No offensive, threatening, or inappropriate audio content — all audio is subject to moderation",
                "Audio messages support pause/resume recording — review before sending",
                "✏️ Message Editing: Edited messages are visibly marked as 'edited' — don't misuse editing to alter the context of conversations",
                "🗑️ Message Deletion: Deleted messages are logged — do not abuse deletion to hide inappropriate behavior or evidence",
                "⭐ Starred Messages: Use the star feature to bookmark important property information, pricing, or appointment details",
                "😀 Reactions & Emojis: Use message reactions and emojis appropriately — no spamming reactions on every message",
                "📥 Chat Export: Chat transcripts can be exported as PDF — these are for your personal records and should not be shared publicly without consent from all parties",
                "📌 @Mentions: Use @mentions to reference properties, blogs, and guides — do not abuse mentions for spamming",
                "⌨️ Keyboard Shortcuts: Press Ctrl + / to focus chat input, Esc to close chatbox — use these for efficiency"
            ]
        },
        {
            id: 'appointments',
            icon: <FaHandshake className="text-3xl text-orange-500" />,
            title: "Appointments & Bookings",
            color: "orange",
            rules: [
                "Honor confirmed appointments - be on time",
                "Provide at least 24 hours notice for cancellations",
                "Respect the scheduled time - don't overstay property viewings",
                "Follow safety protocols during in-person visits",
                "Update appointment status promptly (completed, cancelled, etc.)",
                "No-show limit: 3 missed appointments may result in restrictions"
            ]
        },
        {
            id: 'reviews',
            icon: <FaStar className="text-3xl text-yellow-500" />,
            title: "Reviews & Ratings",
            color: "yellow",
            rules: [
                "Provide honest, constructive feedback based on actual experience",
                "Focus on property features and transaction experience",
                "No fake reviews or review manipulation",
                "No offensive language or personal attacks in reviews",
                "Reviews are public - write as you'd want to be reviewed",
                "Cannot delete reviews once posted - edit only for corrections",
                "Admins may remove reviews that violate guidelines"
            ]
        },
        {
            id: 'prohibited',
            icon: <FaExclamationTriangle className="text-3xl text-red-600" />,
            title: "Prohibited Activities",
            color: "red",
            rules: [
                "🚫 Fraud, scams, or any deceptive practices",
                "🚫 Impersonation of other users, admins, or entities",
                "🚫 Sharing illegal, adult, or harmful content",
                "🚫 Attempting to bypass or manipulate platform features",
                "🚫 Using bots, scripts, or automation tools",
                "🚫 Property squatting or fraudulent ownership claims",
                "🚫 Money laundering or illegal financial transactions",
                "🚫 Discriminatory practices in property access",
                "🚫 Harassment or stalking other users",
                "🚫 Sharing login credentials or account access"
            ]
        },
        {
            id: 'securechat',
            icon: <FaFingerprint className="text-3xl text-cyan-500" />,
            title: "Secure Chat & Data Protection",
            color: "cyan",
            rules: [
                "🔒 Chat Security: All messages are transmitted over secure, encrypted connections to protect your conversations",
                "Real-time messaging is powered by secure socket connections — your messages are delivered instantly and safely",
                "🛡️ Content Moderation: All shared content (text, images, videos, audio, documents) is subject to platform content filtering and moderation",
                "Automated systems scan for inappropriate, harmful, or illegal content — violations are flagged and acted upon",
                "🔐 Chat Lock: Admins may lock a chat conversation during active dispute resolution — locked chats are preserved as evidence",
                "Do not attempt to bypass chat locks or create alternative channels to circumvent dispute processes",
                "Cooperate fully with admin investigations when a chat is locked for review",
                "🚨 Reporting: Use the 'Report' button to flag inappropriate messages, content, or user behavior",
                "Report entire chat conversations if you experience persistent harassment or policy violations",
                "All reports are reviewed confidentially — reporter identity is always protected",
                "🚫 User Blocking: You can block users who violate guidelines — blocked users cannot send you messages or initiate calls",
                "Blocking is reversible but should be used responsibly and not as a tool for manipulation",
                "📞 Call History: Audio and video call records are private — call history cannot be shared publicly",
                "Calls may be monitored by admins for quality assurance, safety, and dispute resolution",
                "📊 Data Retention: Chat data is retained as per our privacy policy — you can request data export or deletion through settings",
                "Exported chat PDFs and media files are your responsibility once downloaded — handle with care",
                "👁️ Admin Oversight: Platform admins reserve the right to review chat conversations for safety, compliance, and dispute resolution purposes",
                "Admin actions on chats (lock, unlock, content removal) are documented and notified to all parties via email"
            ]
        },
        {
            id: 'content',
            icon: <FaFileAlt className="text-3xl text-indigo-500" />,
            title: "Content & Privacy Policy",
            color: "indigo",
            rules: [
                "Respect intellectual property - only upload content you own or have rights to",
                "Property photos should not include identifiable faces without consent",
                "Personal data (phone numbers, emails) automatically protected by platform",
                "Don't screenshot or share private conversations publicly",
                "Virtual tour images must accurately represent the property",
                "AI-generated content must be clearly labeled as such",
                "Report copyright violations immediately"
            ]
        },
        {
            id: 'admin',
            icon: <FaUserShield className="text-3xl text-blue-600" />,
            title: "Admin Monitoring & Rights",
            color: "blue",
            rules: [
                "Admins may monitor calls and chats for quality assurance and safety",
                "Admins can terminate calls that violate community guidelines",
                "You'll receive email notifications for admin actions",
                "Admins may request additional verification for suspicious activity",
                "Admin decisions are final but can be appealed through support",
                "Cooperation with admin investigations is mandatory",
                "False reports to admins may result in account penalties"
            ]
        },
        {
            id: 'consequences',
            icon: <FaGavel className="text-3xl text-gray-700 dark:text-gray-400" />,
            title: "Consequences of Violations",
            color: "gray",
            rules: [
                "⚠️ First Violation: Warning and temporary restrictions",
                "⚠️ Second Violation: 7-day suspension and feature restrictions",
                "⚠️ Third Violation: 30-day suspension or permanent ban",
                "⚠️ Severe Violations: Immediate permanent ban",
                "📉 SetuCoins penalties for guideline violations",
                "🚫 Listing removal for fraudulent properties",
                "⛔ Account termination for illegal activities",
                "📧 All violations documented and emailed to user",
                "Legal action may be pursued for serious violations"
            ]
        },
        {
            id: 'reporting',
            icon: <FaBullhorn className="text-3xl text-pink-500" />,
            title: "Reporting & Support",
            color: "pink",
            rules: [
                "Report violations through the 'Report' button in chats, calls, or listings",
                "Provide detailed information about the violation",
                "Include screenshots or evidence when possible",
                "Reports are confidential - reporter identity is protected",
                "Response time: 24-48 hours for most reports",
                "Emergency issues: Contact support immediately",
                "False reports may result in account penalties",
                "Thank you for helping keep UrbanSetu safe! 🙏"
            ]
        },
        {
            id: 'features',
            icon: <FaCheckCircle className="text-3xl text-teal-500" />,
            title: "Platform Features Guidelines",
            color: "teal",
            rules: [
                "🎮 SetuCoins: Use fairly - no exploitation of gamification system",
                "🤖 AI Chatbot: Use for property queries only - no abuse",
                "🔄 Property Comparison: Compare fairly based on actual features",
                "📊 Year in Review: Data is auto-generated and accurate",
                "❤️ Wishlist: Keep updated - remove sold/unavailable properties",
                "👀 Watchlist: Price alerts are for personal use only",
                "📞 Call History: Private and cannot be shared publicly",
                "🎥 360° Virtual Tours: Must represent actual property condition",
                "📝 ESG Data: Must be verified and truthful"
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            <SEO
                title="Community Guidelines - Our Standard of Conduct | UrbanSetu"
                description="Read UrbanSetu's community guidelines to understand our standards for respectful communication, honest listings, and platform safety."
                keywords="UrbanSetu community guidelines, real estate conduct, platform safety rules"
            />
            {/* Background Gradient */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 dark:opacity-10"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 dark:opacity-10"></div>
                <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-400 dark:bg-pink-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 dark:opacity-10"></div>
            </div>

            <div className="max-w-5xl mx-auto relative z-10">
                {/* Header */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 mb-8 text-center transition-colors">
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <FaShieldAlt className="text-5xl text-blue-600 dark:text-blue-400" />
                        <h1 className="text-4xl md:text-5xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow">
                            Community Guidelines
                        </h1>
                    </div>
                    <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                        Welcome to UrbanSetu! Our community guidelines ensure a safe, respectful, and trustworthy environment for all users. By using our platform, you agree to follow these guidelines.
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                        <FaEye className="text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">
                            Last Updated: August 2026
                        </span>
                    </div>
                </div>

                {/* Introduction */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8 transition-colors">
                    <div className="flex items-start gap-4">
                        <FaLock className="text-3xl text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                        <div>
                            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-2">
                                Your Safety is Our Priority
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                UrbanSetu is committed to providing a secure environment for property seekers, sellers, and agents. These guidelines help maintain the integrity of our platform and protect all users. Violations may result in warnings, suspensions, or permanent bans.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Guidelines Sections */}
                <div className="space-y-4">
                    {guidelines.map((section, index) => (
                        <div
                            key={section.id}
                            className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-blue-900/10 overflow-hidden transition-all duration-300 hover:shadow-lg"
                        >
                            <button
                                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                                className={`w-full p-6 flex items-center justify-between text-left bg-gradient-to-r from-gray-50 to-${section.color}-50 dark:from-gray-800 dark:to-${section.color}-900/20 hover:from-${section.color}-50 dark:hover:from-${section.color}-900/30 transition-all duration-200`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md`}>
                                        {section.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                                            {section.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {section.rules.length} guidelines
                                        </p>
                                    </div>
                                </div>
                                <motion.div
                                    animate={{ rotate: expandedSection === section.id ? 180 : 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <FaChevronDown className="text-2xl text-gray-600 dark:text-gray-400" />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {expandedSection === section.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors">
                                            <ul className="space-y-3">
                                                {section.rules.map((rule, ruleIndex) => (
                                                    <li key={ruleIndex} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
                                                        <FaCheckCircle className={`text-${section.color}-500 mt-1 flex-shrink-0`} />
                                                        <span className="leading-relaxed">{rule}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>

                {/* Footer CTA */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 rounded-xl shadow-xl p-8 mt-8 text-center text-white transition-colors">
                    <FaUsers className="text-5xl mx-auto mb-4 opacity-90" />
                    <h2 className="text-3xl font-bold mb-4">Together We Build Trust</h2>
                    <p className="text-lg opacity-90 max-w-2xl mx-auto">
                        By following these guidelines, you help create a safe and positive experience for everyone in the UrbanSetu community. Thank you for being a responsible member!
                    </p>
                </div>

                {/* Guidelines Contact Block */}
                <div className="mt-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-900/50 dark:to-blue-950/20 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-blue-100/50 dark:border-gray-800 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.005]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                            <div className="p-3.5 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400 shadow-inner">
                                <FaShieldAlt className="text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Guideline Questions & Moderation Appeals</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
                                    Have questions about our community guidelines, need to report a policy violation, or want to appeal a moderation decision? Contact our team.
                                </p>
                            </div>
                        </div>
                        <a 
                            href="mailto:urbansetu.noreply@gmail.com"
                            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white dark:bg-gray-850 text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-gray-700/60 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-200 shadow-sm hover:shadow transition-all duration-200 group whitespace-nowrap text-sm"
                        >
                            <span>urbansetu.noreply@gmail.com</span>
                            <FaArrowRight className="text-xs group-hover:translate-x-1 transition-transform" />
                        </a>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-blue-900/10 p-6 mt-8 transition-colors">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                        Related Resources
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <a href="/privacy" className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:shadow-md transition-all text-center group">
                            <FaLock className="text-2xl text-blue-600 dark:text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-gray-700 dark:text-gray-300 font-medium">Privacy Policy</span>
                        </a>
                        <a href="/terms" className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:shadow-md transition-all text-center group">
                            <FaFileAlt className="text-2xl text-purple-600 dark:text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-gray-700 dark:text-gray-300 font-medium">Terms & Conditions</span>
                        </a>
                        <a href="/about" className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:shadow-md transition-all text-center group">
                            <FaHeart className="text-2xl text-red-600 dark:text-red-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-gray-700 dark:text-gray-300 font-medium">About UrbanSetu</span>
                        </a>
                    </div>
                </div>
            </div>
            <ContactSupportWrapper />
        </div>
    );
}
