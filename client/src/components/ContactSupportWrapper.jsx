import React from 'react';
import { useSelector } from 'react-redux';
import ContactSupport from './ContactSupport';
import AdminContactSupport from './AdminContactSupport';

export default function ContactSupportWrapper() {
  const { currentUser } = useSelector((state) => state.user);

  // Check if user is an approved admin or the default admin
  const isAdmin = currentUser && 
                  (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && 
                  (currentUser.adminApprovalStatus === 'approved' || currentUser.isDefaultAdmin);

  // Show admin contact support for approved admins or default admin, regular contact support for others
  return isAdmin ? <AdminContactSupport /> : <ContactSupport />;
} 