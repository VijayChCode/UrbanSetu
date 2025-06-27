import React from "react";
import ContactSupportWrapper from '../components/ContactSupportWrapper';

export default function UserTerms() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-700">User Terms & Conditions</h1>
      <div className="space-y-6 text-gray-800 text-base">
        <p>Welcome to our Real Estate platform. By using our services, you agree to the following terms and conditions. Please read them carefully. By registering, you must select a role (user) and provide explicit consent to our Terms & Privacy Policy.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Fairness & Equal Opportunity</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>All users (buyers, sellers, and admins) must act honestly and fairly in all transactions.</li>
          <li>No discrimination based on race, gender, religion, or any other protected status is tolerated.</li>
          <li>Admins must review listings and requests impartially and without bias.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. User Responsibilities</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Provide accurate and truthful information when registering and listing properties. Mobile numbers must be unique and valid.</li>
          <li>Respect the privacy and rights of other users.</li>
          <li>Do not use the platform for illegal or fraudulent activities.</li>
          <li>When creating or editing a listing, you must confirm that all information provided is true and genuine. Providing false information may result in account suspension or legal action.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Consent and Account Management</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Explicit consent to these terms and our privacy policy is required at signup and for certain actions.</li>
          <li>You may delete your account at any time. Deleting your account will remove your data, except where retention is required by law or for legitimate business purposes.</li>
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