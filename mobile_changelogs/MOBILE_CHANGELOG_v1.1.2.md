# 📝 UrbanSetu v1.1.2 - Release Notes

*This version is currently in development. Changes and fixes will be added below as they are implemented.*

### 🚀 Upcoming Features
- **Professional Agent Integration**: Added "Find an Agent" hero component to the main property listing and integrated a global "Agents" link in the header for expert local guidance.
- **Become an Agent Program**: Launched a comprehensive agent application platform within the app, featuring secure form submission, automated profile pre-filling, and status tracking for applicants.
- **Enhanced Agent Discovery**: Implemented a modern public agents directory with client-side real-time filtering by name, agency, and city.
- **Secure Installation ID**: Implemented a privacy-first unique Installation ID system (UUID-based) as a secure alternative to hardware MAC addresses, enabling better multi-device session management and security without compromising user privacy.

### 🐛 Fixes
- **Screenshot Detection Security**: Resolved a critical bug where screenshot detection was non-functional; implemented a high-reliability listener system that alerts users when sensitive property or agent information is captured.
- **Performance Hub Theme**: Fixed a UI bug where the Performance Hub header remained white in Dark Mode.
- **Auto-lock Display**: Fixed a bug where selected auto-lock periods were not displaying correctly due to data type mismatch.
- **Settings Persistence**: Resolved backend issue where `biometricLockPeriod` was not being saved to the user profile.
- **Push Notification Fix**: Resolved "Physical device required" error on real devices and implemented system-wide push triggers for all notifications via database middleware.
- **Premium Loading Experience**: Overhauled startup sequence with staggered ripple system and pulsing animations.
- **TypeScript & Storage Stability**: Hardened installation ID generation logic with strict type-safety and robust persistent storage handling for the mobile app layout.

### 🛠️ System Improvements
- **Agent Privacy Shield**: Upgraded `AgentCard` and professional profiles with an authentication-aware layer that masks sensitive agency and service area details for guest users, encouraging platform engagement.
- **Visual Branding Sync**: Updated the global "Agents" icon to a professional `user-secret` glyph across all quick links and heroes for consistent visual identity.
- **Premium Multi-Device Push**: Completely overhauled notification engine to support multiple devices (phone + tablet) simultaneously, now integrated with the new Installation ID system for pinpoint delivery.
- **Agent Navigation**: Updated the footer button on property details to navigate to "Find Agents" within the app instead of opening a web browser.
