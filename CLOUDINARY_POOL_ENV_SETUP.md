# Cloudinary Multi-Account Pool — Environment Variables Setup

## How It Works

The backend reads `CLOUDINARY_POOL_<INDEX>_*` env vars at startup. Each account needs **3 variables**. The system auto-discovers all accounts (index 0 to 49).

> **Backward Compatible**: If no `CLOUDINARY_POOL_*` vars exist, the system falls back to the legacy `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` vars.

---

## Variables Per Account

| Variable | Description | Example |
|---|---|---|
| `CLOUDINARY_POOL_<N>_CLOUD_NAME` | Cloud name from Cloudinary dashboard | `` |
| `CLOUDINARY_POOL_<N>_API_KEY` | API Key from Cloudinary dashboard | `` |
| `CLOUDINARY_POOL_<N>_API_SECRET` | API Secret from Cloudinary dashboard | `` |

---

## Full Template (15 Accounts)

Copy-paste this into your **Render Environment Variables** or `.env` file. Replace placeholder values with your actual credentials.

```env
# ═══════════════════════════════════════════════════════════════
# CLOUDINARY MULTI-ACCOUNT POOL (15 Accounts)
# Each account gets ~25 free credits/month
# The system automatically picks the least-used account per upload
# ═══════════════════════════════════════════════════════════════

# ─── Account 0 (Your existing/primary account) ───────────────
CLOUDINARY_POOL_0_CLOUD_NAME= your_primary_cloud_name
CLOUDINARY_POOL_0_API_KEY= your_primary_api_key
CLOUDINARY_POOL_0_API_SECRET= your_primary_api_secret

# ─── Account 1 ───────────────────────────────────────────────
CLOUDINARY_POOL_1_CLOUD_NAME=your_cloud_name_1
CLOUDINARY_POOL_1_API_KEY=your_api_key_1
CLOUDINARY_POOL_1_API_SECRET=your_api_secret_1

# ─── Account 2 ───────────────────────────────────────────────
CLOUDINARY_POOL_2_CLOUD_NAME=your_cloud_name_2
CLOUDINARY_POOL_2_API_KEY=your_api_key_2
CLOUDINARY_POOL_2_API_SECRET=your_api_secret_2

# ─── Account 3 ───────────────────────────────────────────────
CLOUDINARY_POOL_3_CLOUD_NAME=your_cloud_name_3
CLOUDINARY_POOL_3_API_KEY=your_api_key_3
CLOUDINARY_POOL_3_API_SECRET=your_api_secret_3

# ─── Account 4 ───────────────────────────────────────────────
CLOUDINARY_POOL_4_CLOUD_NAME=your_cloud_name_4
CLOUDINARY_POOL_4_API_KEY=your_api_key_4
CLOUDINARY_POOL_4_API_SECRET=your_api_secret_4

# ─── Account 5 ───────────────────────────────────────────────
CLOUDINARY_POOL_5_CLOUD_NAME=your_cloud_name_5
CLOUDINARY_POOL_5_API_KEY=your_api_key_5
CLOUDINARY_POOL_5_API_SECRET=your_api_secret_5

# ─── Account 6 ───────────────────────────────────────────────
CLOUDINARY_POOL_6_CLOUD_NAME=your_cloud_name_6
CLOUDINARY_POOL_6_API_KEY=your_api_key_6
CLOUDINARY_POOL_6_API_SECRET=your_api_secret_6

# ─── Account 7 ───────────────────────────────────────────────
CLOUDINARY_POOL_7_CLOUD_NAME=your_cloud_name_7
CLOUDINARY_POOL_7_API_KEY=your_api_key_7
CLOUDINARY_POOL_7_API_SECRET=your_api_secret_7

# ─── Account 8 ───────────────────────────────────────────────
CLOUDINARY_POOL_8_CLOUD_NAME=your_cloud_name_8
CLOUDINARY_POOL_8_API_KEY=your_api_key_8
CLOUDINARY_POOL_8_API_SECRET=your_api_secret_8

# ─── Account 9 ───────────────────────────────────────────────
CLOUDINARY_POOL_9_CLOUD_NAME=your_cloud_name_9
CLOUDINARY_POOL_9_API_KEY=your_api_key_9
CLOUDINARY_POOL_9_API_SECRET=your_api_secret_9

# ─── Account 10 ──────────────────────────────────────────────
CLOUDINARY_POOL_10_CLOUD_NAME=your_cloud_name_10
CLOUDINARY_POOL_10_API_KEY=your_api_key_10
CLOUDINARY_POOL_10_API_SECRET=your_api_secret_10

# ─── Account 11 ──────────────────────────────────────────────
CLOUDINARY_POOL_11_CLOUD_NAME=your_cloud_name_11
CLOUDINARY_POOL_11_API_KEY=your_api_key_11
CLOUDINARY_POOL_11_API_SECRET=your_api_secret_11

# ─── Account 12 ──────────────────────────────────────────────
CLOUDINARY_POOL_12_CLOUD_NAME=your_cloud_name_12
CLOUDINARY_POOL_12_API_KEY=your_api_key_12
CLOUDINARY_POOL_12_API_SECRET=your_api_secret_12

# ─── Account 13 ──────────────────────────────────────────────
CLOUDINARY_POOL_13_CLOUD_NAME=your_cloud_name_13
CLOUDINARY_POOL_13_API_KEY=your_api_key_13
CLOUDINARY_POOL_13_API_SECRET=your_api_secret_13

# ─── Account 14 ──────────────────────────────────────────────
CLOUDINARY_POOL_14_CLOUD_NAME=your_cloud_name_14
CLOUDINARY_POOL_14_API_KEY=your_api_key_14
CLOUDINARY_POOL_14_API_SECRET=your_api_secret_14
```

---

## Where to Find These Values

1. Go to [https://cloudinary.com/console](https://cloudinary.com/console)
2. Log into each account
3. On the Dashboard, you'll see:
   - **Cloud Name** → use for `CLOUDINARY_POOL_<N>_CLOUD_NAME`
   - **API Key** → use for `CLOUDINARY_POOL_<N>_API_KEY`
   - **API Secret** → click "Reveal" → use for `CLOUDINARY_POOL_<N>_API_SECRET`

---

## Notes

- **You can start with fewer accounts** — just add as many as you have. The system auto-discovers all `CLOUDINARY_POOL_*` vars.
- **Indexes don't need to be contiguous** — you can have 0, 1, 2, 5, 10 and it still works.
- **You can add more accounts later** without code changes — just add the env vars and restart.
- **Total env vars** = Number of accounts × 3 (e.g., 15 accounts = 45 env vars)
- **Legacy vars are optional** — keep `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` as fallback if you want.

---

## Admin API (for monitoring)

Once deployed, you can check pool status:

```
GET  /api/admin/cloudinary/pool-status     → View all accounts + usage
PATCH /api/admin/cloudinary/3/toggle       → Enable/disable account 3
POST /api/admin/cloudinary/reset-monthly   → Manual monthly reset
```
