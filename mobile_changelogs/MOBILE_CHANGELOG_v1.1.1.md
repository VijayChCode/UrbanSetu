### **📝 UrbanSetu v1.1.1 – Enhanced Controls & Media Polish 🚀**

#### **⚙️ Advanced Settings & Privacy**
*   **Biometric Lock Duration**: Customizable biometric lock durations (Immediately, 1, 5, or 15 minutes).
*   **Power Saver Mode**: System-wide toggle that enforces Dark Mode and reduces background data polling.
*   **Persistent Configuration**: Settings mirrored locally across sessions using AsyncStorage overrides.

#### **🖼️ Media Experience 2.0**
*   **ImageViewer Pro**: Optimized image loading and gesture-based zoom.
*   **VideoViewer Upgrade**: Smoother playback transitions and improved full-screen orientation handling.

#### **🛠️ Internal & Admin Tools**
*   **Premium Changelog Modal**: Release Notes modal in the Admin Deployment Management page.
*   **Bug Fix: Admin Navigation**: Resolved the `activeTab` reference error in the admin panel.
*   **Refactor**: Improved path consistency and automated build-cleanup scripts.

#### **⚡ Performance & Build Infrastructure**
*   **Build Reliability**: Implemented "Short Path" build protocol (`D:\U`) to resolve Windows filename length errors.
*   **ABI Splitting**: Refined APK generation to produce architecture-specific builds (`arm64`, `v7a`), reducing size by ~60%.
