# Digital Signatures & Checksums for UrbanSetu APKs

This document contains the verified SHA-256 and MD5 checksums of our official UrbanSetu APK releases. Verify your downloaded file's checksum against the values listed below to ensure your download is 100% authentic, intact, and free from tampering.

---

## 🔑 Official Build Signatures & Checksums

### 1. UrbanSetu v1.2.8 - Modern Edition (Recommended)
* **Architecture:** `arm64-v8a` (64-bit ARM)
* **Target Devices:** Modern Android Smartphones (2018-present)
* **File Name:** `UrbanSetu_v1.2.8_Modern.apk` (or `UrbanSetu_Modern.apk`)
* **File Size:** ~48.58 MB (50,944,242 bytes)
* **Min Android Version:** Android 7.0+ (API 24+)
* **SHA-256 Checksum:**
  ```
  33B9DE3B5A78F92819055B5865D1636EF842CB1287BB50BF71EE3258EBEDAEB3
  ```
* **MD5 Checksum:**
  ```
  A09BA4E4F8AC414338AF20AD0875DE37
  ```

---

### 2. UrbanSetu v1.2.8 - Universal Edition (All-Device Fallback)
* **Architecture:** Multi-ABI (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`)
* **Target Devices:** All Android Devices, Tablets, Foldables & PC Emulators
* **File Name:** `UrbanSetu_v1.2.8_Universal.apk` (or `UrbanSetu_Universal.apk`)
* **File Size:** ~110.72 MB (116,099,997 bytes)
* **Min Android Version:** Android 7.0+ (API 24+)
* **SHA-256 Checksum:**
  ```
  3C4117535786860773BAA0F49F3AA2EAEEDD17872F8F5EC21EC85B316F041018
  ```
* **MD5 Checksum:**
  ```
  72B83F19C2B3B7312ED75239791D063C
  ```

---

### 3. UrbanSetu v1.2.0 - Legacy Edition (Older / 32-bit Phones)
* **Architecture:** `armeabi-v7a` (32-bit ARM)
* **Target Devices:** Older & Budget Android Smartphones
* **File Name:** `UrbanSetu_v1.2.0_Legacy.apk` (or `UrbanSetu_Legacy.apk`)
* **File Size:** ~41.67 MB (43,694,082 bytes)
* **Min Android Version:** Android 7.0+ (API 24+)
* **SHA-256 Checksum:**
  ```
  57B18C1BE09918DF3592FD09E41E088BF236D8BEE8C076FA65A8E25E0A3F66AB
  ```
* **MD5 Checksum:**
  ```
  DBF36EEF5F80E4D829D65462F9BDE100
  ```

---

### 4. UrbanSetu v1.2.0 - Modern Edition
* **Architecture:** `arm64-v8a` (64-bit ARM)
* **File Size:** ~48.57 MB (50,929,573 bytes)
* **SHA-256 Checksum:**
  ```
  3F191569F117547652E1A1662FE034D5ADC0B206B70BBDC3397C768132E9A8C5
  ```
* **MD5 Checksum:**
  ```
  8C9F00B4C779C47CE5F46020C0063CF9
  ```

---

## 🛠️ How to Verify Checksums on Your Computer

### 1. Windows (PowerShell)
Open PowerShell in the folder where your APK is saved:
```powershell
Get-FileHash .\UrbanSetu_v1.2.8_Modern.apk -Algorithm SHA256
```
Compare the output hash against the **SHA-256** string listed above.

### 2. macOS & Linux (Terminal)
Open Terminal in your download directory:
```bash
shasum -a 256 UrbanSetu_v1.2.8_Modern.apk
```

### 3. Online Checksum Verification & Antivirus Scan
1. Visit [VirusTotal](https://www.virustotal.com/) or an online hashing tool.
2. Upload the downloaded APK.
3. Check the calculated SHA-256 hash and review the **0/70 Clean Antivirus Score**!
