import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FaUser, FaUserShield, FaEnvelope, FaCalendarAlt, FaCheckCircle, FaBan, FaTrash, FaUserLock, FaPhone, FaList, FaCalendar, FaArrowDown } from "react-icons/fa";

export default function AdminManagement() {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");
  const [suspendError, setSuspendError] = useState({});
  const [showRestriction, setShowRestriction] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountStats, setAccountStats] = useState({ listings: 0, appointments: 0 });

  useEffect(() => {
    if (!currentUser) return;
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const userRes = await fetch("/api/admin/management/users", { credentials: "include" });
      const userData = await userRes.json();
      setUsers(userData);
      // Fetch admins if default admin
      if (currentUser.isDefaultAdmin) {
        const adminRes = await fetch("/api/admin/management/admins", { credentials: "include" });
        const adminData = await adminRes.json();
        setAdmins(adminData);
      }
    } catch (err) {
      toast.error("Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (id, type) => {
    try {
      const res = await fetch(`/api/admin/management/suspend/${type}/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "user" ? "User" : "Admin"} status updated`);
        setSuspendError((prev) => ({ ...prev, [id]: undefined }));
        fetchData();
      } else {
        toast.error(data.message || "Failed to update status");
        setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be deleted or moved" }));
        setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
      }
    } catch (err) {
      toast.error("Failed to update status");
      setSuspendError((prev) => ({ ...prev, [id]: "Can't able to suspend account, may be deleted or moved" }));
      setTimeout(() => setSuspendError((prev) => ({ ...prev, [id]: undefined })), 4000);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const res = await fetch(`/api/admin/management/delete/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "user" ? "User" : "Admin"} deleted`);
        fetchData();
      } else {
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleAccountClick = async (account, type) => {
    setShowAccountModal(true);
    setAccountLoading(true);
    setSelectedAccount(null);
    setAccountStats({ listings: 0, appointments: 0 });
    try {
      // Fetch full user/admin details
      const res = await fetch(`/api/user/id/${account._id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedAccount({ ...data, type });
        // Fetch stats
        const [listingsRes, appointmentsRes] = await Promise.all([
          fetch(`/api/listing/user/${account._id}`, { credentials: 'include' }),
          fetch(`/api/bookings/user/${account._id}`, { credentials: 'include' })
        ]);
        const listingsData = await listingsRes.json();
        const appointmentsData = await appointmentsRes.json();
        setAccountStats({
          listings: Array.isArray(listingsData) ? listingsData.length : 0,
          appointments: Array.isArray(appointmentsData) ? appointmentsData.length : 0
        });
      } else {
        setSelectedAccount(null);
      }
    } catch (e) {
      setSelectedAccount(null);
    }
    setAccountLoading(false);
  };

  const handleDemote = async (id) => {
    if (!window.confirm("Are you sure you want to demote this admin to a user?")) return;
    try {
      const res = await fetch(`/api/admin/management/demote/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Admin demoted to user successfully");
        fetchData();
      } else {
        toast.error(data.message || "Failed to demote admin");
      }
    } catch (err) {
      toast.error("Failed to demote admin");
    }
  };

  const handlePromote = async (id) => {
    if (!window.confirm("Are you sure you want to promote this user to admin?")) return;
    try {
      const res = await fetch(`/api/admin/management/promote/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("User promoted to admin successfully");
        fetchData();
      } else {
        toast.error(data.message || "Failed to promote user");
      }
    } catch (err) {
      toast.error("Failed to promote user");
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 py-10 px-2 md:px-8 animate-fadeIn">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl p-8 animate-slideUp">
        <h1 className="text-4xl font-extrabold text-blue-700 mb-8 drop-shadow animate-fade-in">Accounts Management</h1>
        <div className="flex gap-4 mb-8 animate-fadeIn">
          <button
            className={`px-6 py-3 rounded-xl font-bold text-lg shadow transition-all duration-200 ${tab === "users" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 text-gray-700 hover:bg-blue-50"}`}
            onClick={() => {
              setTab("users");
              setShowRestriction(false);
            }}
          >
            Users
          </button>
          <button
            className={`px-6 py-3 rounded-xl font-bold text-lg shadow transition-all duration-200 ${tab === "admins" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105" : "bg-gray-100 text-gray-700 hover:bg-purple-50"}`}
            onClick={() => {
              if (!currentUser.isDefaultAdmin) {
                setShowRestriction(true);
                setTab("admins");
              } else {
                setShowRestriction(false);
                setTab("admins");
              }
            }}
          >
            Admins
          </button>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 animate-fadeIn">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-lg text-gray-500 font-semibold">Loading accounts...</p>
          </div>
        ) : (
          <>
            {(tab === "users") && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUser className="text-blue-500" /> Users
                </h2>
                {users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <FaUserLock className="text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No users found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {users.map((user) => (
                      <div
                        key={user._id}
                        className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl shadow-lg p-6 flex flex-col gap-4 hover:scale-105 transition-transform duration-200 animate-slideUp cursor-pointer"
                        onClick={() => handleAccountClick(user, 'user')}
                        title="Click to view full details"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center text-2xl font-bold text-blue-700 shadow-inner">
                            <FaUser />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-gray-800">{user.username}</span>
                              <span className={`text-xs px-2 py-1 rounded-full font-bold ${user.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{user.status}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                              <FaEnvelope /> {user.email}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                              <FaCalendarAlt /> {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-2">
                          <button
                            className={`flex-1 px-2 py-1 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${user.status === "active" ? "bg-yellow-400 text-white hover:bg-yellow-500" : "bg-green-500 text-white hover:bg-green-600"}`}
                            onClick={e => { e.stopPropagation(); handleSuspend(user._id, "user"); }}
                          >
                            {user.status === "active" ? <FaBan /> : <FaCheckCircle />}
                            {user.status === "active" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDelete(user._id, "user"); }}
                          >
                            <FaTrash /> Delete
                          </button>
                          {currentUser.isDefaultAdmin && (
                            <button
                              className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center justify-center gap-2"
                              onClick={e => { e.stopPropagation(); handlePromote(user._id); }}
                            >
                              <FaUserShield /> Promote to Admin
                            </button>
                          )}
                        </div>
                        {suspendError[user._id] && (
                          <div className="text-red-500 text-xs mt-2 animate-fadeIn">{suspendError[user._id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "admins" && !currentUser.isDefaultAdmin && showRestriction && (
              <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                <div className="text-6xl mb-4">🚫</div>
                <p className="text-red-500 text-lg font-medium">Only the current default admin can access admin account management.</p>
              </div>
            )}
            {tab === "admins" && currentUser.isDefaultAdmin && !showRestriction && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 animate-fadeIn">
                  <FaUserShield className="text-purple-500" /> Admins
                </h2>
                {admins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fadeIn">
                    <FaUserLock className="text-6xl text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No admins found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {admins.map((admin) => (
                      <div
                        key={admin._id}
                        className="bg-gradient-to-br from-purple-50 to-blue-100 rounded-2xl shadow-lg p-6 flex flex-col gap-4 hover:scale-105 transition-transform duration-200 animate-slideUp cursor-pointer"
                        onClick={() => handleAccountClick(admin, 'admin')}
                        title="Click to view full details"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center text-2xl font-bold text-purple-700 shadow-inner">
                            <FaUserShield />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-gray-800">{admin.username}</span>
                              <span className={`text-xs px-2 py-1 rounded-full font-bold ${admin.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{admin.status}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                              <FaEnvelope /> {admin.email}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                              <FaCalendarAlt /> {new Date(admin.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-2">
                          <button
                            className={`flex-1 px-2 py-1 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${admin.status === "active" ? "bg-yellow-400 text-white hover:bg-yellow-500" : "bg-green-500 text-white hover:bg-green-600"}`}
                            onClick={e => { e.stopPropagation(); handleSuspend(admin._id, "admin"); }}
                          >
                            {admin.status === "active" ? <FaBan /> : <FaCheckCircle />}
                            {admin.status === "active" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDelete(admin._id, "admin"); }}
                          >
                            <FaTrash /> Delete
                          </button>
                          <button
                            className="flex-1 px-2 py-1 rounded-lg font-semibold text-sm bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                            onClick={e => { e.stopPropagation(); handleDemote(admin._id); }}
                          >
                            <FaArrowDown /> Demote to User
                          </button>
                        </div>
                        {suspendError[admin._id] && (
                          <div className="text-red-500 text-xs mt-2 animate-fadeIn">{suspendError[admin._id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => setShowAccountModal(false)}
              title="Close"
            >
              &times;
            </button>
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>{selectedAccount?.type === 'admin' ? <FaUserShield className="text-purple-500" /> : <FaUser className="text-blue-500" />}</span>
              {selectedAccount?.username || 'User Details'}
            </h3>
            {accountLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedAccount ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 mb-2">
                  <img
                    src={selectedAccount.avatar || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}
                    alt="avatar"
                    className="w-16 h-16 rounded-full border shadow object-cover"
                  />
                  <div>
                    <div className="font-bold text-lg">{selectedAccount.username}</div>
                    <div className="text-gray-500 text-sm">{selectedAccount.email}</div>
                  </div>
                </div>
                <p><strong>Mobile Number:</strong> {selectedAccount.mobileNumber || 'Not provided'}</p>
                <p><strong>Role:</strong> {selectedAccount.role}</p>
                <p><strong>Status:</strong> {selectedAccount.status || 'active'}</p>
                {selectedAccount.type === 'admin' && (
                  <>
                    <p><strong>Admin Status:</strong> {selectedAccount.adminApprovalStatus}</p>
                    <p><strong>Admin Approval Date:</strong> {selectedAccount.adminApprovalDate ? new Date(selectedAccount.adminApprovalDate).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Approved By:</strong> {selectedAccount.approvedBy ? selectedAccount.approvedBy.username || selectedAccount.approvedBy.email || selectedAccount.approvedBy : 'N/A'}</p>
                    <p><strong>Admin Request Date:</strong> {selectedAccount.adminRequestDate ? new Date(selectedAccount.adminRequestDate).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Is Default Admin:</strong> {selectedAccount.isDefaultAdmin ? 'Yes' : 'No'}</p>
                  </>
                )}
                <p><strong>Member Since:</strong> {selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString() : ''}</p>
                <p><strong>Number of Listings:</strong> {accountStats.listings}</p>
                <p><strong>Number of Appointments:</strong> {accountStats.appointments}</p>
                {/* Add more crucial details as needed */}
              </div>
            ) : (
              <p className="text-red-500">Failed to load details.</p>
            )}
            <button
              onClick={() => setShowAccountModal(false)}
              className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.4,0,0.2,1); }
      `}</style>
    </div>
  );
} 