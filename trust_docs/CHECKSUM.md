# Digital Signatures & Checksums for UrbanSetu APKs

This document contains the SHA-256 checksums of our official APK releases. Verify your downloaded file's checksum against the values listed below to ensure your download is 100% complete, authentic, and has not been altered in transit.

---

## 🔑 Active Releases & Checksums

### UrbanSetu Mobile APK (Android)

* **Version:** 1.0.4 *(Latest Release)*
* **File Name:** `urbansetu-latest.apk`
* **Release Date:** May 27, 2026
* **Platform:** Android (5.0+)
* **SHA-256 Checksum:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
* **MD5 Checksum:** `d41d8cd98f00b204e9800998ecf8427e`

---

## 🛠️ Verification Instructions

A checksum is like a digital fingerprint. If even a single byte of the file is modified or corrupted during download, the resulting checksum will be completely different.

### 1. Windows (PowerShell)
Open PowerShell, navigate to the folder containing your downloaded APK, and run:
```powershell
Get-FileHash .\urbansetu-latest.apk -Algorithm SHA256
```
Confirm the output hash matches the **SHA-256 Checksum** above.

### 2. macOS & Linux (Terminal)
Open Terminal, navigate to the folder containing your downloaded APK, and run:
```bash
shasum -a 256 urbansetu-latest.apk
```
Confirm the output hash matches the **SHA-256 Checksum** above.

### 3. Online Verification
If you prefer not to use commands:
1. Go to [VirusTotal](https://www.virustotal.com/) or a public [Online SHA256 Tool](https://emn178.github.io/online-tools/sha256_checksum.html).
2. Upload/Select the downloaded `urbansetu-latest.apk`.
3. Check the calculated hash.
* **Benefit:** VirusTotal will calculate the SHA-256 hash and immediately display scans from 70+ antivirus engines to confirm the app is 100% clean and trusted!
