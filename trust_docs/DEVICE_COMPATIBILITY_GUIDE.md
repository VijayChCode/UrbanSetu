# UrbanSetu APK Device Compatibility & Architecture Guide

Welcome to the official UrbanSetu Device Compatibility Guide. To ensure the optimal balance between download speed, lightweight storage, and universal hardware support, UrbanSetu provides specialized APK builds tailored to different Android devices and processor architectures.

---

## 📱 Quick Selection: Which APK Should You Download?

| Package Type | File Size | Architecture | Target Devices | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **Modern Edition** | **~48.58 MB** | `arm64-v8a` (64-bit ARM) | Modern smartphones & tablets (2018-present) | **95%+ of Android users** (Fastest performance & small download) |
| **Legacy Edition** | **~41.67 MB** | `armeabi-v7a` (32-bit ARM) | Older smartphones & budget 32-bit Android phones | **Older / Entry-level phones** (Android 7.0 to 11 on 32-bit CPUs) |
| **Universal Edition** | **~110.72 MB** | Multi-ABI (Fat APK) | ALL Android devices, foldables, tablets & PC emulators | **Guaranteed install on ANY device** or PC emulator |

---

## 🔍 How to Check Your Phone's Architecture

If you are unsure which build your phone requires:

1. **Rule of Thumb:**
   - If your phone was released in **2019 or later**, download the **Modern Edition (48.58 MB)**.
   - If you see an error saying *"App not installed as package appears to be invalid"* or *"App not compatible with your device"*, download the **Legacy Edition (41.67 MB)** or **Universal Edition (110.72 MB)**.
2. **Using a Free Diagnostic App:**
   - Install **AIDA64** or **CPU-Z** from the Play Store.
   - Check the **CPU / Instruction Set** tab:
     - If it says `64-bit ARMv8-A` or `AArch64` -> Use **Modern Edition**.
     - If it says `32-bit ARMv7-A` or `armeabi-v7a` -> Use **Legacy Edition**.
     - If you are running an emulator on PC (x86/x86_64) -> Use **Universal Edition**.

---

## 📊 Comprehensive Device Compatibility Matrix

### 1. Modern 64-bit Devices (Supports Modern Edition & Universal)
* **Samsung:** Galaxy S8/S9/S10/S20/S21/S22/S23/S24 series, Galaxy Note 8-20, Galaxy Z Fold/Flip series, Galaxy A14/A23/A34/A54/A55, Galaxy M14/M34/M54, Galaxy F series.
* **Xiaomi / Redmi / POCO:** Redmi Note 8/9/10/11/12/13 series, Xiaomi 11/12/13/14, POCO X3/X4/X5/X6, POCO F3/F4/F5/F6, POCO M series.
* **OnePlus:** OnePlus 6/7/8/9/10/11/12 series, OnePlus Nord, Nord CE, Nord 2/3/4 series.
* **Realme:** Realme 6/7/8/9/10/11/12 series, Realme GT series, Realme Narzo 20/30/50/60/70.
* **Vivo & iQOO:** Vivo V20-V30 series, Vivo X60-X100 series, Vivo Y-series (64-bit), iQOO 7/9/11/12, iQOO Neo/Z series.
* **OPPO:** Oppo Reno 4-12 series, Find X series, Oppo F17-F27 series, Oppo A78/A79/A98.
* **Google Pixel:** Pixel 2, 3, 4, 5, 6, 7, 8, 9, Pixel Fold, Pixel A-series (3a to 8a).
* **Motorola:** Moto G series (G31, G52, G54, G84), Motorola Edge 20/30/40/50 series, Razr 40/50.
* **Nothing:** Nothing Phone (1), Phone (2), Phone (2a), CMF Phone 1.
* **Tecno & Infinix:** Camon 19/20/30 series, Phantom series, Infinix Zero & Note series.

### 2. Legacy 32-bit Devices (Requires Legacy Edition or Universal)
* Older budget smartphones running 32-bit Android OS on ARMv7 processors.
* Entry-level devices powered by Snapdragon 410/425/430/435 (running in 32-bit mode) or MediaTek MT6580/MT6737.
* Android Go Edition devices with limited RAM (< 2GB).
* Samsung Galaxy J2/J3/J5/J7 (2015-2017), Galaxy Core, Galaxy Grand Prime.
* Redmi 4A, Redmi 5A, Redmi 6A, Redmi Go.
* Realme C1, Realme C2 (32-bit firmware).

### 3. PC Android Emulators & Tablets (Requires Universal Edition)
* **BlueStacks** (Nougat 32-bit, Pie 64-bit, Android 11)
* **Nox Player** & **LDPlayer 9**
* **MEmu Play** & **Genymotion**
* **Android Studio Virtual Devices (AVD)** running x86 / x86_64 system images.

---

## 🛠️ Troubleshooting Common Installation Issues

### Issue 1: "App Not Installed"
* **Cause A (Architecture Mismatch):** You downloaded the 64-bit Modern APK on a 32-bit device.
  * **Solution:** Download the **Legacy Edition (41.67 MB)** or **Universal Edition (110.72 MB)**.
* **Cause B (Existing Version Conflict):** An older version of UrbanSetu with different signing keys or version codes is already installed.
  * **Solution:** Uninstall the existing UrbanSetu app from your phone, restart device, and install the new APK.

### Issue 2: "There was a problem parsing the package" (Parse Error)
* **Cause A (Incomplete Download):** The APK file was only partially downloaded.
  * **Solution:** Redownload the file completely from Google Drive. Verify the file size matches the official release size.
* **Cause B (Incompatible Android Version):** Minimum supported Android version is **Android 7.0 (API Level 24)**.
  * **Solution:** Ensure your device is running Android 7.0 (Nougat), Android 8.0, 9, 10, 11, 12, 13, 14, or 15.

### Issue 3: "Blocked by Play Protect"
* Google Play Protect displays warnings for directly installed APKs because they are distributed outside Google Play Store.
* **Solution:** Tap **"More details"** -> **"Install anyway"**. All UrbanSetu APKs are 100% verified, malware-free, and certified safe.

---

## 📞 Technical Support & Inquiries
For further assistance, reach out directly to the UrbanSetu Engineering & Security Team:
* **Support Email:** `urbansetu.noreply@gmail.com`
* **Security & Auth:** `auth.urbansetu@gmail.com`
* **Portal:** [UrbanSetu Help Center](https://urbansetu.vercel.app/help-center)
