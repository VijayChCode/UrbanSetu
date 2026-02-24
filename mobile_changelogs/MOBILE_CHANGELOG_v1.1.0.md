# Changelog - UrbanSetu

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-24
### 📝 UrbanSetu v1.1.0 – Notifications Upgrade & System Polish 🚀 ✨

#### 🔔 Notifications Center 2.0
*   **Advanced Filtering**: Added the ability to filter alerts by Status (All, Read, Unread) and Category (Real Estate, Community, Appointments, Payments, System).
*   **Global Search**: Integrated a search bar to help you find specific alerts instantly.
*   **Improved UX**: Added "Mark as Read" toast feedback and massa selection improvements.
*   **Visual Overhaul**: New icon mapping and color-coding for better visual priority.

#### 🌓 Personalization & Offline Support
*   **Persistent Theme**: Your appearance preferences (Dark/Light mode) are now saved locally via AsyncStorage, ensuring your setting persists even when offline or during app reloads.
*   **Native Headers**: Updated Investment Tools and Route Planner to use native stack headers for perfect dark mode compatibility and consistency.

#### 📍 Smart Features & Location
*   **One-Tap Location**: Route Planner now integrates device location services to set your start/end points instantly (requires permission).
*   **Visibility Fixes**: Optimized Device Management layout to ensure "Current Device" tags remain visible for all device types and name lengths.

#### 🛡️ Stability & Security
*   **Robust Backend**: Refactored notification deletion logic to use strict JWT-based ownership verification, preventing accidental errors and improving security.
*   **Crash Prevention**: Implemented safety checks for property links in notifications to handle deleted listings gracefully.
*   **UI Cleanup**: Removed redundant navigation arrows and video badges for a more premium, focused interface.
*   **Feedback Loops**: Added descriptive loading text for all data-fetching states (Notifications, Profile, Support Messages).

#### 🛡️ Security & Authentication
*   **Google Sign-In Stability**: Resolved the critical "Configuration Error (7)" on Android. Synchronized SHA-1 fingerprints with Firebase and updated `google-services.json` for seamless one-tap logins.
*   **Diagnostic Logging**: Enhanced the auth flow with proactive diagnostic tools to ensure configuration errors are identified instantly in real-time.

#### ⚡ Performance & Optimization
*   **ABI Splitting (Size Reduction)**: Implemented architecture-specific APK builds (arm64, v7a, x86). Users now download a build perfectly tailored to their device hardware, reducing download size by over 60% (now only ~33MB).
*   **Production Engine Upgrade**: Optimized Gradle JVM memory (4GB) and R8 minifier settings to ensure a fast, stable, and highly compressed application.
