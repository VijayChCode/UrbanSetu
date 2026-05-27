# UrbanSetu APK Installation & Verification Guide

Welcome to the official UrbanSetu mobile application installation guide. This document explains how to install the app safely on your Android device and verify its digital signature to guarantee you have the genuine, unaltered, malware-free package.

---

## 📱 Quick Installation Steps

Since this application is distributed directly as an APK to ensure the fastest delivery of updates, your device will require permission to install from "Unknown Sources" (which simply means sources outside the Google Play Store).

### Step 1: Download the APK
Download the `.apk` file directly from our secure official Google Drive link.

### Step 2: Enable "Unknown Sources" or "Install Unknown Apps"
Depending on your Android version:
- **Android 8.0 (Oreo) and newer:** 
  1. Open the downloaded `.apk` file using your file manager or browser.
  2. A system prompt will appear saying: *"For your security, your phone is not allowed to install unknown apps from this source."*
  3. Click **Settings** on the prompt.
  4. Toggle on **Allow from this source**.
  5. Go back and tap **Install**.
- **Android 7.0 (Nougat) and older:**
  1. Go to **Settings** -> **Security** (or **Lock Screen and Security**).
  2. Locate **Unknown Sources** and toggle it **On**.
  3. Confirm the prompt by tapping **OK**.
  4. Open your File Manager, navigate to the **Downloads** folder, and tap the APK to install.

### Step 3: Bypass Play Protect warning (if visible)
Because the app is self-signed and distributed directly, Google Play Protect may display a warning: *"Blocked by Play Protect - Play Protect doesn't recognize this app's developer."*
1. Tap **More details** (or **Install anyway** if directly visible).
2. Tap **Install anyway** to proceed.

---

## 🔒 Verification & Trust Details

To verify that the file has not been tampered with or modified by third parties during transit, you can check its **SHA-256 Checksum**.

### Package Checksum Details
* **App Name:** UrbanSetu Mobile
* **Official Package:** `urbansetu-latest.apk`
* **Official SHA-256 Checksum:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` *(Example hash - always check CHECKSUM.md for the active hash of the current build)*

### How to Verify Checksum

#### 1. On Windows (PowerShell):
Open PowerShell and run the following command:
```powershell
Get-FileHash .\urbansetu-latest.apk -Algorithm SHA256
```

#### 2. On macOS / Linux (Terminal):
Open your terminal and run:
```bash
shasum -a 256 urbansetu-latest.apk
```

#### 3. Online:
You can drag and drop the downloaded APK into secure public hashing tools like [Virustotal](https://www.virustotal.com/) or online SHA256 calculators.
* **Pro-tip:** Uploading the APK to **VirusTotal** will also scan it across 70+ antivirus engines to prove it is 100% clean, safe, and malware-free!

---

## 🤝 Need Support?
If you have any questions, security concerns, or difficulty installing:
* Visit our official portal: [UrbanSetu Support](https://urbansetu.com/support)
* Contact Security Team: `security@urbansetu.com`
