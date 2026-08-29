# Signup Page and Backend Fields Analysis

## Overview
This document provides a comprehensive analysis of the signup page (frontend) and backend implementation, including which fields have unique constraints, validation rules, and data handling.

---

## Frontend Signup Page (`web/src/pages/SignUp.jsx`)

### Form Fields Collected

1. **username** (Full Name)
   - Required: ✅ Yes
   - Type: Text
   - Validation: Frontend only (required attribute)
   - Sent to backend as: `username`

2. **email** (Email Address)
   - Required: ✅ Yes
   - Type: Email
   - Validation: Email format + OTP verification required
   - Special features:
     - OTP sent before signup can proceed
     - Email must be verified before form submission
     - Edit mode available if OTP sent but not verified
   - Sent to backend as: `email` (lowercased)

3. **mobileNumber** (Mobile Number)
   - Required: ✅ Yes
   - Type: Tel
   - Validation: 10-digit numeric only (pattern: `[0-9]{10}`)
   - Frontend: Only accepts digits, max length 10
   - Sent to backend as: `mobileNumber`

4. **role** (I want to...)
   - Required: ✅ Yes
   - Type: Select dropdown
   - Options:
     - `"user"` - Buy/Sell Properties
     - `"admin"` - Manage Platform (Admin)
   - Sent to backend as: `role`

5. **password** (Password)
   - Required: ✅ Yes
   - Type: Password
   - Validation: Must meet minimum requirements (checked via `meetsMinimumRequirements`)
   - Features: Password strength indicator, feedback system
   - Sent to backend as: `password` (hashed before storage)

6. **confirmPassword** (Confirm Password)
   - Required: ✅ Yes
   - Type: Password
   - Validation: Must match `password`
   - Not sent to backend (frontend validation only)

7. **address** (Optional)
   - Required: ❌ No
   - Not visible in signup form shown, but can be passed to backend
   - Sent to backend as: `address` (trimmed if provided)

### Additional Frontend Features

- **Email OTP Verification**: Required before signup
- **reCAPTCHA**: Required before form submission
- **Password Strength Meter**: Real-time feedback
- **Consent Checkbox**: Must agree to Terms and Privacy Policy

---

## Backend Model (`api/models/user.model.js`)

### Schema Fields

```javascript
{
  username: String (required)
  email: String (required, unique)
  password: String (required)
  mobileNumber: String (optional, unique, sparse)
  address: String (optional, trimmed)
  gender: String (optional, enum)
  avatar: String (optional, default)
  role: String (enum, default: "user")
  // ... additional admin/status fields
}
```

---

## Unique Constraints Analysis

### ✅ Fields with UNIQUE Constraints

#### 1. **email**
- **Unique**: ✅ **YES** (Database Level)
- **Location**: `user.model.js` line 11
- **Code**: `unique: true`
- **Backend Check**: Additional application-level check in `SignUp` controller
  - Line 116: `await User.findOne({ email: emailLower })`
- **Error Handling**: Returns error if email already exists
  - Error message: `"An account with this email already exists. Please sign in instead!"`
- **Case Sensitivity**: Email is lowercased before storage (`emailLower = email.toLowerCase()`)
- **Index**: MongoDB creates unique index automatically

#### 2. **mobileNumber**
- **Unique**: ✅ **YES** (Database Level)
- **Location**: `user.model.js` lines 20-21
- **Code**: 
  ```javascript
  unique: true,
  sparse: true  // Allows multiple null values
  ```
- **Backend Check**: Additional application-level check in `SignUp` controller
  - Line 123: `await User.findOne({ mobileNumber })`
- **Error Handling**: Returns error if mobile number already exists
  - Error message: `"An account with this mobile number already exists. Try signing in or use a different number."`
- **Sparse Index**: Allows multiple `null`/undefined values (since mobileNumber is optional)
- **Validation**: Must be exactly 10 digits if provided
- **Note**: Google OAuth users may have generated mobile numbers (`isGeneratedMobile: true`)

---

### ❌ Fields WITHOUT Unique Constraints

#### 1. **username**
- **Unique**: ❌ **NO**
- **Location**: `user.model.js` line 4-6
- **Code**: `type: String, required: true` (no unique property)
- **Historical Note**: There was a unique index on username that was dropped (see `fix-username-index.js`)
- **Result**: Multiple users can have the same username
- **Backend Behavior**: No duplicate check performed

#### 2. **password**
- **Unique**: ❌ **NO** (and shouldn't be)
- **Location**: `user.model.js` line 13-16
- **Storage**: Hashed using bcryptjs before storage
- **Hash**: `bcryptjs.hashSync(password, 10)`

#### 3. **address**
- **Unique**: ❌ **NO**
- **Location**: `user.model.js` line 31-34
- **Optional**: Yes, not required
- **Processing**: Trimmed if provided

#### 4. **role**
- **Unique**: ❌ **NO**
- **Location**: `user.model.js` line 50-54
- **Enum**: `["user", "admin", "rootadmin"]`
- **Default**: `"user"`

#### 5. **avatar**
- **Unique**: ❌ **NO**
- **Default**: Default profile picture URL if not provided

---

## Backend Validation (SignUp Controller)

### Email Validation
- **Format Check**: Basic regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **OTP Verification**: Must be `emailVerified: true` (frontend sends this flag)
- **Duplicate Check**: 
  - Database query: `User.findOne({ email: emailLower })`
  - If exists: Error `400` with message about existing account
- **Fraud Detection**: Skip fraud checks if email is OTP-verified
- **Soft Ban Check**: Checks `DeletedAccount` collection for banned/purged emails

### Mobile Number Validation
- **Format Check**: Must be exactly 10 digits: `/^[0-9]{10}$/`
- **Duplicate Check**: 
  - Database query: `User.findOne({ mobileNumber })`
  - If exists: Error `400` with message about existing mobile number
- **Required**: Yes for regular signup (not for Google OAuth)

### Role Validation
- **Required**: Yes (must be provided)
- **Valid Values**: `"user"` or `"admin"` (from frontend)
- **Admin Approval**: 
  - If `role === "admin"`: `adminApprovalStatus = "pending"`
  - If `role === "user"`: `adminApprovalStatus = "approved"`

### Password Validation
- **Hashing**: `bcryptjs.hashSync(password, 10)` (salt rounds: 10)
- **Frontend Strength**: Checked via `meetsMinimumRequirements()`
- **Backend**: No explicit validation in signup (relies on frontend)

### Address Validation (Optional)
- **If Provided**: Must not be empty string (trimmed)
- **Error**: `"Please provide a valid address"` if provided but empty

---

## Database Indexes Summary

### Unique Indexes
1. **email**: Unique index automatically created by MongoDB
2. **mobileNumber**: Unique sparse index (allows null duplicates)

### Non-Unique Indexes
- **username**: No unique index (was dropped previously)
- **All other fields**: No indexes defined

### Timestamps
- **createdAt**: Automatically added (via `{ timestamps: true }`)
- **updatedAt**: Automatically added (via `{ timestamps: true }`)

---

## Signup Flow

### Step-by-Step Process

1. **User fills form** → Frontend validation runs
2. **Email OTP sent** → User must verify email
3. **reCAPTCHA verified** → Required before submission
4. **Form submitted** → POST to `/api/auth/signup`
5. **Backend validations**:
   - Email format check
   - Email duplicate check (unique constraint)
   - Mobile number format check (10 digits)
   - Mobile number duplicate check (unique constraint)
   - Address validation (if provided)
   - Email verified check
6. **Soft ban check** → Check if email is in `DeletedAccount` collection
7. **Password hashing** → bcrypt hash
8. **User creation** → Save to database
9. **Welcome email** → Sent to user
10. **Response** → Success message (different for admin vs user)

---

## Error Messages

### Unique Constraint Violations

| Field | Error Code | Error Message |
|-------|-----------|---------------|
| email | 400 | "An account with this email already exists. Please sign in instead!" |
| mobileNumber | 400 | "An account with this mobile number already exists. Try signing in or use a different number." |

### Validation Errors

| Issue | Error Code | Error Message |
|-------|-----------|---------------|
| Invalid mobile format | 400 | "Please provide a valid 10-digit mobile number" |
| Empty address (if provided) | 400 | "Please provide a valid address" |
| Email not verified | 400 | "Please verify your email address before creating an account" |
| Role not provided | 400 | Frontend prevents submission |
| Password mismatch | 400 | Frontend prevents submission |

### Database-Level Errors

If MongoDB unique constraint is violated (shouldn't happen due to pre-checks):
- MongoDB error code: `E11000` (duplicate key error)
- Usually caught and handled by application-level checks

---

## Google OAuth Signup (`Google` Function)

### Differences from Regular Signup

1. **mobileNumber**: 
   - Not required
   - May be auto-generated later (`isGeneratedMobile: true`)
   - Unique constraint still applies if mobile number is added later

2. **Email**: 
   - Same unique constraint applies
   - If user exists → login flow
   - If new user → signup flow

3. **Password**: 
   - Auto-generated random password
   - Still hashed with bcrypt

4. **Username**: 
   - Auto-generated from Google name + random string
   - Format: `name.split(" ").join("").toLowerCase() + randomString`

---

## Key Takeaways

### ✅ Unique Fields (Database Level)
1. **email** - Fully unique (no duplicates allowed)
2. **mobileNumber** - Unique but sparse (allows null/undefined duplicates)

### ❌ Non-Unique Fields
1. **username** - Multiple users can have same username
2. **password** - Hashed, obviously not unique
3. **address** - Multiple users can have same address
4. **role** - Multiple users can have same role
5. **avatar** - Multiple users can have same avatar URL

### 🔒 Security Features
- Email OTP verification required
- reCAPTCHA required
- Password hashing (bcrypt, 10 rounds)
- Email lowercasing for consistency
- Soft ban checking before signup
- Fraud detection (for non-OTP verified emails)

### 📊 Index Strategy
- Only **email** and **mobileNumber** have unique indexes
- **username** unique index was intentionally removed
- Sparse index on mobileNumber allows optional field behavior

---

## Recommendations

1. **Username Uniqueness**: Consider adding unique constraint if usernames should be unique identifiers
2. **Email Index**: Already optimized with unique index ✅
3. **Mobile Number Index**: Already optimized with unique sparse index ✅
4. **Composite Indexes**: Consider indexes on frequently queried fields (e.g., `role`, `status`)

---

## Summary Table

| Field | Required | Unique | Index | Validation | Notes |
|-------|----------|--------|-------|------------|-------|
| username | ✅ | ❌ | ❌ | None | Can have duplicates |
| email | ✅ | ✅ | ✅ Unique | Format + OTP + Duplicate Check | Lowercased |
| mobileNumber | ✅ (regular), ❌ (OAuth) | ✅ (sparse) | ✅ Unique Sparse | 10 digits + Duplicate Check | Allows null |
| password | ✅ | ❌ | ❌ | Strength (frontend) | Hashed with bcrypt |
| role | ✅ | ❌ | ❌ | Enum check | admin requires approval |
| address | ❌ | ❌ | ❌ | Not empty if provided | Optional |
| confirmPassword | ✅ (frontend) | ❌ | ❌ | Must match password | Not sent to backend |
