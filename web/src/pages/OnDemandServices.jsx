import React, { useEffect, useState } from 'react';
import { FaBroom, FaBolt, FaWrench, FaBug, FaTools, FaTruckMoving, FaCalendarAlt, FaMapMarkerAlt, FaHome, FaSignInAlt, FaSignOutAlt, FaCheckCircle, FaClock, FaTimesCircle, FaCoins } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ConditionImageUpload from '../components/rental/ConditionImageUpload';
import ChecklistModal from '../components/rental/ChecklistModal';

import { toast } from 'react-toastify';
import { usePageTitle } from '../hooks/usePageTitle';
import PaymentModal from '../components/PaymentModal';
import SetuCoinParticles from '../components/SetuCoins/SetuCoinParticles';
import UserServicesSkeleton from '../components/skeletons/UserServicesSkeleton';
import { getCoinValue, COIN_CONFIG } from '../utils/coinUtils';
import { authenticatedFetch } from '../utils/auth';
const services = [
  { key: 'cleaning', name: 'Cleaning', icon: <FaBroom className="text-blue-600" /> },
  { key: 'electrician', name: 'Electrician', icon: <FaBolt className="text-yellow-600" /> },
  { key: 'plumber', name: 'Plumber', icon: <FaWrench className="text-indigo-600" /> },
  { key: 'pest', name: 'Pest Control', icon: <FaBug className="text-green-700" /> },
  { key: 'handyman', name: 'Handyman', icon: <FaTools className="text-purple-700" /> },
];

export default function OnDemandServices() {
  // Set page title
  usePageTitle("On-Demand Services - Service Requests");

  const { currentUser } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [details, setDetails] = useState({ date: '', address: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [serviceFilters, setServiceFilters] = useState({ q: '', status: 'all' });
  // Movers merge
  const [moversForm, setMoversForm] = useState({ from: '', to: '', date: '', size: '1BHK', notes: '' });
  const [moversSubmitting, setMoversSubmitting] = useState(false);
  const [myMoverRequests, setMyMoverRequests] = useState([]);
  const [moversFilters, setMoversFilters] = useState({ q: '', status: 'all' });
  // Move-In/Move-Out Checklists
  const [myContracts, setMyContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [checklists, setChecklists] = useState({ moveIn: null, moveOut: null });
  const [checklistType, setChecklistType] = useState('move_in');
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [checklistForm, setChecklistForm] = useState({ rooms: [], amenities: [], notes: '' });
  const [checklistFilters, setChecklistFilters] = useState({ q: '', status: 'all' });
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    isDestructive: true
  });

  // SetuCoins Redemption
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);
  const [coinsToRedeemMovers, setCoinsToRedeemMovers] = useState(0);
  const [showCoinBurst, setShowCoinBurst] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentRequestData, setPaymentRequestData] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const fetchMyRequests = async () => {
    if (!currentUser) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/services`);
      const data = await res.json();
      setMyRequests(Array.isArray(data) ? data : []);
    } catch (_) { }
  };

  const fetchMyMoverRequests = async () => {
    if (!currentUser) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/movers`);
      const data = await res.json();
      setMyMoverRequests(Array.isArray(data) ? data : []);
    } catch (_) { }
  };

  const fetchMyContracts = async () => {
    if (!currentUser) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts`);
      const data = await res.json();
      if (data.success) {
        setMyContracts(data.contracts || []);
      }
    } catch (_) { }
  };

  const fetchChecklists = async (contractId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/checklist/${contractId}`);
      const data = await res.json();
      if (data.success) {
        const moveIn = data.checklists.find(c => c.type === 'move_in');
        const moveOut = data.checklists.find(c => c.type === 'move_out');
        setChecklists({ moveIn, moveOut });
        return { moveIn, moveOut };
      }
    } catch (error) {
      toast.error('Failed to fetch checklists');
    }
    return null;
  };

  const fetchCoinBalance = async () => {
    if (!currentUser) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/coins/balance`);
      const data = await res.json();
      if (data.success) {
        setCoinBalance(data.setuCoinsBalance);
      }
    } catch (_) { }
  };

  useEffect(() => {
    const init = async () => {
      if (currentUser?._id) {
        await Promise.all([
          fetchMyRequests(),
          fetchMyMoverRequests(),
          fetchMyContracts(),
          fetchCoinBalance()
        ]);
        setPageLoading(false);
      } else {
        setPageLoading(false);
      }
    };
    init();
  }, [currentUser?._id]);

  // Handle URL parameters for opening checklist modal
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const contractIdParam = searchParams.get('contractId');
    const checklistParam = searchParams.get('checklist');

    if (contractIdParam && (checklistParam === 'move_in' || checklistParam === 'move_out')) {
      // Find the contract
      const contract = myContracts.find(c =>
        (c._id === contractIdParam) || (c.contractId === contractIdParam)
      );

      if (contract) {
        const openModal = async () => {
          setSelectedContract(contract);
          setChecklistType(checklistParam);
          await fetchChecklists(contract._id || contractIdParam);
          setShowChecklistModal(true);
          // Clean up URL
          navigate('/user/services', { replace: true });
        };
        openModal();
      }
      // If contract not found but contracts have loaded, do nothing (contract might not exist)
    }
  }, [location.search, myContracts]);

  const toggleService = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const submit = async () => {
    if (selected.length === 0 || !details.date || !details.address) {
      toast.error('Select at least one service and fill required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selected,
          preferredDate: details.date,
          address: details.address,
          notes: details.notes,
          coinsToRedeem: coinsToRedeem
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requiresPayment && data.paymentDetails) {
          setPaymentRequestData({
            ...data.paymentDetails,
            type: 'service',
            requestId: data.requestId
          });
          setShowPaymentModal(true);
          return; // Modal will handle the rest
        }
        toast.success('Service request submitted');
        fetchMyRequests();
        setCoinsToRedeem(0);
        fetchCoinBalance(); // Update balance
        // Notify admins
        try {
          await authenticatedFetch(`${API_BASE_URL}/api/notifications/notify-admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'New Service Request',
              message: `${currentUser?.username || 'A user'} requested services: ${selected.join(', ')} on ${details.date}.`
            })
          });
        } catch (_) { }
      } else {
        toast.error('Failed to submit request');
      }
      setSelected([]);
      setDetails({ date: '', address: '', notes: '' });
    } catch (e) { toast.error('Failed'); } finally { setLoading(false); }
  };

  const submitMovers = async (e) => {
    e.preventDefault();
    if (!moversForm.from || !moversForm.to || !moversForm.date) {
      toast.error('Please fill From, To and Date');
      return;
    }
    setMoversSubmitting(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/movers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: moversForm.from,
          toAddress: moversForm.to,
          moveDate: moversForm.date,
          size: moversForm.size,
          notes: moversForm.notes,
          coinsToRedeem: coinsToRedeemMovers
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requiresPayment && data.paymentDetails) {
          setPaymentRequestData({
            ...data.paymentDetails,
            type: 'movers',
            requestId: data.requestId
          });
          setShowPaymentModal(true);
          return;
        }
        toast.success('Movers request submitted');
        fetchMyMoverRequests();
        setCoinsToRedeemMovers(0);
        fetchCoinBalance();
        // Notify admins
        try {
          await authenticatedFetch(`${API_BASE_URL}/api/notifications/notify-admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'New Movers Request',
              message: `${currentUser?.username || 'A user'} requested movers from "${moversForm.from}" to "${moversForm.to}" on ${moversForm.date}.`
            })
          });
        } catch (_) { }
      } else {
        toast.error('Failed to submit movers request');
      }
      setMoversForm({ from: '', to: '', date: '', size: '1BHK', notes: '' });
    } catch (e) {
      toast.error('Failed to submit movers request');
    } finally {
      setMoversSubmitting(false);
    }
  };

  if (pageLoading) {
    return <UserServicesSkeleton />;
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold">On-Demand Services</h1>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {services.map(s => (
          <button key={s.key} onClick={() => toggleService(s.key)} className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col items-center gap-2 hover:shadow-lg transition-colors ${selected.includes(s.key) ? 'ring-2 ring-blue-500' : ''}`}>
            {s.icon}
            <span className="text-sm font-semibold dark:text-white">{s.name}</span>
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 sm:p-5 transition-colors">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Request Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Preferred Date</label>
            <input type="date" className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={details.date} onChange={e => setDetails(d => ({ ...d, date: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Service Address</label>
            <input className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={details.address} onChange={e => setDetails(d => ({ ...d, address: e.target.value }))} placeholder="Address" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Notes</label>
            <textarea className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3} value={details.notes} onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))} placeholder="Describe the issue" />
          </div>

          {/* Service Redemption UI */}
          <div className="md:col-span-2 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700/50 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                <FaCoins className={`text-yellow-600 dark:text-yellow-500 ${coinsToRedeem > 0 ? 'animate-bounce' : ''}`} /> Redeem SetuCoins
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">Balance: {coinBalance}</span>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max={Math.min(coinBalance, 500)} // Cap at 500 for safety or user limit
                step="10"
                value={coinsToRedeem}
                onChange={(e) => setCoinsToRedeem(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-bold min-w-[3rem] text-right dark:text-white">{coinsToRedeem}</span>
            </div>

            {coinsToRedeem > 0 && (
              <div className="mt-2 text-xs text-green-700 dark:text-green-400 font-medium">
                Discount applied: ₹{getCoinValue(coinsToRedeem, 'INR').toFixed(0)} OFF
              </div>
            )}
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{COIN_CONFIG.RATES.INR} Coins = ₹1 Discount</p>
          </div>
        </div>
        <button onClick={submit} disabled={loading} className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded disabled:opacity-60">{loading ? 'Submitting...' : 'Submit Request'}</button>
      </div>

      {/* Movers section merged below with clear separation */}
      <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white"><FaTruckMoving className="text-blue-600" /> Packers & Movers</h2>
        </div>
        <form onSubmit={submitMovers} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 sm:p-5 space-y-4 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">From Address</label>
              <input className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={moversForm.from} onChange={e => setMoversForm(f => ({ ...f, from: e.target.value }))} placeholder="Pickup address" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">To Address</label>
              <input className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={moversForm.to} onChange={e => setMoversForm(f => ({ ...f, to: e.target.value }))} placeholder="Drop address" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Move Date</label>
              <div className="flex items-center gap-2">
                <FaCalendarAlt className="text-gray-500" />
                <input type="date" className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={moversForm.date} onChange={e => setMoversForm(f => ({ ...f, date: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Home Size</label>
              <select className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={moversForm.size} onChange={e => setMoversForm(f => ({ ...f, size: e.target.value }))}>
                {['1RK', '1BHK', '2BHK', '3BHK', 'Villa', 'Office'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Notes</label>
            <textarea className="w-full border rounded p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3} value={moversForm.notes} onChange={e => setMoversForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details" />
          </div>

          {/* Movers Redemption UI */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700/50 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                <FaCoins className={`text-yellow-600 dark:text-yellow-500 ${coinsToRedeemMovers > 0 ? 'animate-bounce' : ''}`} /> Redeem SetuCoins
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">Balance: {coinBalance}</span>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max={Math.min(coinBalance, 2000)} // Higher cap for Movers
                step="50"
                value={coinsToRedeemMovers}
                onChange={(e) => setCoinsToRedeemMovers(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-bold min-w-[3rem] text-right dark:text-white">{coinsToRedeemMovers}</span>
            </div>

            {coinsToRedeemMovers > 0 && (
              <div className="mt-2 text-xs text-green-700 dark:text-green-400 font-medium">
                Discount applied: ₹{getCoinValue(coinsToRedeemMovers, 'INR').toFixed(0)} OFF
              </div>
            )}
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{COIN_CONFIG.RATES.INR} Coins = ₹1 Discount</p>
          </div>
          <button disabled={moversSubmitting} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded hover:from-blue-700 hover:to-purple-700 disabled:opacity-50">{moversSubmitting ? 'Submitting...' : 'Request Quote'}</button>
        </form>
        <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"><FaMapMarkerAlt /> Service available in major cities.</div>
        {currentUser && (
          <div className="mt-6 sm:mt-8 bg-white dark:bg-gray-800 rounded-xl shadow p-4 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold dark:text-white">My Movers Requests</h3>
              <button onClick={fetchMyMoverRequests} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm dark:text-white">Refresh</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <input className="border rounded p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Search" value={moversFilters.q} onChange={e => setMoversFilters(f => ({ ...f, q: e.target.value }))} />
              <select className="border rounded p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={moversFilters.status} onChange={e => setMoversFilters(f => ({ ...f, status: e.target.value }))}>
                {['all', 'pending', 'in_progress', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm dark:text-white" onClick={() => setMoversFilters({ q: '', status: 'all' })}>Clear</button>
            </div>
            {myMoverRequests.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No requests yet.</p>
            ) : (
              <ul className="divide-y">
                {myMoverRequests.filter(req => {
                  const matchQ = moversFilters.q.trim() ? (
                    (req.fromAddress || '').toLowerCase().includes(moversFilters.q.toLowerCase()) ||
                    (req.toAddress || '').toLowerCase().includes(moversFilters.q.toLowerCase()) ||
                    (req.size || '').toLowerCase().includes(moversFilters.q.toLowerCase())
                  ) : true;
                  const matchStatus = moversFilters.status === 'all' ? true : req.status === moversFilters.status;
                  return matchQ && matchStatus;
                }).map(req => (
                  <li key={req._id} className="py-2 border-b dark:border-gray-700 last:border-b-0">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(req.createdAt).toLocaleString()} — <span className={`px-2 py-0.5 rounded text-white text-[10px] ${req.status === 'completed' ? 'bg-green-600' : req.status === 'in_progress' ? 'bg-blue-600' : (req.status === 'pending_payment' || req.status === 'awaiting_payment') ? 'bg-yellow-500' : req.status === 'cancelled' ? 'bg-gray-500' : 'bg-orange-500'}`}>{req.status.replace('_', ' ')}</span></div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">From: {req.fromAddress}</div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">To: {req.toAddress}</div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">Date: {req.moveDate}</div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">Size: {req.size}</div>
                    {req.notes && (<div className="text-sm text-gray-700 dark:text-gray-300">Notes: {req.notes}</div>)}
                    {(req.status === 'pending_payment' || req.status === 'awaiting_payment') && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-center justify-between">
                        <span>Payment of ₹{req.amount} is required to confirm this movers booking.</span>
                        <button
                          onClick={() => {
                            setPaymentRequestData({
                              requestId: req._id,
                              type: 'movers',
                              amount: req.amount,
                              address: `${req.fromAddress} to ${req.toAddress}`,
                              date: req.moveDate
                            });
                            setShowPaymentModal(true);
                          }}
                          className="bg-yellow-600 text-white px-3 py-1 rounded-md font-bold hover:bg-yellow-700"
                        >
                          Pay Now
                        </button>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      {req.status === 'pending' && (
                        <button onClick={async () => { try { await authenticatedFetch(`${API_BASE_URL}/api/requests/movers/${req._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); toast.success('Movers request cancelled'); fetchMyMoverRequests(); } catch (_) { toast.error('Failed to cancel'); } }} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-300">Cancel</button>
                      )}
                      {req.status === 'cancelled' && (req.reinitiateCount ?? 0) < 2 && (
                        <button onClick={async () => { try { const r = await authenticatedFetch(`${API_BASE_URL}/api/requests/movers/${req._id}/reinitiate`, { method: 'POST' }); const data = await r.json(); if (r.ok) { toast.success('Movers request re-initiated'); fetchMyMoverRequests(); } else { toast.error(data.message || 'Failed to reinitiate'); } } catch (_) { toast.error('Failed to reinitiate'); } }} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Re-initiate ({2 - (req.reinitiateCount || 0)} left)</button>
                      )}
                      <button onClick={() => {
                        setConfirmationModal({
                          open: true,
                          title: 'Delete Movers Request?',
                          message: 'Are you sure you want to delete this movers request permanently? This action cannot be undone.',
                          isDestructive: true,
                          onConfirm: async () => {
                            try {
                              const r = await authenticatedFetch(`${API_BASE_URL}/api/requests/movers/${req._id}`, { method: 'DELETE' });
                              if (r.ok) {
                                toast.success('Deleted');
                                setMyMoverRequests(prev => prev.filter(x => x._id !== req._id));
                              } else {
                                const d = await r.json();
                                toast.error(d.message || 'Delete failed');
                              }
                            } catch (_) {
                              toast.error('Delete failed');
                            }
                            setConfirmationModal(prev => ({ ...prev, open: false }));
                          }
                        });
                      }} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {/* Move-In/Move-Out Checklists Section */}
      {currentUser && (
        <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
              <FaHome className="text-green-600" /> Move-In/Move-Out Checklists
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Manage property condition checklists for your rental contracts. Upload images/videos at move-in and move-out to document property condition.
          </p>

          {myContracts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center transition-colors">
              <FaHome className="mx-auto text-4xl text-gray-400 mb-2" />
              <p className="text-gray-600 dark:text-gray-400">No rental contracts found.</p>
              <Link to="/user/rental-contracts" className="text-blue-600 hover:underline mt-2 inline-block">
                View all rental contracts
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <input
                  className="border rounded p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Search by property name"
                  value={checklistFilters.q}
                  onChange={(e) => setChecklistFilters(f => ({ ...f, q: e.target.value }))}
                />
                <select
                  className="border rounded p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={checklistFilters.status}
                  onChange={(e) => setChecklistFilters(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Contracts</option>
                  <option value="expired">Expired</option>
                </select>
                <button
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded text-sm"
                  onClick={() => setChecklistFilters({ q: '', status: 'all' })}
                >
                  Clear
                </button>
              </div>

              <div className="space-y-3">
                {myContracts
                  .filter(contract => {
                    const matchQ = checklistFilters.q.trim()
                      ? (contract.listingId?.name || '').toLowerCase().includes(checklistFilters.q.toLowerCase())
                      : true;
                    const matchStatus = checklistFilters.status === 'all'
                      ? true
                      : checklistFilters.status === 'active'
                        ? contract.status === 'active'
                        : contract.status === 'expired';
                    return matchQ && matchStatus;
                  })
                  .map(contract => (
                    <div key={contract._id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg dark:text-white">{contract.listingId?.name || 'Property'}</h3>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <div>Contract ID: {contract.contractId}</div>
                            <div>Rent: ₹{contract.lockedRentAmount?.toLocaleString()}/month</div>
                            <div>Period: {new Date(contract.startDate).toLocaleDateString()} - {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'Ongoing'}</div>
                            <div className={`inline-block px-2 py-1 rounded text-xs mt-1 ${contract.status === 'active' ? 'bg-green-100 text-green-800' :
                              contract.status === 'expired' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                              {contract.status}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          {/* Only show Move-In/Move-Out buttons for tenants */}
                          {(contract.tenantId?._id === currentUser?._id || contract.tenantId === currentUser?._id) && (
                            <>
                              <button
                                onClick={async () => {
                                  setSelectedContract(contract);
                                  await fetchChecklists(contract._id);
                                  setChecklistType('move_in');
                                  setShowChecklistModal(true);
                                }}
                                className="px-3 py-1.5 bg-blue-50 border border-blue-300 rounded text-sm text-blue-700 hover:bg-blue-100 flex items-center gap-1"
                              >
                                <FaSignInAlt /> Move-In
                              </button>
                              <button
                                onClick={async () => {
                                  setSelectedContract(contract);
                                  await fetchChecklists(contract._id);
                                  setChecklistType('move_out');
                                  setShowChecklistModal(true);
                                }}
                                className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700/50 rounded text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-800/50 flex items-center gap-1"
                              >
                                <FaSignOutAlt /> Move-Out
                              </button>
                              <Link
                                to={`/user/rental-contracts?contractId=${contract._id}`}
                                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                              >
                                View Contract
                              </Link>
                            </>
                          )}

                          {/* Landlord Actions */}
                          {(contract.landlordId?._id === currentUser?._id || contract.landlordId === currentUser?._id) && (
                            <button
                              onClick={async () => {
                                setSelectedContract(contract);
                                const result = await fetchChecklists(contract._id);
                                if (result) {
                                  setShowSelectionModal(true);
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-50 border border-blue-300 rounded text-sm text-blue-700 hover:bg-blue-100 flex items-center gap-1"
                            >
                              View / Approve
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Quick status */}
                      <div className="mt-3 flex gap-4 text-xs">
                        {contract.moveInStatus ? (
                          <span className={`flex items-center gap-1 ${contract.moveInStatus === 'approved' || contract.moveInStatus === 'completed' ? 'text-green-600' :
                            contract.moveInStatus === 'pending_approval' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                            {contract.moveInStatus === 'approved' || contract.moveInStatus === 'completed' ? <FaCheckCircle /> :
                              contract.moveInStatus === 'pending_approval' ? <FaClock /> :
                                <FaTimesCircle />}
                            Move-In: {contract.moveInStatus.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 opacity-70 italic">
                            <FaClock className="text-[10px]" /> Move-In: Not started
                          </span>
                        )}
                        {contract.moveOutStatus ? (
                          <span className={`flex items-center gap-1 ${contract.moveOutStatus === 'completed' || contract.moveOutStatus === 'approved' ? 'text-green-600' :
                            contract.moveOutStatus === 'pending_approval' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                            {contract.moveOutStatus === 'completed' || contract.moveOutStatus === 'approved' ? <FaCheckCircle /> :
                              contract.moveOutStatus === 'pending_approval' ? <FaClock /> :
                                <FaTimesCircle />}
                            Move-Out: {contract.moveOutStatus.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 opacity-70 italic">
                            <FaClock className="text-[10px]" /> Move-Out: Not started
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Checklist Selection Modal (Landlord) */}
      {showSelectionModal && selectedContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold dark:text-white">Checklist Approvals</h3>
                <button
                  onClick={() => { setShowSelectionModal(false); setSelectedContract(null); }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-xl"
                >
                  ×
                </button>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">Select a checklist to review and approve.</p>

              <div className="space-y-4">
                {/* Move-In */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><FaSignInAlt /></div>
                    <div>
                      <div className="font-semibold dark:text-white">Move-In Checklist</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {checklists.moveIn
                          ? (checklists.moveIn.status === 'approved' ? 'Approved' : 'Pending Approval')
                          : 'Not Started'}
                      </div>
                    </div>
                  </div>
                  {checklists.moveIn ? (
                    <button
                      onClick={() => {
                        setShowSelectionModal(false);
                        setChecklistType('move_in');
                        setShowChecklistModal(true);
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </div>

                {/* Move-Out */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-full"><FaSignOutAlt /></div>
                    <div>
                      <div className="font-semibold dark:text-white">Move-Out Checklist</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {checklists.moveOut
                          ? (checklists.moveOut.status === 'approved' ? 'Approved' : 'Pending Approval')
                          : 'Not Started'}
                      </div>
                    </div>
                  </div>
                  {checklists.moveOut ? (
                    <button
                      onClick={() => {
                        setShowSelectionModal(false);
                        setChecklistType('move_out');
                        setShowChecklistModal(true);
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowSelectionModal(false); setSelectedContract(null); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklistModal && selectedContract && (
        <ChecklistModal
          contract={selectedContract}
          checklist={checklists[checklistType === 'move_in' ? 'moveIn' : 'moveOut']}
          checklistType={checklistType}
          onClose={() => {
            setShowChecklistModal(false);
            setSelectedContract(null);
            setChecklists({ moveIn: null, moveOut: null });
            // Clean up URL if it has checklist params
            const searchParams = new URLSearchParams(location.search);
            if (searchParams.get('contractId') || searchParams.get('checklist')) {
              navigate('/user/services', { replace: true });
            }
          }}
          onUpdate={async () => {
            await fetchChecklists(selectedContract._id);
            fetchMyContracts();
          }}
        />
      )}

      {/* My Requests */}
      {currentUser && (
        <div className="mt-6 sm:mt-8 bg-white dark:bg-gray-800 rounded-xl shadow p-4 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold dark:text-white">My Service Requests</h3>
            <button onClick={fetchMyRequests} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm dark:text-white">Refresh</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input className="border rounded p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Search" value={serviceFilters.q} onChange={e => setServiceFilters(f => ({ ...f, q: e.target.value }))} />
            <select className="border rounded p-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={serviceFilters.status} onChange={e => setServiceFilters(f => ({ ...f, status: e.target.value }))}>
              {['all', 'pending', 'in_progress', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="px-3 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded text-sm" onClick={() => setServiceFilters({ q: '', status: 'all' })}>Clear</button>
          </div>
          {myRequests.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No requests yet.</p>
          ) : (
            <ul className="divide-y">
              {myRequests.filter(req => {
                const matchQ = serviceFilters.q.trim() ? (
                  (req.address || '').toLowerCase().includes(serviceFilters.q.toLowerCase()) ||
                  (Array.isArray(req.services) ? req.services.join(', ') : '').toLowerCase().includes(serviceFilters.q.toLowerCase())
                ) : true;
                const matchStatus = serviceFilters.status === 'all' ? true : req.status === serviceFilters.status;
                return matchQ && matchStatus;
              }).map(req => (
                <li key={req._id} className="py-2 border-b dark:border-gray-700 last:border-b-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(req.createdAt).toLocaleString()} — <span className={`px-2 py-0.5 rounded text-white text-[10px] ${req.status === 'completed' ? 'bg-green-600' : req.status === 'in_progress' ? 'bg-blue-600' : (req.status === 'pending_payment' || req.status === 'awaiting_payment') ? 'bg-yellow-500' : req.status === 'cancelled' ? 'bg-gray-500' : 'bg-orange-500'}`}>{req.status.replace('_', ' ')}</span></div>
                  <div className="text-sm text-gray-800 dark:text-gray-200">Services: {req.services?.join(', ')}</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200">Date: {req.preferredDate}</div>
                  <div className="text-sm text-gray-800 dark:text-gray-200">Address: {req.address}</div>
                  {req.notes && (<div className="text-sm text-gray-700 dark:text-gray-300">Notes: {req.notes}</div>)}
                  {(req.status === 'pending_payment' || req.status === 'awaiting_payment') && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded text-xs text-yellow-800 dark:text-yellow-200 flex items-center justify-between">
                      <span>Payment of ₹{req.amount} is required to confirm this booking.</span>
                      <button
                        onClick={() => {
                          setPaymentRequestData({
                            requestId: req._id,
                            type: 'service',
                            amount: req.amount,
                            address: req.address,
                            date: req.preferredDate
                          });
                          setShowPaymentModal(true);
                        }}
                        className="bg-yellow-600 text-white px-3 py-1 rounded-md font-bold hover:bg-yellow-700"
                      >
                        Pay Now
                      </button>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {req.status === 'pending' && (
                      <button onClick={async () => { try { await authenticatedFetch(`${API_BASE_URL}/api/requests/services/${req._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); toast.success('Service request cancelled'); fetchMyRequests(); } catch (_) { toast.error('Failed to cancel'); } }} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                    )}
                    {req.status === 'cancelled' && (req.reinitiateCount ?? 0) < 2 && (
                      <button onClick={async () => { try { const r = await authenticatedFetch(`${API_BASE_URL}/api/requests/services/${req._id}/reinitiate`, { method: 'POST' }); const data = await r.json(); if (r.ok) { toast.success('Service request re-initiated'); fetchMyRequests(); } else { toast.error(data.message || 'Failed to reinitiate'); } } catch (_) { toast.error('Failed to reinitiate'); } }} className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50">Re-initiate ({2 - (req.reinitiateCount || 0)} left)</button>
                    )}
                    <button onClick={() => {
                      setConfirmationModal({
                        open: true,
                        title: 'Delete Service Request?',
                        message: 'Are you sure you want to delete this service request permanently? This action cannot be undone.',
                        isDestructive: true,
                        onConfirm: async () => {
                          try {
                            const r = await authenticatedFetch(`${API_BASE_URL}/api/requests/services/${req._id}`, { method: 'DELETE' });
                            if (r.ok) {
                              toast.success('Deleted');
                              setMyRequests(prev => prev.filter(x => x._id !== req._id));
                            } else {
                              const d = await r.json();
                              toast.error(d.message || 'Delete failed');
                            }
                          } catch (_) {
                            toast.error('Delete failed');
                          }
                          setConfirmationModal(prev => ({ ...prev, open: false }));
                        }
                      });
                    }} className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* Payment Modal */}
      {showPaymentModal && paymentRequestData && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); setPaymentRequestData(null); }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setPaymentRequestData(null);
            setShowCoinBurst(true); // Trigger delight!
            toast.success("Payment Received & Request Confirmed!");
            fetchMyRequests();
            fetchMyMoverRequests();
            fetchCoinBalance();
            setSelected([]);
            setDetails({ date: '', address: '', notes: '' });
            setMoversForm({ from: '', to: '', date: '', size: '1BHK', notes: '' });
          }}
          // Mock appointment object for display compatibility
          appointment={{
            _id: paymentRequestData.requestId, // Hack for ID
            propertyName: paymentRequestData.type === 'movers' ? 'Movers Booking' : 'Service Booking',
            date: paymentRequestData.date,
            address: paymentRequestData.address,
            amount: paymentRequestData.amount, // Explicit amount handling in Modal needed or assumed
            listingId: {
              name: paymentRequestData.type === 'movers' ? 'Packers & Movers' : 'On-Demand Service',
              address: paymentRequestData.address,
              imageUrls: ['https://cdn-icons-png.flaticon.com/512/1067/1067566.png']
            }
          }}
          // Custom props for service payment
          isServicePayment={true}
          servicePaymentDetails={paymentRequestData}
        />
      )}

      {/* Celebration! */}
      <SetuCoinParticles
        active={showCoinBurst}
        onComplete={() => setShowCoinBurst(false)}
        count={20}
      />

      {/* Checklist Modal */}
      {showChecklistModal && selectedContract && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full relative transition-colors max-h-[90vh] flex flex-col">
              <ChecklistModal
                contract={selectedContract}
                checklist={checklistType === 'move_in' ? checklists.moveIn : checklists.moveOut}
                checklistType={checklistType}
                onClose={() => {
                  setShowChecklistModal(false);
                  setSelectedContract(null);
                }}
                onUpdate={() => {
                  fetchChecklists(selectedContract._id);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmationModal(prev => ({ ...prev, open: false }))}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmationModal.isDestructive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                {confirmationModal.isDestructive ? (
                  <FaTimesCircle className="text-red-600 dark:text-red-500 text-2xl" />
                ) : (
                  <FaCheckCircle className="text-blue-600 dark:text-blue-500 text-2xl" />
                )}
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{confirmationModal.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                {confirmationModal.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmationModal(prev => ({ ...prev, open: false }))}
                  className="flex-1 py-2.5 rounded-xl font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmationModal.onConfirm}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-colors shadow-lg ${confirmationModal.isDestructive
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30 dark:bg-red-600 dark:hover:bg-red-500'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 dark:bg-blue-600 dark:hover:bg-blue-500'
                    }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

