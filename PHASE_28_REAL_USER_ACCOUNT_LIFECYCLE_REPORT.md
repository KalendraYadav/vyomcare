# PHASE 28 — REAL USER ACCOUNT LIFECYCLE & ADMINISTRATIVE PROVISIONING AUDIT REPORT

## 1. Executive Summary

BioTrack / VyomCare has been audited end-to-end to verify that the platform operates on an authoritative, administrator-managed, real-user provisioning model. The audit confirmed that real users can be securely provisioned by authorized administrators, receive cryptographic email verification tokens, verify their accounts, log in across desktop and mobile devices via HTTPS, and operate strictly within their server-authoritative RBAC permissions and facility isolation boundaries.

Zero manual database insertions or plaintext credential bypasses are required or permitted. All database passwords remain hashed with bcrypt ($2b$ with 10 salt rounds), email verification tokens are stored exclusively as deterministic SHA-256 digests, and unverified or deactivated accounts are strictly forbidden from logging in or refreshing tokens.

All 26 focused Phase 28 lifecycle tests, 55 Phase 24 RBAC tests, Phase 25 batch integrity checks, Phase 26 audit logging checks, and 32 Phase 27 multi-hospital scenario tests passed with 100% success.

---

## 2. Current Authentication Architecture

The BioTrack authentication subsystem is implemented in NestJS (`backend/src/modules/auth/auth.service.ts`) using JWT bearer tokens and secure httpOnly refresh cookies, backed by MySQL and Redis:

1. **Login Processing (`POST /api/auth/login`)**:
   - Normalizes incoming email addresses (`email.trim().toLowerCase()`).
   - Evaluates Redis-backed rate limiting & lockout (`auth:lockout:<email>`), enforcing a 15-minute lockout after 5 consecutive failed attempts.
   - Retrieves the user record from the MySQL `user` table.
   - Checks account status: if `status === 'DEACTIVATED'`, throws `403 Forbidden ('This account has been deactivated. Contact your administrator.')`.
   - Checks email certification: if `emailVerified === false`, throws `403 Forbidden ('Email address not verified. Please verify your email before logging in.')`.
   - Compares candidate plaintext password against `passwordHash` via `bcrypt.compare()`.
   - On successful authentication, clears failed lockout counters in Redis and updates `lastLoginAt`.
   - Signs a 15-minute JWT access token containing authoritative claims: `{ sub: user.id, role: user.role, facilityId: user.facilityId }`.
   - Generates a high-entropy 7-day refresh token (`uuidv4() + 32-hex crypto random bytes`), computes its SHA-256 digest, and stores the digest in the `refreshToken` table.
   - Returns the JWT access token and user profile object (excluding password hashes and verification tokens) while setting the httpOnly `refresh_token` cookie.

2. **Token Rotation & Refresh (`POST /api/auth/refresh`)**:
   - Performs an $O(1)$ indexed lookup on the SHA-256 hash of the presented refresh cookie.
   - Deletes the old token record immediately (rotation) and issues a new access token and fresh refresh token.
   - Enforces active status and verified email checks on refresh.

3. **Logout (`POST /api/auth/logout`)**:
   - Nullifies the active refresh token hash from the database and clears the httpOnly cookie.

---

## 3. Current User Provisioning Architecture

User provisioning is governed by authoritative administrative endpoints (`POST /api/users` in `backend/src/modules/users/users.service.ts`):

```
                       ┌─────────────────┐
                       │   SUPER_ADMIN   │
                       └────────┬────────┘
                                │ creates / provisions
     ┌──────────────────────────┼──────────────────────────┐
     ▼                          ▼                          ▼
HOSPITAL_ADMIN         COLLECTION_STAFF           GOVERNMENT_AUTHORITY
TREATMENT_FACILITY     TRANSPORT_PERSONNEL        SUPER_ADMIN
(Requires Facility)    (No Facility)              (No Facility)
     │
     │ creates / provisions
     ▼
HOSPITAL_STAFF / HOSPITAL_ADMIN
(Strictly Scoped to Own Hospital Facility)
```

- **Administrative Authorization Guard**: Guarded by `AuthGuard('jwt')` and `RolesGuard`, permitting only `SUPER_ADMIN` and `HOSPITAL_ADMIN`.
- **Tenant & Role Boundary Enforcement**:
  - `HOSPITAL_ADMIN` is strictly limited to creating `HOSPITAL_STAFF` or `HOSPITAL_ADMIN` within their own affiliated hospital facility (`actor.facilityId`). Any attempt to provision platform-wide roles (`SUPER_ADMIN`, `COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`, `GOVERNMENT_AUTHORITY`) or target a different facility is rejected with `403 Forbidden`.
  - `SUPER_ADMIN` can provision all 7 roles across any facility or platform scope.
- **Facility Integrity**:
  - Roles requiring facility association (`HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `TREATMENT_FACILITY_STAFF`) must specify an active, non-suspended facility.
  - Type matching is strictly validated: Hospital staff cannot be assigned to CBWTFs, and CBWTF staff cannot be assigned to Hospitals.

---

## 4. Password Lifecycle

Newly provisioned users currently undergo the following secure password lifecycle:

1. **Password Establishment**:
   - An authorized administrator specifies an initial temporary password (minimum 8 characters) during user creation in `CreateUserDialog`.
   - The password is immediately hashed on the server using `bcrypt.hash(password, 10)` before database insertion.
   - The database stores only `passwordHash`. Plaintext passwords are never stored in MySQL or logged.
   - The user record is initialized with `mustChangePassword = true`.
2. **Exposure Prevention**:
   - Neither the API response of `POST /api/users` nor `GET /api/users` nor `GET /api/users/me` ever includes `passwordHash` or `passwordResetTokenHash`.
3. **Password Security**:
   - Passwords cannot be guessed via brute-force due to Redis-backed account lockout (5 attempts per 15 minutes).

---

## 5. Email Verification Lifecycle

The platform enforces cryptographic email verification before any account can authenticate:

1. **Token Generation**:
   - Upon provisioning, the server generates a cryptographically random raw token (`uuidv4() + crypto.randomBytes(24).toString('hex')`).
   - A deterministic SHA-256 hash is computed and stored in `user.emailVerificationTokenHash`.
   - The raw token is **never** stored in the database.
   - An expiration timestamp (`emailVerificationExpiresAt`) is set to 24 hours from creation.
2. **Dispatch & Link Construction**:
   - `EmailService.sendVerificationEmail` constructs the verification URL dynamically using the caller origin / Cloudflare tunnel URL (`${baseUrl}/verify-email?token=<rawToken>`).
   - In hackathon/development mode, the link is logged cleanly to the backend console and presented to the provisioning administrator for operational preview.
3. **Verification Gate**:
   - When an unverified user attempts to log in, `AuthService.login` rejects the attempt with `403 Forbidden: 'Email address not verified. Please verify your email before logging in.'`.
4. **Token Consumption (`POST /api/auth/verify-email`)**:
   - The client submits the raw token from the link.
   - The server computes the SHA-256 digest and performs an indexed lookup in MySQL.
   - Validates that `emailVerificationExpiresAt >= now()`.
   - **Single-Use Consumption**: Sets `emailVerified = true`, `emailVerifiedAt = now()`, and nullifies both `emailVerificationTokenHash = null` and `emailVerificationExpiresAt = null`.
   - Re-attempting verification with the same token is immediately rejected with `400 Bad Request`.
5. **Anti-Enumeration Resend (`POST /api/auth/resend-verification`)**:
   - Allows requesting a fresh verification email with a 120-second Redis cooldown per email.
   - Returns a generic success response regardless of whether the email exists, preventing user enumeration attacks.

---

## 6. Real User Test

A fresh real user was created, verified, and authenticated through the actual application APIs:

- **Created User**: `Dr. Ananya Sen` (`dr.ananya.1788802449379@citygeneral.in`)
- **Role**: `HOSPITAL_STAFF`
- **Facility**: `City General Hospital` (`a13ef6cd-ed6c-4f95-8c49-3c5e781e9e74`)
- **Initial State**: `emailVerified = false`, `status = ACTIVE`
- **Pre-Verification Login Attempt**: HTTP 403 Forbidden (Blocked by email verification gate).
- **Verification Execution**: Completed via `POST /api/auth/verify-email` with raw token. Single-use token invalidated.
- **Post-Verification Login**: HTTP 200 OK, JWT issued.
- **Server Identity Verification**: `GET /api/users/me` returned server-authoritative role `HOSPITAL_STAFF` and facility `City General Hospital`.

---

## 7. Cross-Device Login

Cross-device authentication was tested across the active Cloudflare HTTPS Quick Tunnel:

- **Active Tunnel URL**: `https://outreach-desert-rankings-innovative.trycloudflare.com`
- **Gateway**: Nginx reverse proxy routing TLS traffic to Next.js (port 3000) and NestJS (port 3001).
- **Test Results**:
  1. Authenticated as the newly created real user `Dr. Ananya Sen` via `POST https://outreach-desert-rankings-innovative.trycloudflare.com/api/auth/login`.
  2. Verified JWT access token issuance over external HTTPS.
  3. Queried `GET /api/users/me` over HTTPS with valid session and received full authoritative hospital profile.

---

## 8. Account Deactivation

Administrative account deactivation was tested:

1. **Status Update**: Super Admin executed `PATCH /api/users/<id>/status` with `{ status: 'DEACTIVATED' }`.
2. **Audit Record**: `USER_STATUS_UPDATED` audit log recorded in MySQL.
3. **Login Enforcement**: Deactivated user attempted login via `POST /api/auth/login` → Blocked with `403 Forbidden ('This account has been deactivated. Contact your administrator.')`.
4. **Token Refresh Enforcement**: Deactivated user refresh attempts are blocked with `403 Forbidden`.
5. **Reactivation**: Administrator updated status back to `ACTIVE` → User successfully logged in with `200 OK`.

---

## 9. Duplicate Email Test

- Attempted to provision a second user with the existing email `dr.ananya.1788802449379@citygeneral.in`.
- Backend returned `409 Conflict: 'A user with this email address already exists'`.
- Verified that existing account data, password hash, and facility linkages were completely untouched.

---

## 10. RBAC Security Tests

| Test Case | Actor | Action | Result | Status |
|---|---|---|---|---|
| Unauthenticated Provisioning | Anonymous | `POST /api/users` | 401 Unauthorized | ✅ PASS |
| Non-Admin User Provisioning | `HOSPITAL_STAFF` | `POST /api/users` | 403 Forbidden | ✅ PASS |
| Role Escalation Attempt | `HOSPITAL_ADMIN` | Provision `SUPER_ADMIN` | 403 Forbidden | ✅ PASS |
| Role Boundary Violation | `HOSPITAL_ADMIN` | Provision `COLLECTION_STAFF` | 403 Forbidden | ✅ PASS |
| Cross-Facility Modification | `HOSPITAL_ADMIN` | Modify user in another hospital | 403 Forbidden | ✅ PASS |
| Unverified Login Gate | Unverified User | `POST /api/auth/login` | 403 Forbidden | ✅ PASS |
| Deactivated Login Gate | Deactivated User | `POST /api/auth/login` | 403 Forbidden | ✅ PASS |
| Single-Use Token Reuse | Public | Re-use verification token | 400 Bad Request | ✅ PASS |

---

## 11. AuditLog Verification

Administrative user lifecycle actions automatically generate dedicated, persistent records in the `audit_log` table:

1. **`USER_PROVISIONED`**:
   - Recorded when `POST /api/users` succeeds.
   - Metadata captures `role`, `email`, and `facilityId`.
   - Actor user ID captures the provisioning administrator.
2. **`USER_STATUS_UPDATED`**:
   - Recorded when `PATCH /api/users/:id/status` succeeds.
   - Metadata captures `previousStatus`, `newStatus`, and `targetRole`.
   - Verified via `GET /api/audit-log` and direct MySQL query.

---

## 12. Database Verification

Direct MySQL inspection of the `user` and `audit_log` tables confirmed:

```sql
SELECT id, email, role, facility_id, status, email_verified, LEFT(password_hash, 10), email_verification_token_hash FROM user WHERE email LIKE 'dr.ananya%';
```

| Column | Observed Database Value | Compliance Assessment |
|---|---|---|
| `email` | `dr.ananya.1788802449379@citygeneral.in` | Valid unique string |
| `role` | `HOSPITAL_STAFF` | Valid `UserRole` enum |
| `facility_id` | `a13ef6cd-ed6c-4f95-8c49-3c5e781e9e74` | Correct Hospital foreign key |
| `status` | `ACTIVE` | Valid `UserStatus` enum |
| `email_verified` | `1` (true) | Correct boolean state |
| `password_hash` | `$2b$10$iQg...` | Bcrypt 10 salt rounds (NEVER plaintext) |
| `email_verification_token_hash` | `NULL` | Nullified upon single-use verification |

AuditLog records confirmed:
- `d0d87189-...`: `USER_PROVISIONED` on entity `5e29ea0b-...`
- `7d738aab-...`: `USER_STATUS_UPDATED` on entity `5e29ea0b-...`
- `e3c19aec-...`: `USER_STATUS_UPDATED` on entity `5e29ea0b-...`

---

## 13. UI / User Management Review

The frontend user management interface (`frontend/src/app/(app)/admin/users/page.tsx` and `CreateUserDialog.tsx`) was inspected:

1. **Role Filtering & Indicators**: Distinct color-coded badges for all 7 certified roles (`SUPER_ADMIN`, `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`, `TREATMENT_FACILITY_STAFF`, `GOVERNMENT_AUTHORITY`).
2. **Facility Linking**: Super Admin view provides an affiliated facility selector with type indicators. Hospital Admin view automatically locks the facility to their own hospital.
3. **Account & Verification Status**: Displays active status toggles and verified badges.
4. **Provisioning Feedback**: Upon creation, displays a success dialog with details, copyable verification link (for hackathon/demo operator ease), and instructions.
5. **Verification Landing Page (`/verify-email`)**: Handles token validation states (Verifying, Success with login button, and Error with resend form).

---

## 14. Bugs Found

None. The user account lifecycle, authentication guards, role matrix, and database protections are operating correctly.

---

## 15. Fixes Applied

No code changes were required. The existing implementation already satisfies all security and architectural requirements.

---

## 16. Regression Results

All existing test suites and previous phase scenarios remain 100% operational:

- **Backend Unit Tests**: 6/6 test suites passed (31 tests).
- **Phase 24 RBAC & Facility Isolation**: 55/55 tests passed.
- **Phase 25 Waste Lifecycle Batch**: Batch `BMW-2026-000022` verified intact in `VERIFIED_CLOSED` status.
- **Phase 26 Audit Log Verification**: Verified SLA rules, facility approvals, and user actions.
- **Phase 27 Multi-Hospital Demo Scenario**: 32/32 tests passed (Apex Metro & City General hospitals, GreenDispose CBWTF).
- **Phase 28 Lifecycle Audit**: 26/26 tests passed.
- **Docker Infrastructure**: All 5 production containers (`mysql`, `redis`, `backend`, `frontend`, `proxy`) healthy and running.

---

## 17. Remaining Gaps

1. **External SMTP/SES Provider**: In development and hackathon demo environments, email dispatch outputs the verification link to the backend logger and dialog modal rather than an external SMTP server (e.g., AWS SES, Resend, SendGrid). In production, `EmailService` can be bound to transactional SMTP credentials via environment variables without changing business logic.
2. **User Self-Service Password Reset**: The database schema includes `passwordResetTokenHash` and `passwordResetExpiresAt` fields. A self-service forgot-password workflow can be hooked to these fields in future enhancements.

---

## 18. Recommended Production / Hackathon User Management Flow

```
1. Super Admin or Hospital Admin logs into BioTrack Admin Console (/admin/users).
2. Admin clicks "Provision New User", fills out Name, Email, Role, and Temporary Password.
3. Backend creates unverified user record, hashes password with bcrypt, generates SHA-256 token hash, and emits USER_PROVISIONED audit log.
4. New user receives verification link (via email in production or console/dialog in demo).
5. User clicks link -> /verify-email?token=... certifies email ownership and marks account verified.
6. User logs in with email and password -> receives JWT access token and role-specific dashboard.
```

---

## 19. Final Verdict

# REAL USER LIFECYCLE VERIFIED — NO CODE CHANGES
