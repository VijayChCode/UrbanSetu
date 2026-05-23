import React from "react";
import { usePageTitle } from '../hooks/usePageTitle';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import SEO from '../components/SEO';
export default function Terms() {
  // Set page title
  usePageTitle("Terms & Conditions - Legal Information");

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 transition-colors duration-300">
      <SEO
        title="Terms & Conditions - Legal Hub | UrbanSetu"
        description="Read UrbanSetu's Terms & Conditions to understand your rights and responsibilities when using our smart real estate platform in India."
        keywords="UrbanSetu terms of service, real estate platform legal, property transaction rules"
      />
      <h1 className="text-4xl font-bold mb-6 text-blue-700 dark:text-blue-400 transition-colors">Terms & Conditions</h1>
      <div className="space-y-6 text-gray-800 dark:text-gray-300 text-base transition-colors">
        <p className="text-lg">Welcome to UrbanSetu, our comprehensive real estate platform. By using our services, you agree to the following terms and conditions. Please read them carefully. By registering, you must select a role (user or admin) and provide explicit consent to our Terms & Privacy Policy.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">1. Platform Overview & Services</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Real Estate Marketplace:</strong> We provide a platform for buying, selling, and renting properties with advanced search and matching capabilities.</li>
          <li><strong>Smart Features:</strong> AI-powered search, price monitoring, fraud detection, and intelligent property recommendations.</li>
          <li><strong>User Roles:</strong> Users can register as buyers, sellers, or administrators with different access levels and responsibilities.</li>
          <li><strong>Communication Tools:</strong> Built-in messaging, appointment scheduling, and notification systems.</li>
          <li><strong>Analytics & Insights:</strong> Market data, price trends, and property analytics for informed decision-making.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">2. User Registration & Account Management</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Account Creation:</strong> You must provide accurate information including name, email, unique mobile number (10 digits), and select an appropriate role.</li>
          <li><strong>Verification:</strong> Mobile number verification via OTP is required for account activation and security.</li>
          <li><strong>Password Security:</strong> Strong password requirements are enforced. You are responsible for maintaining account security.</li>
          <li><strong>Account Deletion:</strong> You may delete your account at any time. Data will be removed except where retention is legally required.</li>
          <li><strong>Multiple Accounts:</strong> Creating multiple accounts to circumvent restrictions is prohibited.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">3. Property Listings & Content</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Accurate Information:</strong> All property details, images, and descriptions must be truthful and current.</li>
          <li><strong>Image Rights:</strong> You must own or have permission to use all uploaded images and content.</li>
          <li><strong>Pricing:</strong> Property prices must be accurate and include all applicable fees and taxes.</li>
          <li><strong>Availability:</strong> You must promptly update listing status (available, sold, rented) to maintain platform integrity.</li>
          <li><strong>Content Moderation:</strong> We reserve the right to review, edit, or remove content that violates our guidelines.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">4. Smart Features & AI Services</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Natural Language Search:</strong> Our AI processes search queries to provide relevant property recommendations.</li>
          <li><strong>Price Monitoring:</strong> Watchlist features track price changes and send notifications about market movements.</li>
          <li><strong>Fraud Detection:</strong> Automated systems monitor for suspicious activities and fraudulent listings.</li>
          <li><strong>Recommendations:</strong> AI-powered suggestions based on your preferences and browsing history.</li>
          <li><strong>Data Usage:</strong> Your interaction data helps improve our AI algorithms and service quality.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">5. User Responsibilities & Conduct</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Fair Dealing:</strong> All users must act honestly and fairly in all transactions and communications.</li>
          <li><strong>No Discrimination:</strong> Discrimination based on race, gender, religion, or any protected status is strictly prohibited.</li>
          <li><strong>Respectful Communication:</strong> Maintain professional and respectful communication with other users.</li>
          <li><strong>Legal Compliance:</strong> All activities must comply with applicable local, state, and federal laws.</li>
          <li><strong>Prohibited Activities:</strong> No spam, harassment, fraud, or misuse of platform features.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">6. Admin Responsibilities</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Impartial Review:</strong> Admins must review listings and requests without bias or personal interest.</li>
          <li><strong>Platform Integrity:</strong> Maintain platform quality by enforcing rules and removing inappropriate content.</li>
          <li><strong>User Support:</strong> Provide timely assistance and resolve disputes fairly.</li>
          <li><strong>Data Protection:</strong> Handle user data responsibly and in accordance with privacy policies.</li>
          <li><strong>Security Monitoring:</strong> Monitor for security threats and take appropriate action.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">7. Transactions & Payments</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Direct Transactions:</strong> Property transactions occur directly between users. We facilitate connections but are not party to transactions.</li>
          <li><strong>Payment Processing:</strong> Any payment features are provided by third-party services with their own terms.</li>
          <li><strong>Transaction Records:</strong> We may maintain records of communications and appointments for dispute resolution.</li>
          <li><strong>Dispute Resolution:</strong> Users are responsible for resolving transaction disputes. We may provide mediation services.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">8. Privacy & Data Protection</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Consent:</strong> Explicit consent is required for data processing and certain platform features.</li>
          <li><strong>Data Usage:</strong> Your data is used to provide services, improve platform functionality, and ensure security.</li>
          <li><strong>Third-Party Sharing:</strong> We may share data with service providers but do not sell personal information.</li>
          <li><strong>Security Measures:</strong> We implement industry-standard security measures to protect your data.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">9. Platform Rules & Enforcement</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Content Standards:</strong> All content must be appropriate, legal, and relevant to real estate.</li>
          <li><strong>Account Suspension:</strong> We may suspend or terminate accounts for violations of these terms.</li>
          <li><strong>Appeal Process:</strong> Users may appeal account actions through our support system.</li>
          <li><strong>Platform Modifications:</strong> We reserve the right to modify or discontinue features with notice.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">10. Intellectual Property</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Platform Rights:</strong> We own all rights to the platform, including software, design, and content.</li>
          <li><strong>User Content:</strong> You retain rights to your content but grant us license to use it on the platform.</li>
          <li><strong>Prohibited Use:</strong> No copying, reverse engineering, or unauthorized use of platform features.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">11. Limitation of Liability</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Service Availability:</strong> We strive for uptime but do not guarantee uninterrupted service.</li>
          <li><strong>Third-Party Actions:</strong> We are not responsible for actions of other users or third parties.</li>
          <li><strong>Property Transactions:</strong> All property transactions are the responsibility of the involved parties.</li>
          <li><strong>Damages:</strong> Our liability is limited to the maximum extent permitted by law.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">12. Property Transactions & Escrow</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Escrow Services:</strong> We may hold deposits in trust during property transactions. All escrow accounts are maintained in accordance with applicable real estate laws and regulations.</li>
          <li><strong>Transaction Timeline:</strong> Property purchases and sales follow agreed timelines. Any deviation requires mutual consent in writing.</li>
          <li><strong>Contingencies:</strong> Transaction contingencies (inspection, appraisal, financing) must be clearly documented and communicated to all parties.</li>
          <li><strong>Earnest Money:</strong> Earnest money deposits are held in escrow and released according to transaction terms or applicable law.</li>
          <li><strong>Title & Documentation:</strong> All property documentation, title insurance, and legal paperwork are the responsibility of the transacting parties and their legal representatives.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">13. Fair Housing & Non-Discrimination</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Legal Compliance:</strong> We comply with the Fair Housing Act and applicable fair housing laws in all jurisdictions.</li>
          <li><strong>No Discrimination:</strong> Discrimination in property sales, rentals, or services based on race, color, national origin, religion, sex, familial status, disability, sexual orientation, or gender identity is strictly prohibited.</li>
          <li><strong>Reporting Violations:</strong> Users may report fair housing violations through our platform for investigation and action.</li>
          <li><strong>Accessibility:</strong> All properties and services must be made accessible to individuals with disabilities to the extent legally required.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">14. Broker Commissions & Fees</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Transparency:</strong> All commissions and fees must be disclosed upfront and agreed upon before services are rendered.</li>
          <li><strong>Commission Structure:</strong> Standard commissions (typically 5-6% split between buyer and seller agents) may vary by transaction and agreement.</li>
          <li><strong>Flat Fees:</strong> Alternative fee arrangements (flat fees, hourly rates) are permitted if mutually agreed in writing.</li>
          <li><strong>Broker Responsibilities:</strong> Licensed brokers are responsible for managing escrow accounts, regulatory compliance, and agent conduct.</li>
          <li><strong>Dispute Resolution:</strong> Commission disputes are resolved through negotiation, mediation, or arbitration as agreed.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">15. Property Disclosures & Representations</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Seller Obligations:</strong> Sellers must disclose known material defects, property condition, title issues, and environmental concerns.</li>
          <li><strong>Latent Defects:</strong> Sellers must disclose latent defects (not readily apparent) that would affect property value or habitability.</li>
          <li><strong>Property Condition Report:</strong> Many jurisdictions require detailed property condition reports; sellers must comply with local requirements.</li>
          <li><strong>Honest Representations:</strong> All representations about property condition, improvements, or compliance must be truthful and based on actual knowledge.</li>
          <li><strong>Consequences of Misrepresentation:</strong> Deliberate misrepresentation may result in legal liability, financial damages, or criminal charges.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">16. Insurance & Risk Management</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Homeowners Insurance:</strong> Buyers are required to obtain homeowners insurance before closing. Proof of insurance is required by lenders.</li>
          <li><strong>Title Insurance:</strong> Title insurance protects against ownership disputes and is typically paid by the seller at closing.</li>
          <li><strong>Platform Liability:</strong> We maintain insurance for our operations but do not insure individual transactions or properties.</li>
          <li><strong>User Responsibility:</strong> Users should obtain appropriate insurance for their properties and activities.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">17. Regional Compliance & Regulations</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>India Real Estate Laws:</strong> Transactions comply with the Real Estate (Regulation and Development) Act (RERA) and state-specific regulations.</li>
          <li><strong>GST Compliance:</strong> Goods and Services Tax (GST) is applied per applicable rates and regulations.</li>
          <li><strong>Local Laws:</strong> All transactions adhere to municipal, state, and national property laws and regulations.</li>
          <li><strong>GDPR/Privacy Laws:</strong> International transactions follow GDPR and applicable data protection regulations.</li>
          <li><strong>Currency & Taxation:</strong> International transactions include currency conversion details and applicable tax reporting.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">18. Dispute Resolution & Mediation</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Negotiation First:</strong> All disputes should first be resolved through direct negotiation between parties.</li>
          <li><strong>Mediation:</strong> If negotiation fails, parties agree to attempt mediation through a neutral third party.</li>
          <li><strong>Arbitration:</strong> Unresolved disputes may be submitted to binding arbitration per applicable laws and agreements.</li>
          <li><strong>Legal Remedies:</strong> Parties retain the right to pursue legal remedies through courts if mediation/arbitration fails.</li>
          <li><strong>Admin Role:</strong> Admins may provide mediation services but are not party to disputes and maintain impartiality.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">19. Fraud Prevention & Security</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Identity Verification:</strong> All users must provide verified identity documentation for high-value transactions.</li>
          <li><strong>Fraud Detection:</strong> We employ AI and manual monitoring to detect and prevent fraudulent activities.</li>
          <li><strong>Reporting Fraud:</strong> Users should immediately report suspected fraud to our support team.</li>
          <li><strong>Escrow Protection:</strong> Escrow accounts protect buyers from fraud during transaction periods.</li>
          <li><strong>Consequences:</strong> Fraudulent activities result in account termination, legal referral, and potential criminal prosecution.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">20. Changes to Terms</h2>
        <p className="ml-6">We may update these terms from time to time. Significant changes will be communicated through email or platform notifications. Continued use of the platform constitutes acceptance of the updated terms.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">21. Rent-Lock & Booking Governance</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Lock Windows:</strong> When a rent-lock contract is issued, listings automatically exit public search until the contract is signed, cancelled or expires.</li>
          <li><strong>Call & Chat Monitoring:</strong> Audio/video calls initiated through UrbanSetu may be mirrored in admin dashboards to resolve disputes and enforce safety policies.</li>
          <li><strong>Appointment Conduct:</strong> Abusive behavior during chats or calls can trigger instant suspension and notification to relevant authorities.</li>
          <li><strong>Multi-deal Prevention:</strong> Users cannot hold overlapping rent-locks on the same property unless explicitly approved by the property owner and UrbanSetu.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">22. Fees, Taxes & Payouts</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Payout Verification:</strong> Sellers/landlords must complete KYC and banking verification before receiving any payout.</li>
          <li><strong>Tax Responsibility:</strong> Users are responsible for reporting rental income, capital gains, GST, or other taxes applicable in their jurisdiction.</li>
          <li><strong>Chargeback Handling:</strong> If a buyer or tenant initiates a chargeback, UrbanSetu may temporarily freeze payouts and request additional evidence.</li>
          <li><strong>Service Bundles:</strong> Optional services (movers, cleaning, legal, staging) are billed separately and subject to their own cancellation windows.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">23. Support, Audits & Enforcement</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Ticket SLA:</strong> Critical issues (payment failures, fraud, safety) receive responses within 6 business hours; standard requests follow a 24–48 hour SLA.</li>
          <li><strong>Evidence Preservation:</strong> We may preserve chat transcripts, call recordings, and checklist media for at least 18 months for legal or compliance purposes.</li>
          <li><strong>Regulatory Cooperation:</strong> UrbanSetu may share relevant information with regulators or law enforcement when legally compelled.</li>
          <li><strong>Account Termination:</strong> Severe violations (fraud, harassment, repeated policy abuse) can result in immediate termination without refund.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">24. SetuCoins Loyalty Program</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Nature of Program:</strong> SetuCoins are virtual loyalty points and do not constitute legal tender, currency, or property. They have no cash value outside of authorized platform redemptions.</li>
          <li><strong>Earning Rewards:</strong> Coins are earned through verified activities including on-time rent payments (1% back), maintaining payment streaks, booking home services, and successful referrals.</li>
          <li><strong>Referral Program:</strong> Users earn 100 SetuCoins for every successful referral who joins using their unique link. New joining users receive 50 SetuCoins as a one-time welcome bonus.</li>
          <li><strong>Redemption:</strong> Coins can be redeemed for discounts on monthly rent or on-demand services at a standard rate of 10 SetuCoins = ₹1 or 800 SetuCoins = $1. Redemption rates are subject to change with notice.</li>
          <li><strong>Validity & Expiry:</strong> SetuCoins remain valid as long as the user maintains an active rental contract or property listing. Inactive accounts for over 12 months may face balance expiration.</li>
          <li><strong>Abuse & Fraud:</strong> UrbanSetu reserves the right to void or zero-out balances if coins were earned through system exploits, fraudulent activities, or cancelled transactions.</li>
          <li><strong>Program Modifications:</strong> We reserve the right to modify, suspend, or terminate the loyalty program or change earning/redemption rules at any time.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">25. Investment Tools & Route Planning</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Advisory Nature:</strong> Investment tools, price trends, and ROI calculators are for informational purposes only. They do not constitute financial or legal advice.</li>
          <li><strong>Data Accuracy:</strong> While we strive for accuracy, market projections and commute time estimates (Route Planner) are based on third-party data and may vary in reality.</li>
          <li><strong>User Discretion:</strong> Users are encouraged to conduct independent due diligence before making significant financial commitments based on platform-generated insights.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">26. Enhanced Fraud Protection & AI Monitoring</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Automated Scanning:</strong> All listings and user communications are subject to AI-driven fraud detection to identify potential scams, bait-and-switch listings, or abusive behavior.</li>
          <li><strong>Account Verification:</strong> Mandatory verification (OTP/ID) for high-risk regions or high-value listings is enforced to protect the platform ecosystem.</li>
          <li><strong>Reporting Obligation:</strong> Users must report any suspicious listing or "too good to be true" offer immediately through the "Report" feature.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">27. Partner Agents & Professional Services</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Role:</strong> Partner Agents are independent real estate professionals verified by UrbanSetu to assist users with buying, selling, or renting properties.</li>
          <li><strong>Verification:</strong> Agents undergo strict verification processes including RERA registration checks, identity verification, and professional background reviews.</li>
          <li><strong>Conduct:</strong> Agents are required to adhere to our Code of Conduct, maintaining high standards of honesty, transparency, and fair dealing in all interactions.</li>
          <li><strong>Liability:</strong> While UrbanSetu facilitates connections, we are not liable for the independent actions, advice, or services provided by Partner Agents beyond our platform enforcement measures.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-blue-600 dark:text-blue-300 transition-colors">28. Help Center & Support Services</h2>
        <ul className="list-disc ml-6 space-y-3">
          <li><strong>Availability:</strong> Support is available through our Help Center, Ticket System, and AI-powered Chat. Response times vary based on issue severity and user tier.</li>
          <li><strong>Ticket System:</strong> Users may submit detailed support tickets for technical issues, disputes, or general inquiries. Accurate information must be provided for effective resolution.</li>
          <li><strong>AI Support:</strong> Our AI support chatbot provides instant assistance for common queries. Users should verify critical information with human support or official documentation.</li>
          <li><strong>Conduct:</strong> Abusive, threatening, or harassing behavior towards support staff or AI systems will result in immediate account suspension.</li>
        </ul>

        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2 transition-colors">Contact Information</h3>
          <p className="text-gray-700 dark:text-gray-300 transition-colors">For questions about these terms or our services, please contact us:</p>
          <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300 transition-colors">
            <li>📧 Email: auth.urbansetu@gmail.com</li>
            <li>📞 Phone: +1 (555) 123-4567</li>
            <li>🏢 Address: UrbanSetu Legal Team, Real Estate Platform</li>
          </ul>
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