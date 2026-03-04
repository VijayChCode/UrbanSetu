# 📝 UrbanSetu v1.2.0 - Release Notes
*Released: 2026-03-04*

---

### 🐛 Bug Fixes

- **Report Issue Modal Reopening (`VideoViewer.tsx`)**: Fixed a critical bug where the "Report an Issue" bottom sheet would visually reopen after being dismissed. Root cause was a dual-animation conflict — React Native's built-in `animationType="slide"` was fighting the custom `sheetTranslateY` Animated.timing animation. The OS slide-out animation briefly re-rendered the sheet at its original position (because `sheetTranslateY` reset to `0`) before sliding it out, creating a "bounce-back" effect.
  - Changed `animationType` from `"slide"` to `"fade"` so the backdrop fades while the custom animation handles the sheet slide.
  - Added `onPress={() => {}}` to the inner `TouchableOpacity` to block touch event propagation to the backdrop's close handler.
  - `onRequestClose` (Android back button) now resets `sheetTranslateY` before closing to prevent stale animation state.

- **Screenshot Detection Not Firing**: Resolved a critical bug where screenshot detection was non-functional on real devices. Implemented proactive `MediaLibrary` permission request before subscribing to asset change listeners, ensuring the subscription is valid and properly cleaned up on unmount.

- **Video Download "Failed" Error**: Fixed the video download pipeline that was failing on most devices:
  - Switched to write-only permission request (`MediaLibrary.requestPermissionsAsync(false)`) — avoids requesting unnecessary audio permissions that trigger denials.
  - Cleaned up Cloudinary URLs before download — strips `q_auto`/`f_auto` transforms and forces `.mp4` extension to prevent streaming-format downloads.
  - Added file size validation post-download to catch corrupted/empty files.
  - Improved error categorization with specific user-facing messages for permission denial, corrupt files, and network failures.

- **Brightness/Volume Gesture Offset**: Corrected the vertical gesture calculation for brightness (left swipe) and volume (right swipe) controls. Fixed baseline offset so gestures start from the lock-in point rather than the initial touch, preventing sudden jumps in brightness/volume values.

- **Google Sign-In `DEVELOPER_ERROR`**: Improved error handling for Google Sign-In configuration errors:
  - Added `GoogleSignin.signOut()` before retry attempts to clear stale credentials.
  - Shows Play Services update dialog when services are outdated.
  - Provides a specific, actionable error message for `DEVELOPER_ERROR` (SHA-1 mismatch).

- **App Not Fully Closing**: Fixed the app remaining in memory after pressing the back button on the home screen. Replaced `BackHandler.exitApp()` with `RNExitApp.exitApp()` from `react-native-exit-app` to ensure true process termination on Android.

- **Profile Update Toast Disappearing**: Added a 500ms delay before `router.back()` after a successful profile update so the success toast message is reliably visible to the user.

---

### ✨ Enhancements

- **Report Modal Close Button**: Added an explicit ✕ close button in the report sheet header alongside the existing swipe-to-dismiss and backdrop-tap-to-dismiss methods. Updated subtitle to "Swipe down or tap ✕ to dismiss". Header now uses flex-row layout for proper alignment.

- **Video Player Push Notifications for Downloads**: Download start and completion/failure events now trigger local push notifications via `expo-notifications`, keeping users informed even if they navigate away during a download.

---

### 📦 New Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `react-native-exit-app` | latest | True app process termination on Android back press |

---

### 🛠️ Technical Notes

- `expo-brightness` used for real-time device brightness control during video playback.
- `expo-file-system` v19 TypeScript workaround remains: API accessed via `(FileSystem as any)` due to broken TS type exports at runtime.
- `expo-media-library` permission flow updated to request write-only access for downloads.
- Report modal animation architecture changed: OS handles fade backdrop, custom `Animated.timing` handles sheet slide — no more animation competition.
- `sheetPanResponder` drag-to-dismiss threshold remains at ≥80px with spring snap-back for shorter drags.
