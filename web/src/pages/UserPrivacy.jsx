import React from "react";


import { usePageTitle } from '../hooks/usePageTitle';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
export default function UserPrivacy() {
  // Set page title
  usePageTitle("User Privacy Policy - Data Protection");

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 transition-colors duration-300">
      <h1 className="text-4xl font-bold mb-6 text-blue-700 dark:text-blue-400 transition-colors">User Privacy Policy</h1>
      <div className="space-y-6 text-gray-800 dark:text-gray-300 text-base transition-colors">
        <p className="text-lg">Your privacy is important to us. This policy explains how we collect, use, and protect your information as a user of UrbanSetu.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">1. Information We Collect</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Account Information:</strong> Name, email, validated mobile number (unique 10 digits), role (user), profile picture, and authentication credentials.</li>
          <li><strong>Property Data:</strong> Listings you create, save, watch, or interact with; images and descriptions you upload.</li>
          <li><strong>Activity Data:</strong> Search queries, wishlist and watchlist items, appointments, messages, and reviews.</li>
          <li><strong>Technical Data:</strong> IP address, device and browser details, and usage analytics.</li>
          <li><strong>Security Data:</strong> Login attempts, OTP verification, and fraud prevention signals.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">2. How We Use Your Information</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Provide Services:</strong> Enable listings, search, watchlist, wishlist, and appointments.</li>
          <li><strong>Personalize Experience:</strong> Smart search, recommendations, and relevant suggestions.</li>
          <li><strong>Notify:</strong> Price-drop alerts, property updates, booking confirmations.</li>
          <li><strong>Protect:</strong> Security monitoring, fraud detection, and abuse prevention.</li>
          <li><strong>Improve:</strong> Analytics for product improvements and feature development.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">3. Your Rights</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Access & Correction:</strong> View and update your profile data.</li>
          <li><strong>Deletion:</strong> Delete your account to remove personal data (subject to legal retention).</li>
          <li><strong>Opt-out:</strong> Unsubscribe from marketing while keeping essential notifications.</li>
          <li><strong>Consent:</strong> Withdraw consent for processing where applicable.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">4. Sharing & Third Parties</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>No Sale:</strong> We do not sell personal information.</li>
          <li><strong>Service Providers:</strong> Payments, email and analytics providers under strict agreements.</li>
          <li><strong>Legal:</strong> Disclosures required by law or to protect rights and users.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">5. Security</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li>Encryption in transit, access controls, regular audits, and incident response.</li>
          <li>Despite safeguards, no system is perfect—use the platform responsibly.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">6. Real Estate & Transaction Data</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Bookings, Chat & Calls:</strong> We store details of your appointments, end-to-end encrypted chat history, media attachments, and audio/video calls for dispute‑resolution and safety.</li>
          <li><strong>Documents:</strong> Any agreements or KYC files you upload are kept securely and accessed only when needed for verification or legal compliance.</li>
          <li><strong>Retention:</strong> Some property and payment records may be kept for several years to meet tax, accounting, and real‑estate regulation requirements.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">7. AI & Smart Features</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li>We use NLP for search and recommendations.</li>
          <li>We monitor watchlist prices to send helpful alerts.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">8. Payments, Wallets & Refunds</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li>We store transaction IDs, payment status, and refund references but not full card numbers or CVV.</li>
          <li>Rent-wallet balances, autopay preferences, and escrow release logs are retained for compliance.</li>
          <li>Chargebacks, disputes, or suspicious payment activity may be shared with card networks or authorities.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">10. AI-Powered Safety & Gamification</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Content Moderation:</strong> Your chats and listings are analyzed by AI to maintain a safe, professional environment.</li>
          <li><strong>Loyalty & Referrals:</strong> We track your referrals and coin transactions to manage your SetuCoin balance and ensure program fairness.</li>
          <li><strong>Checklists:</strong> Moving checklists with photos and videos are stored to protect you and the landlord during property transitions.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">11. Sharing with Partner Agents</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Contact:</strong> When you contact an agent, we share your name, phone number, and property interest so they can assist you.</li>
          <li><strong>Limitations:</strong> Agents act as independent data controllers for the data you share with them directly.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">12. Help Center Data</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Tickets:</strong> Support tickets and chat logs are stored to resolve issues and improve service quality.</li>
          <li><strong>AI Training:</strong> Anonymized interaction data helps train our AI to provide better support in the future.</li>
        </ul>

        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 transition-colors">Related Policies</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-3 transition-colors">For information about how we use cookies and similar technologies, please review our:</p>
          <a
            href="/user/cookie-policy"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
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