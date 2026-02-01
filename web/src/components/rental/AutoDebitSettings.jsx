import React, { useState } from "react";
import { FaCog, FaToggleOn, FaToggleOff, FaCreditCard, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaTimes, FaSave } from "react-icons/fa";
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AutoDebitSettings({ wallet, contract, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    enabled: wallet?.autoDebitEnabled || false,
    method: wallet?.autoDebitMethod || 'razorpay',
    day: wallet?.autoDebitDay || contract?.dueDate || 1,
    paymentMethodToken: wallet?.paymentMethodToken || ''
  });

  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [newMethodDetails, setNewMethodDetails] = useState({
    type: 'card',
    cardNumber: '',
    expiry: '',
    cvv: '',
    vpa: ''
  });

  const handleToggle = async () => {
    // If enabling and no token, prompt to add method
    if (!settings.enabled && !settings.paymentMethodToken) {
      setIsAddingMethod(true);
      return;
    }

    try {
      setLoading(true);
      const newEnabled = !settings.enabled;

      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contract.contractId}/auto-debit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: newEnabled,
          method: settings.method,
          day: settings.day,
          paymentMethodToken: settings.paymentMethodToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update auto-debit settings");
      }

      setSettings(prev => ({ ...prev, enabled: newEnabled }));

      if (onUpdate && data.wallet) {
        onUpdate(data.wallet);
      }

      toast.success(`Auto-debit ${newEnabled ? 'enabled' : 'disabled'} successfully.`);
    } catch (error) {
      console.error("Error updating auto-debit:", error);
      toast.error(error.message || "Failed to update auto-debit settings.");
    } finally {
      setLoading(false);
    }
  };

  const savePaymentMethod = async () => {
    // Validation
    if (newMethodDetails.type === 'card') {
      if (!newMethodDetails.cardNumber || newMethodDetails.cardNumber.length < 12) {
        toast.error("Please enter a valid card number.");
        return;
      }
      if (!newMethodDetails.expiry || !newMethodDetails.cvv) {
        toast.error("Please enter expiry and CVV.");
        return;
      }
    } else if (newMethodDetails.type === 'upi') {
      if (!newMethodDetails.vpa || !newMethodDetails.vpa.includes('@')) {
        toast.error("Please enter a valid UPI ID.");
        return;
      }
    }

    try {
      setLoading(true);
      // Simulate token generation (In real app, this goes to Stripe/Razorpay)
      const mockToken = `tok_${newMethodDetails.type}_${Date.now()}`;

      // Save to backend + Enable Auto-Debit
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contract.contractId}/auto-debit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true, // Enable immediately upon adding
          method: newMethodDetails.type === 'upi' ? 'upi' : 'razorpay',
          day: settings.day,
          paymentMethodToken: mockToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save payment method");
      }

      setSettings(prev => ({
        ...prev,
        enabled: true,
        paymentMethodToken: mockToken,
        method: newMethodDetails.type === 'upi' ? 'upi' : 'razorpay'
      }));

      if (onUpdate && data.wallet) {
        onUpdate(data.wallet);
      }

      setIsAddingMethod(false);
      toast.success("Payment method added and auto-debit enabled!");
    } catch (error) {
      console.error("Error saving payment method:", error);
      toast.error(error.message || "Failed to save payment method.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (settings.day < 1 || settings.day > 31) {
      toast.error("Auto-debit day must be between 1 and 31.");
      return;
    }

    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contract.contractId}/auto-debit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          method: settings.method,
          day: settings.day,
          paymentMethodToken: settings.paymentMethodToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update settings");
      }

      if (onUpdate && data.wallet) {
        onUpdate(data.wallet);
      }

      toast.success("Auto-debit settings updated successfully.");
    } catch (error) {
      toast.error(error.message || "Failed to update settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        <FaCog className="inline mr-2" />
        Auto-Debit Settings
      </h2>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <FaExclamationTriangle className="text-blue-600 dark:text-blue-400 text-xl mt-1" />
          <div>
            <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">About Auto-Debit</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Enable auto-debit to automatically pay your rent on the specified day of each month.
              You will receive reminders 3 days and 1 day before the payment date.
            </p>
          </div>
        </div>
      </div>

      {/* Main Toggle Section */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6 mb-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-white mb-1">Enable Auto-Debit</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Automatically pay rent on the specified day of each month
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            className="text-4xl disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
          >
            {settings.enabled ? (
              <FaToggleOn className="text-green-600 dark:text-green-400" />
            ) : (
              <FaToggleOff className="text-gray-400 dark:text-gray-500" />
            )}
          </button>
        </div>

        {/* Add Payment Method Form */}
        {isAddingMethod && (
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-800 dark:text-white">Add Payment Method</h4>
              <button onClick={() => setIsAddingMethod(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setNewMethodDetails(prev => ({ ...prev, type: 'card' }))}
                  className={`flex-1 py-2 rounded-md border ${newMethodDetails.type === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-600'}`}
                >
                  Credit/Debit Card
                </button>
                <button
                  onClick={() => setNewMethodDetails(prev => ({ ...prev, type: 'upi' }))}
                  className={`flex-1 py-2 rounded-md border ${newMethodDetails.type === 'upi' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-600'}`}
                >
                  UPI
                </button>
              </div>

              {newMethodDetails.type === 'card' ? (
                <>
                  <input
                    type="text"
                    placeholder="Card Number"
                    value={newMethodDetails.cardNumber}
                    onChange={(e) => setNewMethodDetails({ ...newMethodDetails, cardNumber: e.target.value.replace(/\D/g, '').substring(0, 16) })}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={newMethodDetails.expiry}
                      onChange={(e) => setNewMethodDetails({ ...newMethodDetails, expiry: e.target.value })}
                      className="w-1/2 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="CVV"
                      maxLength="3"
                      value={newMethodDetails.cvv}
                      onChange={(e) => setNewMethodDetails({ ...newMethodDetails, cvv: e.target.value.replace(/\D/g, '').substring(0, 3) })}
                      className="w-1/2 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <input
                  type="text"
                  placeholder="UPI ID (e.g. user@okhdfcbank)"
                  value={newMethodDetails.vpa}
                  onChange={(e) => setNewMethodDetails({ ...newMethodDetails, vpa: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              )}

              <button
                onClick={savePaymentMethod}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                {loading ? 'Processing...' : <><FaSave /> Save & Enable Auto-Debit</>}
              </button>
            </div>
          </div>
        )}

        {/* Existing Payment Method Display */}
        {!isAddingMethod && settings.paymentMethodToken && (
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full text-green-600 dark:text-green-400">
                  <FaCreditCard />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">Linked Payment Method</p>
                  <p className="text-sm text-gray-500 font-mono">
                    {settings.paymentMethodToken.startsWith('tok_upi') ? 'UPI Linked' : '•••• •••• •••• 4242'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddingMethod(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Settings Form (Only if enabled) */}
        {settings.enabled && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600 space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                <FaCalendarAlt className="inline mr-2" />
                Auto-Debit Day
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settings.day}
                  onChange={(e) => setSettings(prev => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                  className="w-24 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <span className="text-gray-500 font-medium">of every month</span>
                <button
                  onClick={handleUpdateSettings}
                  disabled={loading}
                  className="ml-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                >
                  Update Day
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className={`rounded-lg p-4 ${settings.enabled ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'}`}>
        <div className="flex items-center gap-3">
          {settings.enabled ? (
            <>
              <FaCheckCircle className="text-green-600 dark:text-green-400 text-xl" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">Auto-Debit Active</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Rent will be deducted on day {settings.day}.
                </p>
              </div>
            </>
          ) : (
            <>
              <FaExclamationTriangle className="text-gray-400 dark:text-gray-500 text-xl" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-200">Auto-Debit Disabled</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Manually pay rent to avoid penalty.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
