# Latest Updates - February 24, 2026

## UrbanSetu v1.1.0 – Release 🚀
Successfully generated split APKs for Android with 60% size reduction.

### Key Highlights:
1. **Notifications Center 2.0**: Advanced filtering and global search.
2. **Personalization**: Persistent Dark/Light mode theme.
3. **Smart Features**: One-tap location in Route Planner.
4. **Performance**: ABI Splitting (arm64 size ~36MB).

---

## Summary
Successfully implemented two major features:
1. **30-minute appointment time slots** (9 AM - 7 PM)
2. **Delete All Messages functionality** in support modals

---

## Update 1: 30-Minute Appointment Time Slots ✅

### Problem
Appointment booking forms were showing 1-hour intervals but requirement was to show 30-minute intervals.

### Solution
Updated time slot generation logic in both appointment booking pages to generate 21 slots covering 9:00 AM through 7:00 PM with 30-minute intervals.

### Files Modified
1. `web/src/components/Appointment.jsx` (Lines 257-268)
2. `web/src/pages/AdminAppointmentListing.jsx` (Lines 287-298)

### Time Slots Generated
9:00 AM, 9:30 AM, 10:00 AM, 10:30 AM, 11:00 AM, 11:30 AM, 12:00 PM, 12:30 PM, 1:00 PM, 1:30 PM, 2:00 PM, 2:30 PM, 3:00 PM, 3:30 PM, 4:00 PM, 4:30 PM, 5:00 PM, 5:30 PM, 6:00 PM, 6:30 PM, 7:00 PM

---

## Update 2: Delete All Messages Functionality ✅

### Problem
Users and admins could only delete individual messages. No bulk delete option was available.

### Solution
Added "Delete All" button in modal headers with confirmation dialog.

### Features
- Sequential deletion with error handling
- Updates local state immediately
- Confirmation modal before deletion
- Toast notifications for success/error
- Loading state during deletion
- Button appears only when messages exist

### Files Modified
1. `web/src/components/ContactSupport.jsx` - User messages
2. `web/src/components/AdminContactSupport.jsx` - Admin support messages

---

## Build Status
✅ Frontend Build: SUCCESS (40.98 seconds)
✅ All modules transformed successfully
✅ Ready for deployment
