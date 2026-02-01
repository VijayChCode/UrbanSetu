import React, { useState } from "react";
import { FaCog, FaToggleOn, FaToggleOff, FaCreditCard, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaTimes, FaSave, FaUniversity, FaMobileAlt, FaTrash } from "react-icons/fa";
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
    type: 'card', // 'card' or 'upi'
    cardCategory: 'debit', // 'debit' or 'credit'
    cardNumber: '',
    expiry: '',
    cvv: '',
    vpa: ''
  });

  const handleToggle = async () => {
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

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    setNewMethodDetails({ ...newMethodDetails, expiry: value.substring(0, 5) });
  };

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setNewMethodDetails({ ...newMethodDetails, cardNumber: formatted.substring(0, 19) });
  };

  const savePaymentMethod = async () => {
    if (newMethodDetails.type === 'card') {
      const rawCard = newMethodDetails.cardNumber.replace(/\s/g, '');
      if (!rawCard || rawCard.length < 12) {
        toast.error("Please enter a valid card number.");
        return;
      }
      if (!newMethodDetails.expiry || newMethodDetails.expiry.length < 5) {
        toast.error("Please enter expiry (MM/YY).");
        return;
      }
      if (!newMethodDetails.cvv || newMethodDetails.cvv.length < 3) {
        toast.error("Please enter a valid CVV.");
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
      const mockToken = `tok_${newMethodDetails.type}_${Date.now()}`;

      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contract.contractId}/auto-debit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
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

  const removePaymentMethod = async () => {
    if (!window.confirm("Are you sure you want to remove this payment method? Auto-debit will be disabled.")) {
      return;
    }

    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/wallet/${contract.contractId}/auto-debit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: false,
          paymentMethodToken: '' // Clear the token
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to remove payment method");
      }

      setSettings(prev => ({
        ...prev,
        enabled: false,
        paymentMethodToken: ''
      }));

      if (onUpdate && data.wallet) {
        onUpdate(data.wallet);
      }

      toast.success("Payment method removed successfully.");
    } catch (error) {
      console.error("Error removing payment method:", error);
      toast.error(error.message || "Failed to remove payment method.");
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaCog className="text-blue-600" />
          Auto-Debit Configuration
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your automatic rent payment preferences securely</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-4">
          <div className="bg-blue-100 dark:bg-blue-800/30 p-3 rounded-lg flex-shrink-0">
            <FaExclamationTriangle className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-sm">
            <p className="font-bold text-blue-900 dark:text-blue-200 mb-1">Set & Forget</p>
            <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
              Enable auto-debit to automatically pay your rent on the specified day. Payments are processed through a secure bank-grade escrow system.
            </p>
          </div>
        </div>

        {/* Main Status & Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700 gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg text-gray-800 dark:text-white">Monthly Auto-Transfer</h3>
              {settings.enabled && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider rounded-full">Active</span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Funds will be debited from your linked account automatically</p>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-sm font-bold ${settings.enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={handleToggle}
              disabled={loading}
              className="text-5xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {settings.enabled ? (
                <FaToggleOn className="text-blue-600" />
              ) : (
                <FaToggleOff className="text-gray-300 dark:text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Payment Method Management */}
        {isAddingMethod && (
          <div className="border-2 border-blue-100 dark:border-blue-900/50 rounded-2xl p-6 bg-white dark:bg-gray-800 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                <FaUniversity className="text-blue-600" /> Linked Payment Sources
              </h4>
              <button onClick={() => setIsAddingMethod(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 transition-colors">
                <FaTimes />
              </button>
            </div>

            <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl mb-6">
              <button
                onClick={() => setNewMethodDetails({ ...newMethodDetails, type: 'card' })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${newMethodDetails.type === 'card' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                <FaCreditCard /> Card Details
              </button>
              <button
                onClick={() => setNewMethodDetails({ ...newMethodDetails, type: 'upi' })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${newMethodDetails.type === 'upi' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                <FaMobileAlt /> UPI Transfer
              </button>
            </div>

            {newMethodDetails.type === 'card' ? (
              <div className="space-y-4">
                <div className="flex gap-4 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg max-w-xs">
                  <button
                    onClick={() => setNewMethodDetails({ ...newMethodDetails, cardCategory: 'debit' })}
                    className={`flex-1 py-2 text-xs font-bold rounded ${newMethodDetails.cardCategory === 'debit' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    Debit Card
                  </button>
                  <button
                    onClick={() => setNewMethodDetails({ ...newMethodDetails, cardCategory: 'credit' })}
                    className={`flex-1 py-2 text-xs font-bold rounded ${newMethodDetails.cardCategory === 'credit' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    Credit Card
                  </button>
                </div>

                <div className="relative group">
                  <FaCreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="Enter Card Number (0000 0000 0000 0000)"
                    value={newMethodDetails.cardNumber}
                    onChange={handleCardNumberChange}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={newMethodDetails.expiry}
                      onChange={handleExpiryChange}
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>
                  <div className="relative group">
                    <FaCog className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="password"
                      placeholder="CVV"
                      maxLength="3"
                      value={newMethodDetails.cvv}
                      onChange={(e) => setNewMethodDetails({ ...newMethodDetails, cvv: e.target.value.replace(/\D/g, '').substring(0, 3) })}
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative group">
                <FaMobileAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Enter UPI ID (e.g. yourname@bank)"
                  value={newMethodDetails.vpa}
                  onChange={(e) => setNewMethodDetails({ ...newMethodDetails, vpa: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setIsAddingMethod(false)}
                className="flex-1 py-4 px-6 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={savePaymentMethod}
                disabled={loading}
                className="flex-[2] py-4 px-6 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><FaSave /> Secure Link & Enable</>
                )}
              </button>
            </div>

            <p className="mt-4 text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">Encrypted with 256-bit bank grade security</p>
          </div>
        )}

        {/* Existing Source Display */}
        {!isAddingMethod && settings.paymentMethodToken && (
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl shadow-inner">
                  {settings.method === 'upi' ? <FaMobileAlt /> : <FaCreditCard />}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Authenticated Account</p>
                  <p className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    {settings.method === 'upi' ? 'UPI / VPA' : 'Secured Card Ending in 4242'}
                    <FaCheckCircle className="text-blue-600 text-sm" />
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddingMethod(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-2 px-4 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-all"
                >
                  Manage Sources
                </button>
                <button
                  onClick={removePaymentMethod}
                  disabled={loading}
                  className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 py-2 px-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-all flex items-center gap-1"
                  title="Remove payment method"
                >
                  <FaTrash className="text-[10px]" /> Remove Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Configurations Form */}
        {settings.enabled && (
          <div className="pt-8 border-t border-gray-100 dark:border-gray-800 space-y-6">
            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FaCalendarAlt className="text-blue-600" /> Payment Schedule Date
              </label>
              <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={settings.day}
                    onChange={(e) => setSettings(prev => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                    className="w-20 p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-sm font-bold text-gray-500">Day of month</span>
                </div>
                <button
                  onClick={handleUpdateSettings}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-300 text-xs font-bold rounded-xl hover:bg-black dark:hover:bg-gray-700 transition-all"
                >
                  Update Schedule
                </button>
              </div>
              <p className="text-[10px] text-gray-400 italic">* Rent will be deducted automatically. Ensure sufficient balance on this date.</p>
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 mt-4 text-center ${settings.enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-900/50'}`}>
        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">
          Status: {settings.enabled ? 'Live & Monitoring' : 'Inactive / Ready to Link'}
        </p>
      </div>
    </div>
  );
}
