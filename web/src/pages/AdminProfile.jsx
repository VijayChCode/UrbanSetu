import React from "react";
import Profile from "./Profile";

import { usePageTitle } from '../hooks/usePageTitle';
export default function AdminProfile() {
  // Set page title
  usePageTitle("Admin Profile - Account Settings");

  return <Profile />;
}
