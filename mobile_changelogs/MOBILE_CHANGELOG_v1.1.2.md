# 📝 UrbanSetu v1.1.2 - Release Notes

*This version is currently in development. Changes and fixes will be added below as they are implemented.*

### 🚀 Upcoming Features
- **Biometric & Lock Sync**: Synchronized Biometric Authentication toggle with Auto-lock periods. Disabling biometrics now automatically resets the lock period to 'Immediately' for security.
- **Verified Status**: Added a 'Verified User' badge to the mobile profile page for enhanced user identity recognition.

### 🐛 Fixes
- **Performance Hub Theme**: Fixed a UI bug where the Performance Hub header remained white in Dark Mode.
- **Auto-lock Display**: Fixed a bug where selected auto-lock periods were not displaying correctly due to data type mismatch.
- **Settings Persistence**: Resolved backend issue where `biometricLockPeriod` was not being saved to the user profile.
- **Push Notification Fix**: Resolved "Physical device required" error on real devices and implemented system-wide push triggers for all notifications via database middleware.
- **Token Auto-Sync**: Added silent push token refresh on app startup for improved delivery reliability.
- **Agent Navigation**: Updated the footer button on property details to navigate to "Find Agents" within the app instead of opening a web browser.

### 🛠️ System Improvements
- (Waiting for next prompt...)
