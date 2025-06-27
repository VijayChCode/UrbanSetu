import React from "react";
import ContactSupportWrapper from '../components/ContactSupportWrapper';

export default function AdminTerms() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-700">Admin Terms & Conditions</h1>
      <div className="space-y-6 text-gray-800 text-base">
        <p>Welcome to our Real Estate platform. By using our services, you agree to the following terms and conditions. Please read them carefully. By registering, you must select a role (admin) and provide explicit consent to our Terms & Privacy Policy.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Fairness & Equal Opportunity</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>All users (buyers, sellers, and admins) must act honestly and fairly in all transactions.</li>
          <li>No discrimination based on race, gender, religion, or any other protected status is tolerated.</li>
          <li>Admins must review listings and requests impartially and without bias.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. Admin Responsibilities</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Admins must act in the best interest of the platform and its users.</li>
          <li>Admins must not abuse their privileges or access for personal gain.</li>
          <li>Admins must maintain confidentiality of sensitive user data.</li>
          <li>Admins may transfer their rights to another admin, following platform procedures. Default admins may have special restrictions.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Consent and Account Management</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Explicit consent to these terms and our privacy policy is required at signup and for certain actions.</li>
          <li>You may delete your account at any time. Deleting your account will remove your data, except where retention is required by law or for legitimate business purposes. Default admins may have special restrictions.</li>
          <li>Strong password requirements are enforced for your security.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">4. Platform Rules</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>We reserve the right to remove any content or user that violates these terms.</li>
          <li>Admins may suspend or ban accounts for repeated or serious violations.</li>
          <li>All transactions and communications must comply with applicable laws.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">5. Limitation of Liability</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>We are not responsible for the actions of users or third parties on the platform.</li>
          <li>All property transactions are the responsibility of the involved parties.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">6. Changes to Terms</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>We may update these terms at any time. Continued use of the platform constitutes acceptance of the new terms.</li>
        </ul>
        <p className="mt-8 text-gray-600">If you have questions about these terms, please contact our support team.</p>
      </div>
      <ContactSupportWrapper />
    </div>
  );
} 