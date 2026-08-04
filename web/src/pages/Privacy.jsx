import React from "react";
import { usePageTitle } from '../hooks/usePageTitle';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import SEO from '../components/SEO';
export default function Privacy() {
  // Set page title
  usePageTitle("Privacy Policy - Data Protection");

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 transition-colors duration-300">
      <SEO
        title="Privacy Policy - Your Data Security | UrbanSetu"
        description="Learn how UrbanSetu collects, uses, and protects your personal data. We are committed to transparency and security in your real estate journey."
        keywords="UrbanSetu privacy policy, real estate data protection, property search privacy"
      />
      <h1 className="text-4xl font-bold mb-6 text-blue-700 dark:text-blue-400 transition-colors">Privacy Policy</h1>
      <div className="space-y-6 text-gray-800 dark:text-gray-300 text-base transition-colors">
        <p className="text-lg">Your privacy is important to us. This policy explains how we collect, use, and protect your information as a user or admin of our UrbanSetu real estate platform.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">1. Information We Collect</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Account Information:</strong> Name, email, validated mobile number (unique 10 digits), role selection (user/admin), profile picture, and authentication credentials.</li>
          <li><strong>Property Data:</strong> Property listings, images, descriptions, pricing, location details, property specifications, and availability status.</li>
          <li><strong>Transaction Data:</strong> Appointments, bookings, communications, payment information, and transaction history.</li>
          <li><strong>Platform Usage:</strong> Search queries, watchlist items, wishlist preferences, browsing behavior, and interaction patterns.</li>
          <li><strong>Communication Data:</strong> Messages, reviews, ratings, support tickets, and feedback.</li>
          <li><strong>Technical Data:</strong> IP address, browser type, device information, location data, and usage analytics.</li>
          <li><strong>Security Data:</strong> Login attempts, security events, OTP verification, and fraud prevention data.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">2. How We Use Your Information</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Service Provision:</strong> To provide, maintain, and improve our real estate platform services.</li>
          <li><strong>User Experience:</strong> To personalize content, provide smart search results, and recommend relevant properties.</li>
          <li><strong>Communication:</strong> To send notifications about price changes, new listings, appointments, and platform updates.</li>
          <li><strong>Security:</strong> To prevent fraud, detect suspicious activities, and protect user accounts.</li>
          <li><strong>Analytics:</strong> To understand user behavior, improve platform performance, and develop new features.</li>
          <li><strong>Compliance:</strong> To comply with legal obligations and enforce platform terms.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">3. Smart Features & AI Integration</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Natural Language Processing:</strong> We use AI to process search queries and provide intelligent property recommendations.</li>
          <li><strong>Price Monitoring:</strong> We track property prices in your watchlist and notify you of changes.</li>
          <li><strong>Smart Notifications:</strong> AI-powered alerts for price drops, new listings matching your preferences, and market insights.</li>
          <li><strong>Fraud Detection:</strong> Automated systems to detect and prevent fraudulent activities and suspicious listings.</li>
          <li><strong>Content Moderation:</strong> AI-assisted review of listings, images, and user-generated content for quality and compliance.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">4. Data Sharing & Third Parties</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>No Sale Policy:</strong> We do not sell your personal information to third parties.</li>
          <li><strong>Service Providers:</strong> We may share data with trusted partners for payment processing, email services, and analytics.</li>
          <li><strong>Legal Requirements:</strong> We may disclose information when required by law or to protect our rights and users.</li>
          <li><strong>Business Transfers:</strong> In case of merger or acquisition, user data may be transferred as part of business assets.</li>
          <li><strong>Public Information:</strong> Property listings and reviews may be publicly visible as part of the platform's core functionality.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">5. Your Rights & Control</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Access:</strong> You can view and download your personal data through your account settings.</li>
          <li><strong>Correction:</strong> You can update your profile information, preferences, and account settings at any time.</li>
          <li><strong>Deletion:</strong> You can delete your account, which will remove your personal data (except where retention is legally required).</li>
          <li><strong>Portability:</strong> You can export your data in a machine-readable format.</li>
          <li><strong>Opt-out:</strong> You can unsubscribe from marketing communications while maintaining essential service notifications.</li>
          <li><strong>Consent Withdrawal:</strong> You can withdraw consent for data processing where applicable.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">6. Data Security & Protection</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Encryption:</strong> All data is encrypted in transit and at rest using industry-standard protocols.</li>
          <li><strong>Access Controls:</strong> Strict access controls and authentication mechanisms protect your data.</li>
          <li><strong>Regular Audits:</strong> We conduct regular security assessments and vulnerability testing.</li>
          <li><strong>Incident Response:</strong> We have procedures in place to respond to and notify users of any data breaches.</li>
          <li><strong>Staff Training:</strong> Our team is trained on data protection and privacy best practices.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">7. Data Retention</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Account Data:</strong> Retained while your account is active and for a reasonable period after deletion.</li>
          <li><strong>Transaction Records:</strong> Kept for legal and accounting purposes as required by law.</li>
          <li><strong>Communication Data:</strong> Retained for customer service and dispute resolution purposes.</li>
          <li><strong>Analytics Data:</strong> Aggregated and anonymized data may be retained for business insights.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">8. International Data Transfers</h2>
        <p className="ml-6">Your data may be processed and stored in servers located outside your country. We ensure appropriate safeguards are in place to protect your data in accordance with applicable privacy laws.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">9. Children's Privacy</h2>
        <p className="ml-6">Our platform is not intended for users under 18 years of age. We do not knowingly collect personal information from children.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">10. Real Estate Transaction & Document Data</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Transaction Records:</strong> We store records of property inquiries, offers, negotiations, appointments, and completed transactions.</li>
          <li><strong>Legal Documents:</strong> Copies of sale/rent agreements, KYC documents, ownership proofs, and supporting documents may be stored as required by law.</li>
          <li><strong>Verification Data:</strong> PAN, Aadhaar or other ID details (where applicable) may be processed via secure providers for KYC and anti‑fraud checks.</li>
          <li><strong>Document Retention:</strong> Real estate transaction documents may be retained for extended periods to comply with tax, audit, and property law requirements.</li>
          <li><strong>Access Controls:</strong> Access to legal and property documents is restricted to authorized personnel and relevant parties only.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">11. Payments, Wallets & Escrow Data</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Payment Details:</strong> We process limited payment information (transaction IDs, masked card or UPI details) via PCI‑DSS compliant payment gateways.</li>
          <li><strong>Escrow & Deposits:</strong> Booking amounts, deposits, and rent locks may be held in escrow accounts with detailed transaction logs.</li>
          <li><strong>Refund Information:</strong> Refunds, chargebacks, and settlement information are recorded for compliance and dispute resolution.</li>
          <li><strong>Wallet/Balance Data:</strong> Any in‑platform wallets or rent wallets store balance, ledger, and withdrawal history.</li>
          <li><strong>No Card Storage:</strong> We do not store full card numbers, CVV, or sensitive authentication data on our servers.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">12. Legal Basis & Regulatory Compliance</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Contractual Necessity:</strong> We process data to perform our obligations under user agreements, bookings, and property transactions.</li>
          <li><strong>Legitimate Interest:</strong> We use data to prevent fraud, improve services, and secure the platform while respecting your rights.</li>
          <li><strong>Consent:</strong> For marketing, advanced analytics, and certain cookies, we rely on your explicit consent.</li>
          <li><strong>Compliance with Laws:</strong> We process and retain data as required by real estate, tax, anti‑money‑laundering, and data‑protection laws (including RERA and applicable data privacy laws).</li>
          <li><strong>International Transfers:</strong> When data is transferred outside your country, we implement appropriate safeguards such as contractual clauses and vetted vendors.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">13. Changes to This Policy</h2>
        <p className="ml-6">We may update this privacy policy from time to time. We will notify you of significant changes through email or platform notifications. Continued use of the platform constitutes acceptance of the updated policy.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">14. Call, Chat, Messaging & Media Data Privacy</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>End-to-End & In-Transit Encryption:</strong> All real-time messages, audio/video call streams, and socket communications are transmitted over secure, end-to-end encrypted transport protocols (TLS/WSS).</li>
          <li><strong>Private Attachment Storage:</strong> Shared chat media (photos up to 10MB, videos up to 100MB, documents up to 10MB, and voice notes up to 10MB) are stored in access-controlled cloud storage, accessible only by conversation participants.</li>
          <li><strong>Chat Lock & Dispute Preservation:</strong> During active dispute resolution, chat threads may be locked by admins to preserve evidentiary records. Locked logs remain confidential and restricted to compliance personnel.</li>
          <li><strong>Transcript & PDF Exports:</strong> Chat export features generate encrypted PDF transcripts containing timestamped message histories for your personal records.</li>
          <li><strong>Redaction & Privacy Access:</strong> Sensitive information (such as bank details or ID numbers) shared in chats is automatically redacted in administrative views. Access is strictly limited to conversation participants and authorized compliance teams.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">15. Cookies & Tracking</h2>
        <p className="ml-6">See our full Cookie Policy for details on how we use analytics, advertising, and functional cookies to improve your experience.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">16. AI Content Moderation & Safety</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Automated Review:</strong> We use AI (via providers like Groq and Gemini) to monitor chats, search queries, and listings for policy violations, hate speech, and fraudulent content.</li>
          <li><strong>Data Processing:</strong> When you send a message or create a listing, the content is analyzed by AI models to ensure platform safety. This processing is transient but records of violations are kept for enforcement.</li>
          <li><strong>Admin Oversight:</strong> Flagged content is reviewed by admins to prevent false positives and maintain a high-quality community.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">17. Loyalty Program & Referral Data</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Referral Tracking:</strong> To credit rewards, we track successful sign-ups via unique referral links. We store the relationship between the referrer and the new joiner.</li>
          <li><strong>SetuCoin Economy:</strong> Your coin balance, earning history (referrals, bookings, bonuses), and redemption logs (discounts, partner rewards) are stored securely.</li>
          <li><strong>Verification:</strong> We may use account age, activity levels, and IP logs to prevent referral fraud or gaming of the rewards system.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">18. On-Demand Services & Mover Verification</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Service Logs:</strong> For cleaning, electricians, or movers, we store addresses, preferred dates, and service-specific notes to coordinate with vendors.</li>
          <li><strong>Condition Records:</strong> Move-in/move-out checklists with images and videos are stored to resolve property damage disputes between tenants and landlords.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">19. Partner Agent Data Handling</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Data Sharing:</strong> When you initiate contact with a Partner Agent (e.g., "Request Call Back", "Book Appointment"), we share your necessary contact details and property interests with that specific agent.</li>
          <li><strong>Agent Access:</strong> Verified agents have access to limited insights about your property preferences to provide better service. This access is governed by strict data usage agreements.</li>
          <li><strong>Purpose Limitation:</strong> Agents are contractually obligated to use your personal data solely for real estate transaction facilitation and not for unauthorized marketing.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">20. Help Center & Support Data</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Ticket Data:</strong> Information you submit via support tickets (descriptions, screenshots, logs) is stored securely to resolve your issues and track support history.</li>
          <li><strong>AI Interactions:</strong> Conversations with our AI support bot are processed to provide real-time answers. These logs are anonymized and used to improve AI accuracy and service quality.</li>
          <li><strong>Quality Assurance:</strong> Human support staff may review ticket and chat history to ensure service quality and compliance with our policies.</li>
        </ul>

        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2 transition-colors">Contact Us</h3>
          <p className="text-gray-700 dark:text-gray-300 transition-colors">If you have any questions about this privacy policy or our data practices, please contact us:</p>
          <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300 transition-colors">
            <li>📧 Email: auth.urbansetu@gmail.com</li>
            <li>📞 Phone: +1 (555) 123-4567</li>
            <li>🏢 Address: UrbanSetu Privacy Team, Real Estate Platform</li>
          </ul>
        </div>

        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 transition-colors">Related Policies</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-3 transition-colors">For information about how we use cookies and similar technologies, please review our:</p>
          <a
            href="/cookie-policy"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors font-medium"
          >
            🍪 Cookie Policy
          </a>
        </div>

        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400 transition-colors">Last updated: {new Date().toLocaleDateString(`en-IN`, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</p>
      </div>
      <ContactSupportWrapper />
    </div>
  );
} 