# 📝 UrbanSetu v1.1.2 - Release Notes

*This version is currently in development. Changes and fixes will be added below as they are implemented.*

### 🚀 Upcoming Features
- **Professional Agent Integration**: Added "Find an Agent" hero component to the main property listing and integrated a global "Agents" link in the header for expert local guidance.
- **Become an Agent Program**: Launched a comprehensive agent application platform within the app, featuring secure form submission, automated profile pre-filling, and status tracking for applicants.
- **Enhanced Agent Discovery**: Implemented a modern public agents directory with client-side real-time filtering by name, agency, and city.
- **Secure Installation ID**: Implemented a privacy-first unique Installation ID system (UUID-based) as a secure alternative to hardware MAC addresses, enabling better multi-device session management and security without compromising user privacy.
- **Smart Permission Insights**: Replaced blind permission spam at app startup with an intelligent 14-day interval prompt system; introduced a premium, animated `PermissionPanel` bottom sheet that gracefully explains *why* a permission is needed and deep-links directly to device settings if previously denied.
- **Interactive Community Actions**: Empowered users with native-feeling action sheets providing secure options to Edit, Delete, or Report discussions directly from the community feed. Integrated with smooth-fading `KeyboardAvoidingView` modals optimized for cross-platform touch interactions.

### 🐛 Fixes
- **Screenshot Detection Security**: Resolved a critical bug where screenshot detection was non-functional; implemented a high-reliability listener system that alerts users when sensitive property or agent information is captured.
- **Performance Hub Theme**: Fixed a UI bug where the Performance Hub header remained white in Dark Mode.
- **Auto-lock Display**: Fixed a bug where selected auto-lock periods were not displaying correctly due to data type mismatch.
- **Settings Persistence**: Resolved backend issue where `biometricLockPeriod` was not being saved to the user profile.
- **Push Notification Fix**: Resolved "Physical device required" error on real devices and implemented system-wide push triggers for all notifications via database middleware.
- **Premium Loading Experience**: Overhauled startup sequence with staggered ripple system and pulsing animations.
- **TypeScript & Storage Stability**: Hardened installation ID generation logic with strict type-safety and robust persistent storage handling for the mobile app layout.
- **Smart FAQ Accordions**: Integrated `LayoutAnimation` into FAQ sections across About and FAQ screens for smooth, performance-optimized expanding and collapsing.
- **Intelligent Biometric Logic**: Refined biometric behavior to match premium fintech apps; "Immediately" now intelligently distinguishes between cold starts (secure entry) and background resumes (seamless multitasking).

### 🛠️ System Improvements
- **Agent Privacy Shield**: Upgraded `AgentCard` and professional profiles with an authentication-aware layer that masks sensitive agency and service area details for guest users, encouraging platform engagement.
- **Visual Branding Sync**: Updated the global "Agents" icon to a professional `user-secret` glyph across all quick links and heroes for consistent visual identity.
- **Premium Multi-Device Push**: Completely overhauled notification engine to support multiple devices (phone + tablet) simultaneously, now integrated with the new Installation ID system for pinpoint delivery.
- **Agent Navigation**: Updated the footer button on property details to navigate to "Find Agents" within the app instead of opening a web browser.

---

### 🎬 Video Viewer — Major Feature Overhaul (`VideoViewer.tsx`)
*Updated: 2026-02-26*

#### ✨ New Features

- **Report an Issue** — Native drag-to-dismiss bottom sheet with 4 issue categories:
  - Buffering & Connection Issues
  - Video Quality
  - Audio Quality
  - Other Issue

  Tapping a category sends an authenticated API report to the backend (`/api/notifications/report-video` via the mobile API client with auth token). Shows ✅ success state, then auto-dismisses after 2 seconds. Spinner only appears on the clicked row (not all rows at once). Backdrop tap and downward drag (≥80px) both close the sheet.

- **Share Video** — Tapping "Share" opens the native OS share sheet with the video URL and a pre-composed property tour message. Compatible with WhatsApp, Email, SMS, and all system share targets.

- **Download to Gallery** — Full download pipeline:
  - **Permission check** — Requests Photos/Storage permission before starting; shows Alert with Cancel/OK if denied.
  - **Live progress bar** — Inline 0–100% fill bar replaces the action row during download.
  - **Step-by-step status toasts**:
    - `⬇ Download starting…`
    - `💾 Saving to Gallery…`
    - `✅ Video saved to Gallery!`
    - `❌ Download failed. Check your connection.` on error.
  - Prevents duplicate downloads if already in progress.

- **Brightness Control — Left Side Vertical Swipe** — Vertical swipe on the **left half** of the video controls **device screen brightness** in real time, identical to JioHotstar. Shows animated pill overlay on the left edge: sun/moon icon + vertical fill bar + percentage text.

- **Volume Control — Right Side Vertical Swipe** — Vertical swipe on the **right half** controls **video audio volume** in real time. Shows animated pill overlay on the right edge: volume icon + vertical fill bar + percentage text.

- **Timeline Scrub Preview** — Dragging on the seek bar shows a floating mini video thumbnail above the finger with a time label. Controls stay fully visible while scrubbing (auto-hide is paused). Seeking is immediate on first touch, with a final seek on finger lift.

- **Pinch-to-Zoom Fill/Fit (Landscape only)** — Two-finger pinch/spread smoothly transitions between `ResizeMode.CONTAIN` (Fit) and `ResizeMode.COVER` (Fill) with a spring animation. Uses raw `onTouchStart/Move/End` handlers (bypasses PanResponder multi-touch limitations). Also accessible from the settings cog menu.

- **YouTube-style Orientation Icon** — Portrait mode shows `expand` icon (go fullscreen / landscape); landscape shows `compress` icon (return to portrait) — matches YouTube's fullscreen button exactly.

#### 🐛 Fixes

- **Report Spinner on All Rows** — Fixed bug where clicking any issue type showed a loading spinner on all rows simultaneously. Now uses `reportingIssueId: string | null` to track exactly which row is submitting.
- **Controls Hiding During Scrub** — Fixed controls auto-hiding while the scrub preview thumbnail was visible. Auto-hide timer is now paused whenever `scrubPreviewPct !== null`.
- **Seek Bar Not Registering Immediately** — Fixed seek bar requiring multiple taps before a position was selected. Now seeks on `onTouchStart` (immediate) with final confirm on `onTouchEnd`.
- **Report Sheet Close UX** — Removed the ✕ close button. Sheet now dismisses via backdrop tap or downward drag ≥80px with snap-back animation if not dragged far enough.

#### 🛠️ Technical Notes

- `expo-brightness` added as dependency for real-time device brightness control.
- `expo-file-system` v19 TypeScript workaround: API accessed via `(FileSystem as any)` — properties exist at runtime despite broken TS type exports.
- `expo-media-library` used for gallery save with full managed permission flow.
- Brightness/Volume gesture activates only when `|dy| > |dx| × 1.5` — prevents conflicts with horizontal swipe-to-skip-video gesture.
- Report/Share/Save placed in a compact second footer row with vertical dividers — no overflow in portrait or landscape.
- `sheetPanResponder` added to Report bottom sheet for drag tracking with `Animated.Value` for translateY, enabling native-feeling drag-to-dismiss.
