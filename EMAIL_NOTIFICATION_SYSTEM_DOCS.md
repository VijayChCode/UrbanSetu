# Email Notification System Documentation

## Overview
This document outlines the automated email notification system implemented for the UrbanSetu platform. The system handles lifecycle events for Loans and Rental Payments, ensuring users are timely informed about due dates, overdue statuses, and successful transactions.

## 1. Implemented Services

### A. Rental Payment Reminders
**File:** `api/services/rentReminderService.js`

This service is responsible for scanning the database for upcoming and overdue rent payments and triggering the appropriate email reminders.

*   **Schedule:** Runs daily at 10:30 AM IST.
*   **Logic:**
    *   Scans all `RentWallet` documents.
    *   Identifies payments with status `pending` or `overdue`.
    *   Calculates the number of days until (or past) the due date.

**Reminder Triggers:**
*   **Upcoming Due:**
    *   3 Days before due date.
    *   1 Day before due date.
    *   On the Due Date (0 days remaining).
*   **Overdue:**
    *   1 Day overdue.
    *   3 Days overdue.
    *   7 Days overdue.
    *   15 Days overdue.
    *   30 Days overdue (and every 30 days thereafter).

### B. Loan EMI Reminders
**File:** `api/services/loanReminderService.js`

This service manages the lifecycle of loan notifications, alerting users about their Equated Monthly Installments (EMIs).

*   **Schedule:** Runs daily at 9:30 AM IST.
*   **Logic:**
    *   Iterates through active `RentalLoan` documents.
    *   Checks the `emiSchedule` for pending payments.

**Reminder Triggers:**
*   **Upcoming Due:** 7, 3, and 1 day before the due date.
*   **Due Date:** On the exact due date.
*   **Overdue:** 1, 3, 7, 15, and 30 days past due (recurring every 30 days).

## 2. Email Templates

All email templates are located in `api/utils/emailService.js`. They utilize a consistent, responsive HTML design with the UrbanSetu branding.

### A. Rental Payment Emails

#### 1. Rent Payment Due Reminder
*   **Function:** `sendRentPaymentDueReminderEmail`
*   **Trigger:** 3 days before, 1 day before, and on the due date.
*   **Content:**
    *   Property Name
    *   Payment Month & Year
    *   Amount Due
    *   Due Date
    *   "Pay Rent Now" button linking to the payment page.

#### 2. Rent Payment Overdue Reminder
*   **Function:** `sendRentPaymentOverdueReminderEmail`
*   **Trigger:** 1, 3, 7, 15, 30+ days after the due date.
*   **Content:**
    *   **Urgent Alert:** Red-themed design to indicate urgency.
    *   Days Overdue count.
    *   Base Amount + Penalty/Late Fee breakdown.
    *   Total Payable Amount.
    *   "Pay Rent Now" button.

#### 3. Rent Payment Confirmation
*   **Function:** `sendRentPaymentConfirmationEmail`
*   **Trigger:** Successfully completed rent payment (via Razorpay/PayPal).
*   **Content:**
    *   Transaction ID.
    *   Amount Paid.
    *   Payment Date.
    *   "View Rent Wallet" button.

### B. Loan Emails

#### 1. Loan EMI Due Reminder
*   **Function:** `sendLoanEMIDueReminderEmail`
*   **Trigger:** 7, 3, 1 day before and on due date.
*   **Content:**
    *   Loan Type (e.g., Security Deposit Loan).
    *   EMI Amount.
    *   Due Date.
    *   "Pay EMI Now" button.

#### 2. Loan EMI Overdue Reminder
*   **Function:** `sendLoanEMIOverdueReminderEmail`
*   **Trigger:** 1, 3, 7, 15, 30+ days overdue.
*   **Content:**
    *   **Overdue Alert:** Highlighted warning.
    *   Penalty Amount included in the total.
    *   Total Outstanding Amount.

#### 3. Loan Repayment Confirmation
*   **Function:** `sendLoanRepaidEmail`
*   **Trigger:** When the final EMI is paid and the loan status becomes `repaid`.
*   **Content:**
    *   "Loan Fully Repaid" congratulatory message.
    *   Total Amount Paid over the loan tenure.
    *   Closure Date.
    *   "View Loan Details" button.

### C. Festival Greetings & Real-Time Alerts
**File:** `api/schedulers/festivalGreetingScheduler.js`

This service automatically detects current cultural/seasonal festivals and delivers rich greetings to all eligible active users simultaneously via email, real-time in-app notification bell alerts, and mobile push notifications.

*   **Schedule:** Runs daily at **9:30 AM IST** (`30 9 * * *` with `timezone: "Asia/Kolkata"`).
*   **Logic:**
    *   Queries `api/utils/seasonalEvents.js` for active festival themes on the current date.
    *   Finds active users who haven't yet received greetings for the festival in the current year.
    *   Dispatches responsive HTML email via `sendFestivalGreetingEmail()`.
    *   Instantly creates in-app notification (`type: 'festival_greeting'`).
    *   Emits real-time WebSocket socket event (`notificationCreated`) to ring the user's **NotificationBell** and display interactive toast popups.
    *   Dispatches mobile push notification via `sendPushNotification()`.
    *   Updates the user's `festivalGreetingsSent` history in MongoDB to prevent duplicate sends.

## 3. Integration Points

### A. Scheduler Service
**File:** `api/services/schedulerService.js` & `api/schedulers/festivalGreetingScheduler.js`
*   The `node-cron` library is used to orchestrate these checks.
*   **Integration:**
    ```javascript
    import { startScheduler } from './services/schedulerService.js';
    import { startFestivalGreetingScheduler } from './schedulers/festivalGreetingScheduler.js';

    // ... inside startServer ...
    startScheduler(app);
    startFestivalGreetingScheduler(app); // Runs daily at 9:30 AM IST
    ```

### B. Payment Route Integration
**File:** `api/routes/payment.route.js`
*   **Rent Confirmation:** Inside the `/verify` route (or equivalent payment success handler), when `paymentType === 'monthly_rent'`, the system calls `sendRentPaymentConfirmationEmail`.
*   **Loan Repayment:** When `paymentType === 'emi'`, the system checks if the loan is fully paid. If so, it calls `sendLoanRepaidEmail`.

## 4. How to Test

1.  **Manual Trigger:** You can manually invoke `processFestivalGreetings(app)` or `checkAndSendRentReminders()` in a test script to force an immediate run.
2.  **Date Manipulation:** In a development environment, you can modify the `dueDate` of a `RentWallet` or `RentalLoan` item in the database to verify rent/loan reminders.
3.  **Logs:** Check server logs for festival runs:
    *   `🎉 [Festival Greetings] Starting daily check...`
    *   `✅ Sent combined Diwali greeting and in-app notification to username`

---
*Documentation updated on 2026-08-26*
