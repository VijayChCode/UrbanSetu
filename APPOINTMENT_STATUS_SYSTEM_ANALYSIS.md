# Appointment Status System Analysis

## Overview
The MyAppointments page implements a comprehensive appointment status management system that allows users to track, filter, and manage appointments based on their current status. The system supports multiple statuses, role-based permissions, and various actions depending on the appointment state.

## Appointment Statuses

### 1. **Core Statuses**
- **`pending`** - Initial status when appointment is created, waiting for seller response
- **`accepted`** - Seller has approved the appointment
- **`rejected`** - Seller has rejected the appointment
- **`completed`** - Appointment has been successfully completed
- **`noShow`** - One or both parties didn't show up

### 2. **Cancellation Statuses**
- **`cancelledByBuyer`** - Buyer cancelled the appointment
- **`cancelledBySeller`** - Seller cancelled the appointment  
- **`cancelledByAdmin`** - Admin cancelled the appointment

### 3. **Administrative Statuses**
- **`deletedByAdmin`** - Admin permanently deleted the appointment
- **`outdated`** - Special filter for appointments past their scheduled date/time

## Status Filter Implementation

### Filter Dropdown
```javascript
<select
  className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm"
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
>
  <option value="all">All Appointments</option>
  <option value="pending">Pending</option>
  <option value="accepted">Accepted</option>
  <option value="rejected">Rejected</option>
  <option value="cancelledByBuyer">Cancelled by Buyer</option>
  <option value="cancelledBySeller">Cancelled by Seller</option>
  <option value="cancelledByAdmin">Cancelled by Admin</option>
  <option value="deletedByAdmin">Deleted by Admin</option>
  <option value="completed">Completed</option>
  <option value="noShow">No Show</option>
  <option value="outdated">Outdated</option>
</select>
```

### Filtering Logic
```javascript
const filteredAppointments = appointments.filter((appt) => {
  // Check visibility permissions
  if (currentUser._id === appt.buyerId?._id?.toString() && appt.visibleToBuyer === false) return false;
  if (currentUser._id === appt.sellerId?._id?.toString() && appt.visibleToSeller === false) return false;
  
  // Check if appointment is outdated
  const isOutdated = new Date(appt.date) < new Date() || 
    (new Date(appt.date).toDateString() === new Date().toDateString() && 
     appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  
  // Handle outdated filter
  if (statusFilter === 'outdated') {
    return isOutdated;
  }
  
  // Apply status filter
  const matchesStatus = statusFilter === "all" ? true : appt.status === statusFilter;
  const matchesRole = roleFilter === "all" ? true : appt.role === roleFilter;
  const matchesSearch = /* search logic */;
  const matchesDate = /* date range logic */;
  
  return matchesStatus && matchesRole && matchesSearch && matchesDate;
});
```

## Status-Based Visual Representation

### Status Color Coding
```javascript
const getStatusColor = (status) => {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-700";
    case "accepted": return "bg-green-100 text-green-700";
    case "rejected": return "bg-red-100 text-red-700";
    case "cancelledByBuyer": return "bg-orange-100 text-orange-700";
    case "cancelledBySeller": return "bg-pink-100 text-pink-700";
    case "cancelledByAdmin": return "bg-purple-100 text-purple-700";
    default: return "bg-gray-100 text-gray-700";
  }
};
```

### Status Display
```javascript
<span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(appt.status)}`}>
  {appt.status === "cancelledByBuyer"
    ? "Cancelled by Buyer"
    : appt.status === "cancelledBySeller"
    ? "Cancelled by Seller"
    : appt.status === "cancelledByAdmin"
    ? "Cancelled by Admin"
    : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
</span>
```

## Status-Based Actions

### 1. **Seller Actions (Pending Appointments)**
```javascript
{isSeller && appt.status === "pending" && (
  <>
    <button onClick={() => handleStatusUpdate(appt._id, "accepted")}>
      <FaCheck /> {/* Accept */}
    </button>
    <button onClick={() => handleStatusUpdate(appt._id, "rejected")}>
      <FaTimes /> {/* Reject */}
    </button>
  </>
)}
```

### 2. **Seller Actions (Accepted Appointments)**
```javascript
{isSeller && appt.status === "accepted" && (
  <button onClick={handleUserCancel} title="Cancel Appointment (Seller)">
    <FaTrash />
  </button>
)}
```

### 3. **Buyer Actions**
```javascript
{isBuyer && (appt.status === "pending" || appt.status === "accepted") && (
  <button onClick={handleUserCancel} title="Cancel Appointment (Buyer)">
    <FaTrash />
  </button>
)}
```

### 4. **Reinitiation Actions**
```javascript
{((appt.status === 'cancelledByBuyer' && isBuyer) || 
  (appt.status === 'cancelledBySeller' && isSeller)) && (
  <button onClick={() => onOpenReinitiate(appt)}>
    Reinitiate
  </button>
)}
```

## Status Update Functionality

### API Call
```javascript
const handleStatusUpdate = async (id, status) => {
  setActionLoading(id + status);
  try {
    const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${id}/status`, 
      { status },
      { 
        withCredentials: true,
        headers: { "Content-Type": "application/json" }
      }
    );
    
    // Update local state
    setAppointments((prev) =>
      prev.map((appt) => (appt._id === id ? { ...appt, status } : appt))
    );
    
    // Show success message
    const statusText = status === "accepted" ? "accepted" : "rejected";
    toast.success(`Appointment ${statusText} successfully! ${status === "accepted" ? "Contact information is now visible to both parties." : ""}`);
    
    navigate("/user/my-appointments");
  } catch (err) {
    if (err.response?.status === 401) {
      toast.error("Session expired or unauthorized. Please sign in again.");
      navigate("/sign-in");
      return;
    }
    toast.error(err.response?.data?.message || "Failed to update appointment status.");
  }
  setActionLoading("");
};
```

## Status-Based Permissions

### Chat Access
```javascript
const isChatDisabled = !isUpcoming || 
  appt.status === 'pending' || 
  appt.status === 'rejected' || 
  appt.status === 'cancelledByAdmin';
```

### Contact Information Visibility
```javascript
const canSeeContactInfo = (isAdmin || appt.status === 'accepted') && isUpcoming &&
  appt.status !== 'cancelledByBuyer' && 
  appt.status !== 'cancelledBySeller' &&
  appt.status !== 'cancelledByAdmin' && 
  appt.status !== 'rejected' &&
  appt.status !== 'deletedByAdmin';
```

## Reinitiation System

### Reinitiation Logic
```javascript
const handleReinitiateSubmit = async (e) => {
  e.preventDefault();
  if (!reinitiateData) return;
  
  const isBuyer = currentUser && (reinitiateData.buyerId?._id === currentUser._id || reinitiateData.buyerId === currentUser._id);
  const isSeller = currentUser && (reinitiateData.sellerId?._id === currentUser._id || reinitiateData.sellerId === currentUser._id);
  const count = isBuyer ? (reinitiateData.buyerReinitiationCount || 0) : (reinitiateData.sellerReinitiationCount || 0);
  
  // Check reinitiation limit (max 2 per role)
  if (count >= 2) {
    toast.error('You have reached the maximum number of reinitiations for your role.');
    return;
  }
  
  const payload = {
    ...reinitiateData,
    status: 'pending', // Reset to pending status
  };
  
  // API call to reinitiate
  const { data } = await axios.post(`${API_BASE_URL}/api/bookings/reinitiate`, payload, { withCredentials: true });
};
```

## Archive System

### Archive Functionality
```javascript
const handleArchiveAppointment = async (id) => {
  setAppointmentToHandle(id);
  setShowArchiveModal(true);
};

const confirmArchive = async () => {
  try {
    const { data } = await axios.patch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/archive`, {}, { withCredentials: true });
    
    const archivedAppt = appointments.find(appt => appt._id === appointmentToHandle);
    if (archivedAppt) {
      // Move from active to archived
      setAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
      setArchivedAppointments((prev) => [{ ...archivedAppt, archivedAt: new Date() }, ...prev]);
    }
    
    toast.success("Appointment archived successfully.");
  } catch (err) {
    toast.error("Failed to archive appointment.");
  }
};
```

## Status Flow Diagram

```
Appointment Created
       ↓
    PENDING ←→ ACCEPTED ←→ COMPLETED
       ↓           ↓
   REJECTED    CANCELLED
       ↓           ↓
   ARCHIVED    ARCHIVED
```

## Key Features

### 1. **Multi-Dimensional Filtering**
- Status-based filtering
- Role-based filtering (buyer/seller)
- Date range filtering
- Search functionality
- Outdated appointment detection

### 2. **Role-Based Actions**
- **Buyers**: Can cancel pending/accepted appointments, reinitiate cancelled ones
- **Sellers**: Can accept/reject pending appointments, cancel accepted ones
- **Admins**: Can cancel any appointment, delete appointments

### 3. **Status Transitions**
- Pending → Accepted/Rejected
- Accepted → Cancelled/Completed
- Any status → Archived
- Cancelled → Reinitiated (pending)

### 4. **Reinitiation Limits**
- Maximum 2 reinitiations per role per appointment
- Prevents abuse of the reinitiation system

### 5. **Real-Time Updates**
- Socket.io integration for live status updates
- Immediate UI updates after status changes
- Toast notifications for user feedback

## Security Features

### 1. **Visibility Controls**
- `visibleToBuyer` and `visibleToSeller` flags
- Role-based appointment visibility
- Admin oversight capabilities

### 2. **Action Validation**
- Status-based action permissions
- Role-based action restrictions
- Reinitiation count limits

### 3. **Session Management**
- Authentication checks for all status updates
- Automatic redirect on session expiry
- Secure API endpoints with credentials

## Conclusion

The appointment status system provides a robust, role-based workflow for managing property appointments. It supports complex business logic including:

- **Multi-party coordination** between buyers and sellers
- **Flexible status management** with clear visual indicators
- **Comprehensive filtering** for efficient appointment tracking
- **Reinitiation capabilities** for handling cancellations
- **Archive system** for long-term record keeping
- **Real-time updates** for seamless user experience

The system ensures that users can only perform actions appropriate to their role and the current appointment status, maintaining data integrity and providing a smooth user experience.