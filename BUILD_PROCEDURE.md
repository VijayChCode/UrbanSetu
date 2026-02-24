# UrbanSetu Android Build & Release Procedure (v1.1.0+)

This document outlines the proven workflow to successfully generate Android APKs for UrbanSetu on Windows, bypassing common environment errors (Path Length, Memory, NDK).

---

## 🚀 1. The Core Problems & Solutions

### **A. Windows Path Length Limit (ERROR: > 260 Characters)**
*   **The Problem:** React Native and Ninja (C++ compiler) create deep directory structures (e.g., `.gradle_home/caches/.../transformed/`). On Windows, these exceed 260 characters and cause the build to fail.
*   **The Fix:** 
    *   Mirror the `mobile` and `shared` folders to the root of the D: drive (e.g., `D:\U` and `D:\shared`).
    *   Redirect the Gradle Home to a very short path (e.g., `D:\.g`).

### **B. JVM & Metaspace Out of Memory**
*   **The Problem:** The "New Architecture" (Fabric/TurboModules) is memory-intensive. Default Gradle settings (2GB) will crash.
*   **The Fix:** Increase `org.gradle.jvmargs` to at least 4GB in `gradle.properties`.

### **C. Deprecated NDK Reference**
*   **The Problem:** Explicit `ndk.dir` in `local.properties` causes conflicts with modern Gradle versions.
*   **The Fix:** Remove `ndk.dir` from `local.properties` and define `ndkVersion` in `android/build.gradle`.

---

## 🛠️ 2. Step-by-Step Build Procedure

Follow these steps exactly to generate a successful release:

### **Step 1: Environment Sync**
Ensure the following settings are in `mobile/android/gradle.properties`:
```properties
newArchEnabled=true
hermesEnabled=true
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError
```

### **Step 2: Relocate to Short Path (PowerShell)**
Run these commands to prep the "Short Path" build environment on the D: drive:
```powershell
# 1. Clean up old build mirrors
if (Test-Path "D:\U") { Remove-Item -Recurse -Force "D:\U" }
if (Test-Path "D:\shared") { Remove-Item -Recurse -Force "D:\shared" }

# 2. Recreate directories
New-Item -ItemType Directory "D:\U"
New-Item -ItemType Directory "D:\.g"

# 3. Copy only necessary folders to root
Copy-Item -Path "d:\Videos\Project\UrbanSetu\mobile\*" -Destination "D:\U" -Recurse -Force
Copy-Item -Path "d:\Videos\Project\UrbanSetu\shared" -Destination "D:\shared" -Recurse -Force
```

### **Step 3: Execution Command**
Navigate to the mirrored directory and trigger the build using the Short-Path Gradle home:
```powershell
cd D:\U\android
./gradlew --stop  # Kill any old daemons
./gradlew assembleRelease -g D:\.g --no-daemon
```

---

## 📦 3. Post-Build: APK Locations

The build generates architecture-specific APKs (ABI Splitting) to keep the file size small (~35MB).

| Target Phone | File Path | Usage |
| :--- | :--- | :--- |
| **Modern Phones** | `D:\U\android\app\build\outputs\apk\release\app-arm64-v8a-release.apk` | **Main Release (v8a)** |
| **Old Phones** | `D:\U\android\app\build\outputs\apk\release\app-armeabi-v7a-release.apk` | Legacy Support (v7a) |

---

## 🚨 4. Common Build Errors & Fixes

| Error Encountered | Immediate Fix |
| :--- | :--- |
| `Filename longer than 260 characters` | Move project to `D:\U` and Gradle Home to `D:\.g`. |
| `ReferenceError: activeTab is not defined` | Ensure `const [activeTab, setActiveTab] = useState('all')` is present in `AdminDeploymentManagement.jsx`. |
| `ENOENT: no such file or directory, stat 'D:\shared'` | You forgot to copy the `shared` folder to the root of the D: drive. |
| `Configuration Error (7)` in Google Login | Verify the SHA-1 fingerprints in Firebase Console and download/replace `google-services.json`. |

---

## 📝 5. Deployment Deployment
After build completion, copy the APKs back to the main project:
```powershell
# Example:
Copy-Item "D:\U\android\app\build\outputs\apk\release\app-arm64-v8a-release.apk" "d:\Videos\Project\UrbanSetu\mobile\release\UrbanSetu_vX.Y.Z_Modern.apk"
```
