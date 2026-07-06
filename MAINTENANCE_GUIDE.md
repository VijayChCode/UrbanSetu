# UrbanSetu Maintenance Mode Guide

This guide explains how to configure, activate, and deactivate **Full Maintenance Mode** and the **Upcoming Maintenance Alert Banner** on UrbanSetu.

---

## 1. Full Maintenance Mode (Blocks Site Access)

When active, the site redirects all users to a premium interactive maintenance screen showing a countdown, ongoing tasks, and a server connectivity ping status.

### Activation Method:
Configure your server environment variables (in your `.env` file or host dashboard like Render/Vercel):
```bash
MAINTENANCE_MODE=true
MAINTENANCE_END_TIME=2026-07-06T18:00:00Z  # (Optional) ISO timestamp for the countdown clock
MAINTENANCE_MESSAGE="Renovating infrastructure..."  # (Optional) Custom status message
```

### How to Stop/Deactivate:
Set the environment variable to `false`:
```bash
MAINTENANCE_MODE=false
```

---

## 2. Upcoming Maintenance Banner (Alerts Active Users)

Shows a Render-style top alert banner (amber gradient) on all pages to inform users of planned downtime without blocking website functionality.

### Activation Method:
Configure the following server environment variables:
```bash
UPCOMING_MAINTENANCE_MODE=true
UPCOMING_MAINTENANCE_MESSAGE="We will be upgrading critical infrastructure on July 8th. Follow our status page for updates."
```

> **Note**: Including the phrase **`"status page"`** anywhere in the message will automatically render it as a clickable hyperlink on the frontend pointing directly to the `/updates` log.

### Dismissal Behavior:
* Clicking the close `x` button on the banner stores a flag in the browser's `sessionStorage` (`upcoming_maintenance_dismissed: 'true'`).
* This keeps the banner hidden for the remainder of their session so it does not reappear on page transitions.

### How to Stop/Deactivate:
Set the environment variable to `false`:
```bash
UPCOMING_MAINTENANCE_MODE=false
```
