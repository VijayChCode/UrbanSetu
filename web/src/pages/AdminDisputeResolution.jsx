import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaExclamationTriangle, FaSearch, FaFilter, FaTimes, FaFileAlt, FaComments, FaCheckCircle, FaClock, FaGavel, FaUser, FaPaperclip, FaImage, FaVideo, FaFile, FaDownload, FaEdit, FaBan, FaEye, FaSync } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import DisputeDetail from '../components/dispute/DisputeDetail';
import AdminDisputesSkeleton from '../components/skeletons/AdminDisputesSkeleton';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const DISPUTE_CATEGORIES = {
  payment_issue: 'Payment Issue',
  property_maintenance: 'Property Maintenance',
  behavior: 'Behavior',
  contract_violation: 'Contract Violation',
  damage_assessment: 'Damage Assessment',
  early_termination: 'Early Termination',
  other: 'Other'
};

const DISPUTE_STATUS = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated'
};

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
};

export default function AdminDisputeResolution() {
  usePageTitle("Admin - Dispute Resolution - UrbanSetu");

  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();

  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDisputeDetail, setShowDisputeDetail] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all',
    search: ''
  });
  const [activeTab, setActiveTab] = useState('rental'); // 'rental' or 'sales'
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/sign-in');
      return;
    }

    // Check if user is admin or rootadmin
    if (currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
      toast.error('Access denied. Admin access required.');
      navigate('/user');
      return;
    }

    // Only fetch on initial load, not on filter changes
    if (disputes.length === 0) {
      fetchDisputes();
    }
  }, [currentUser, navigate]);

  const fetchDisputes = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      // Fetch all disputes, apply filters client-side
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/disputes`);

      const data = await res.json();
      if (res.ok && data.success) {
        setDisputes(data.disputes || []);
      } else {
        toast.error(data.message || 'Failed to fetch disputes');
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast.error('Failed to load disputes');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchDispute = async (disputeId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/disputes/${disputeId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        return data.dispute;
      }
      return null;
    } catch (error) {
      console.error('Error fetching dispute:', error);
      return null;
    }
  };

  const handleViewDispute = async (dispute) => {
    const fullDispute = await fetchDispute(dispute._id);
    if (fullDispute) {
      setSelectedDispute(fullDispute);
      setShowDisputeDetail(true);
    }
  };

  const handleDisputeUpdated = () => {
    fetchDisputes();
    if (selectedDispute) {
      fetchDispute(selectedDispute._id).then(dispute => {
        if (dispute) {
          setSelectedDispute(dispute);
        }
      });
    }
  };

  const handleUpdateStatus = async (disputeId, status, priority, escalationReason) => {
    try {
      setUpdatingStatus(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/disputes/${disputeId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          priority,
          escalationReason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Dispute status updated');
        handleDisputeUpdated();
      } else {
        toast.error(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResolveDispute = async (disputeId, resolution, resolutionNotes) => {
    try {
      setResolving(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution,
          resolutionNotes
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Dispute resolved');
        handleDisputeUpdated();
      } else {
        toast.error(data.message || 'Failed to resolve dispute');
      }
    } catch (error) {
      console.error('Error resolving dispute:', error);
      toast.error('Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  };

  const filteredDisputes = disputes.filter(dispute => {
    // Tab Filter
    if (activeTab === 'rental' && !dispute.contractId) return false;
    if (activeTab === 'sales' && !dispute.bookingId) return false;

    const matchesSearch = filters.search === '' ||
      dispute.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
      dispute.disputeId?.toLowerCase().includes(filters.search.toLowerCase()) ||
      dispute.raisedBy?.username?.toLowerCase().includes(filters.search.toLowerCase()) ||
      dispute.raisedAgainst?.username?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesPriority = filters.priority === 'all' || dispute.priority === filters.priority;
    const matchesStatus = filters.status === 'all' || dispute.status === filters.status;
    const matchesCategory = filters.category === 'all' || dispute.category === filters.category;

    return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
      case 'escalated':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    return DISPUTE_STATUS[status] || status?.replace('_', ' ').toUpperCase() || 'UNKNOWN';
  };

  if (loading) {
    return <AdminDisputesSkeleton />;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 min-h-screen py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <FaGavel className="text-blue-600 dark:text-blue-400" />
                Admin - Dispute Resolution
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Manage and resolve all rental and sales disputes</p>
            </div>
            <button
              onClick={() => fetchDisputes(true)}
              className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors duration-200 self-end md:self-auto dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
              title="Refresh Disputes"
            >
              {loading ? <UrbanSetuSpinner size="sm" /> : <FaSync />}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              onClick={() => setActiveTab('rental')}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === 'rental'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              <FaFileAlt className={activeTab === 'rental' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} />
              Rental Disputes
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'rental' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                {disputes.filter(d => d.contractId).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === 'sales'
                ? 'border-b-2 border-green-600 text-green-600 dark:text-green-400 dark:border-green-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              <FaCheckCircle className={activeTab === 'sales' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} />
              Sales Disputes
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'sales' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                {disputes.filter(d => d.bookingId).length}
              </span>
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search disputes..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Status</option>
              {Object.entries(DISPUTE_STATUS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Categories</option>
              {Object.entries(DISPUTE_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Disputes</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{disputes.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Open</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {disputes.filter(d => d.status === 'open').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Under Review</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {disputes.filter(d => d.status === 'under_review').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Resolved</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {disputes.filter(d => d.status === 'resolved').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Escalated</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {disputes.filter(d => d.status === 'escalated').length}
            </p>
          </div>
        </div>

        {/* Disputes List */}
        {filteredDisputes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <FaExclamationTriangle className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Disputes Found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.status !== 'all' || filters.category !== 'all' || filters.priority !== 'all' || filters.search !== ''
                ? 'Try adjusting your filters'
                : 'No disputes have been raised yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes.map((dispute) => (
              <div
                key={dispute._id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 ${getStatusColor(dispute.status)}`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FaGavel className="text-2xl text-blue-600 dark:text-blue-400" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          {dispute.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {dispute.disputeId}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Category</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {DISPUTE_CATEGORIES[dispute.category] || dispute.category}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Status</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{getStatusLabel(dispute.status)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Priority</p>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${PRIORITY_COLORS[dispute.priority] || PRIORITY_COLORS.low}`}>
                          {dispute.priority?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Raised By</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {dispute.raisedBy?.username || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                      <p className="mb-1">
                        <strong>Against:</strong> {dispute.raisedAgainst?.username || 'Unknown'}
                      </p>
                      <p>
                        <strong>Created:</strong> {new Date(dispute.createdAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleViewDispute(dispute)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <FaEye /> View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dispute Detail Modal */}
        {showDisputeDetail && selectedDispute && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Dispute Details (Admin View)</h2>
                  <button
                    onClick={() => {
                      setShowDisputeDetail(false);
                      setSelectedDispute(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                  >
                    <FaTimes />
                  </button>
                </div>
                <DisputeDetail
                  dispute={selectedDispute}
                  currentUser={currentUser}
                  onUpdate={handleDisputeUpdated}
                  getStatusColor={getStatusColor}
                  DISPUTE_CATEGORIES={DISPUTE_CATEGORIES}
                  DISPUTE_STATUS={DISPUTE_STATUS}
                  PRIORITY_COLORS={PRIORITY_COLORS}
                  isAdmin={true}
                  onUpdateStatus={handleUpdateStatus}
                  onResolve={handleResolveDispute}
                  updatingStatus={updatingStatus}
                  resolving={resolving}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

