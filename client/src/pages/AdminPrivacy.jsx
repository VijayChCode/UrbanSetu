import React from "react";
import ContactSupportWrapper from '../components/ContactSupportWrapper';

export default function AdminPrivacy() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-700">Admin Privacy Policy</h1>
      <div className="space-y-6 text-gray-800 text-base">
        <p>Your privacy is important to us. This policy explains how we collect, use, and protect your information as an admin of our platform.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Personal information you provide during registration, including your selected role (admin), name, email, and validated mobile number (must be unique and 10 digits).</li>
          <li>Property details, communications, transaction history, and admin actions (such as transfer of admin rights).</li>
          <li>Usage data such as IP address, browser type, and device information.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>To provide, improve, and secure our services.</li>
          <li>To communicate with you about your account, listings, platform updates, and admin responsibilities.</li>
          <li>To ensure security, prevent fraud, and enforce platform rules.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Consent and Your Rights</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Explicit consent for our Terms & Privacy Policy is required at signup and for certain actions.</li>
          <li>You can access, update, or delete your personal information at any time. Deleting your account will remove your data, except where retention is required by law or for legitimate business purposes. Default admins may have special restrictions.</li>
          <li>You may opt out of marketing communications.</li>
          <li>Contact us for any privacy-related concerns or requests.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">4. Sharing of Information</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>We do not sell your personal information to third parties.</li>
          <li>We may share information with service providers as needed to operate the platform.</li>
          <li>We may disclose information if required by law or to protect our rights.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">5. Data Security</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>We use industry-standard security measures to protect your data, including strong password requirements and account protection features.</li>
          <li>Despite our efforts, no system is completely secure. Use the platform at your own risk.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">6. Changes to This Policy</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>We may update this policy from time to time. Continued use of the platform means you accept the new policy.</li>
        </ul>
        <p className="mt-8 text-gray-600">If you have questions about this policy, please contact our support team.</p>
      </div>
      <ContactSupportWrapper />
    </div>
  );
} 