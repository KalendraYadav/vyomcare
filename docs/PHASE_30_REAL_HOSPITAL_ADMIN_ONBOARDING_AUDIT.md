# Phase 30 — Real Hospital Admin Onboarding Verification Audit

**Document Version:** 1.0  
**Audit Date:** 2026-09-07  
**Protocol:** Read-Only Verification Audit — Zero Code, Database, or Migration Modifications  
**Target Workflow:** Real `HOSPITAL_ADMIN` Lifecycle, Server Authorization, Facility Boundary & Onboarding Flow  

---

## 1. Executive Summary

This audit performs an end-to-end, line-by-line verification of the real-user onboarding lifecycle for a newly created `HOSPITAL_ADMIN` in the BioTrack (VyomCare) codebase.

The audit examined:
1. Backend authentication, user provisioning services, and controllers.
2. Server-side RBAC guards (`RolesGuard`) and tenant facility isolation checks.
3. Cryptographic token generation, SHA-256 hashing, single-use consumption, and expiration.
4. Database schema definitions (`User`, `Facility`, `RefreshToken`, `AuditLog`).
5. Frontend user management screens, dialogs, and verification pages.
6. Automated test suites (`users.service.spec.ts`, `auth.service.spec.ts`, Phase 24, Phase 26, Phase 27, and Phase 28).

---

## 2. Step-by-Step Onboarding Flow Verification

```
[ Step 1: SUPER_ADMIN Provisions HOSPITAL_ADMIN ]
  POST /api/users
  Headers: Authorization: Bearer <SUPER_ADMIN_JWT>
  Body: { name, email, role: "HOSPITAL_ADMIN", facilityId: "hosp-uuid", password }
  ✓ Verified: Creates User with emailVerified = false, status = ACTIVE, mustChangePassword = true.
  ✓ Verified: Password hashed with bcrypt (10 rounds).
  ✓ Verified: Facility type verified as HOSPITAL and status != SUSPENDED.
  ✓ Verified: Cryptographic token generated, SHA-256 hash stored in DB with 24h expiration.
  ✓ Verified: USER_PROVISIONED record inserted into audit_log table.

[ Step 2: Verification Link Dispatch ]
  EmailService.sendVerificationEmail()
  ✓ Verified: Verification URL dynamically constructed from request origin / Cloudflare tunnel.
  ✓ Verified: Card logged to backend console; preview link returned in API response for demo operator.

[ Step 3: Pre-Verification Login Attempt ]
  POST /api/auth/login with valid credentials
  ✓ Verified: Rejected with 403 Forbidden: 'Email address not verified. Please verify your email before logging in.'

[ Step 4: Cryptographic Email Verification ]
  POST /api/auth/verify-email with rawToken
  ✓ Verified: Computes SHA-256 hash of token; matches DB index.
  ✓ Verified: Validates expiration timestamp (expiresAt >= now()).
  ✓ Verified: Single-use consumption: marks emailVerified = true, emailVerifiedAt = now(), nullifies tokenHash.
  ✓ Verified: Replay with same token rejected with 400 Bad Request.

[ Step 5: Post-Verification Login ]
  POST /api/auth/login with email & temporary password
  ✓ Verified: Authenticates successfully with 200 OK.
  ✓ Verified: Issues 15-minute JWT access token with claims { sub, role: "HOSPITAL_ADMIN", facilityId: "hosp-uuid" }.
  ✓ Verified: Sets 7-day httpOnly refresh cookie with SHA-256 hash stored in refreshToken table.

[ Step 6: First Password Change & Enforcement ]
  ✓ Verified: mustChangePassword is true in user payload and DB.
  ⏳ GAP: No dedicated PATCH /api/users/me/password endpoint currently exists; password change is not yet enforced by a blocking server-side guard.

[ Step 7: Hospital Admin Operational Access ]
  GET /api/users/me & /hospital/dashboard
  ✓ Verified: Returns authoritative profile locked to assigned hospital.
  ✓ Verified: Access permitted to hospital dashboard, batch register, and hospital personnel management.

[ Step 8: Hospital Admin Provisions Hospital Staff ]
  POST /api/users
  Headers: Authorization: Bearer <HOSPITAL_ADMIN_JWT>
  Body: { name, email, role: "HOSPITAL_STAFF", password }
  ✓ Verified: Permitted on server. Facility ID is hard-locked to actor.facilityId.

[ Step 9: Boundary & Unauthorized Role Prevention ]
  HOSPITAL_ADMIN attempts provisioning SUPER_ADMIN, COLLECTION_STAFF, TRANSPORT_PERSONNEL, CBWTF, or GOV
  ✓ Verified: Throws 403 Forbidden: 'You can only create hospital roles'.
  HOSPITAL_ADMIN attempts modifying users in another hospital
  ✓ Verified: Throws 403 Forbidden: 'You are not authorized to modify users outside your facility'.
```

---

## 3. Specific Question Answers

### 1. What exact API creates the Hospital Admin?
- **Endpoint**: `POST /api/users`
- **Controller**: `UsersController.create()` (`backend/src/modules/users/users.controller.ts`, lines 27–36)
- **Service**: `UsersService.create()` (`backend/src/modules/users/users.service.ts`, lines 26–151)
- **Guards**: `AuthGuard('jwt')`, `RolesGuard` with `@Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)`
- **Payload**:
  ```json
  {
    "name": "Dr. Aisha Sharma",
    "email": "admin@citygeneral.in",
    "role": "HOSPITAL_ADMIN",
    "facilityId": "a13ef6cd-ed6c-4f95-8c49-3c5e781e9e74",
    "password": "InitialTempPassword#2026",
    "phone": "+91 98765 43210"
  }
  ```

### 2. What exact API sends/resends verification?
- **Initial Dispatch**: Triggered internally inside `UsersService.create()` via `EmailService.sendVerificationEmail()`.
- **Resend Endpoint**: `POST /api/auth/resend-verification`
- **Controller**: `AuthController.resendVerification()` (`backend/src/modules/auth/auth.controller.ts`, lines 62–70)
- **Service**: `AuthService.resendVerification()` (`backend/src/modules/auth/auth.service.ts`, lines 252–305)
- **Rate Limit**: Enforces a 120-second Redis cooldown via key `auth:resend:<normalizedEmail>`.
- **Anti-Enumeration**: Returns generic success message even if the user does not exist or is already verified.

### 3. What exact API verifies the email?
- **Endpoint**: `POST /api/auth/verify-email`
- **Controller**: `AuthController.verifyEmail()` (`backend/src/modules/auth/auth.controller.ts`, lines 56–60)
- **Service**: `AuthService.verifyEmail()` (`backend/src/modules/auth/auth.service.ts`, lines 207–247)
- **Payload**:
  ```json
  {
    "token": "f3a92361-7405-4c87-a13f-6ae4dadaeaca94e1fa1726a78ecc304de01c8a3cbf94ba5390a593ef179d"
  }
  ```

### 4. What exact API handles the first password change?
- **Status**: **NOT YET IMPLEMENTED**.
- There is currently no dedicated `PATCH /api/users/me/password` endpoint. Users currently authenticate using the temporary password assigned during provisioning.

### 5. Is `mustChangePassword` enforced server-side or only in the frontend?
- **Status**: **NOT ENFORCED**.
- The `must_change_password` boolean column exists in the Prisma `User` schema and is initialized to `true` on creation and returned in the user profile. However, there is no server-side interceptor/guard that rejects requests until the password is changed, nor is there a frontend blocking modal.

### 6. Can an unverified Hospital Admin log in?
- **NO**. `AuthService.login()` line 66:
  ```typescript
  if (!user.emailVerified) {
    throw new ForbiddenException(
      'Email address not verified. Please verify your email before logging in.',
    );
  }
  ```

### 7. Can a deactivated Hospital Admin log in?
- **NO**. `AuthService.login()` line 59:
  ```typescript
  if (user.status === 'DEACTIVATED') {
    throw new ForbiddenException(
      'This account has been deactivated. Contact your administrator.',
    );
  }
  ```
- In addition, `AuthService.refresh()` line 149 rejects deactivated accounts attempting token rotation.

### 8. Can the Hospital Admin create Hospital Staff after onboarding?
- **YES**. `UsersService.create()` line 51 explicitly permits `HOSPITAL_ADMIN` to provision `HOSPITAL_STAFF` with `facilityId` automatically locked to `actor.facilityId`.

### 9. Can they create another Hospital Admin?
- **YES**. `UsersService.create()` line 54 explicitly permits `[UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF]`. The new Hospital Admin is locked to the same hospital facility.

### 10. Can they create Collection Staff?
- **NO**. Blocked on server with `403 Forbidden: 'You can only create hospital roles'`.

### 11. Can they create Transport Personnel?
- **NO**. Blocked on server with `403 Forbidden: 'You can only create hospital roles'`.

### 12. Can they create Treatment Facility Staff?
- **NO**. Blocked on server with `403 Forbidden: 'You can only create hospital roles'`.

### 13. Can they create Government Authority?
- **NO**. Blocked on server with `403 Forbidden: 'You can only create hospital roles'`.

### 14. Can they create Super Admin?
- **NO**. Blocked on server with `403 Forbidden: 'You can only create hospital roles'`.

### 15. Can they create users belonging to another hospital?
- **NO**. For any `HOSPITAL_ADMIN` actor, `facilityId` is forced on the server to `actor.facilityId ?? undefined` (line 59). Any client-supplied `facilityId` in the DTO is overwritten by the server context. Furthermore, status modifications across hospitals are blocked with `403 Forbidden: 'You are not authorized to modify users outside your facility'`.

### 16. Is email verification itself audited?
- **PARTIALLY**. Verification success is logged to the NestJS application logger (`this.logger.log(...)`), but no persistent row is written to the `audit_log` database table.

### 17. Is password change audited?
- **NOT APPLICABLE / NOT YET IMPLEMENTED**. Since no password change endpoint exists, no audit event is written.

### 18. Are passwords/tokens excluded from logs and audit metadata?
- **YES**.
  - Plaintext passwords are never stored in MySQL or written to `audit_log.metadata`.
  - Password hashes are stored solely in `user.password_hash` and excluded from API responses.
  - Raw verification tokens are generated in memory; only SHA-256 digests are stored in `user.email_verification_token_hash`.
  - `AuditLogService` calls pass only non-sensitive metadata (`role`, `email`, `facilityId`, `previousStatus`, `newStatus`).

---

## 4. Implementation Gaps & Classification

| Identified Gap | Description | Gap Classification | Impact Assessment |
|---|---|---|---|
| **GAP 1: Self-Service Password Change Endpoint** | Missing `PATCH /api/users/me/password` to allow authenticated users to change their temporary password and flip `mustChangePassword` to `false`. | `PRODUCTION ONLY` | Non-blocking for hackathon demo. Required for enterprise production self-service security. |
| **GAP 2: `mustChangePassword` Enforcement Guard** | No server guard or frontend interceptor enforcing password change before normal dashboard interaction. | `PRODUCTION ONLY` | Users can operate with their initial temporary password without disruption. |
| **GAP 3: Self-Service Password Reset (Forgot Password)** | Missing `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` endpoints. | `PRODUCTION ONLY` | Admins can re-provision or update status if needed. |
| **GAP 4: External SMTP / SES Credentials** | `EmailService` logs email cards to console and API preview rather than external mail transfer agent. | `PRODUCTION ONLY` | Console/preview link is optimal for offline hackathons; requires SMTP env vars for cloud production. |
| **GAP 5: `USER_EMAIL_VERIFIED` AuditLog Persistence** | Verification is logged to NestJS logger but does not insert a row in `audit_log` table. | `OPTIONAL FUTURE ENHANCEMENT` | Administrative mutations (`USER_PROVISIONED`, `USER_STATUS_UPDATED`) are already persistently audited. |

---

## 5. Security & Isolation Matrix Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     HOSPITAL_ADMIN SECURITY VERIFICATION                    │
├───────────────────────────────────────┬─────────────────────────────────────┤
│ PERMISSION CHECK                      │ VERIFIED SERVER BEHAVIOR            │
├───────────────────────────────────────┼─────────────────────────────────────┤
│ Provision Hospital Staff (Own Hosp)   │ ✅ 201 Created (Facility Locked)    │
│ Provision Hospital Admin (Own Hosp)   │ ✅ 201 Created (Facility Locked)    │
│ Provision Staff for Another Hospital  │ ❌ 403 / Forced to Own Facility     │
│ Provision Super Admin                 │ ❌ 403 Forbidden                    │
│ Provision Collection Staff            │ ❌ 403 Forbidden                    │
│ Provision Transport Personnel         │ ❌ 403 Forbidden                    │
│ Provision CBWTF Facility Staff        │ ❌ 403 Forbidden                    │
│ Provision Government Authority        │ ❌ 403 Forbidden                    │
│ Deactivate User in Another Hospital   │ ❌ 403 Forbidden                    │
│ Deactivate Super Admin                │ ❌ 403 Forbidden                    │
│ Unverified Login Attempt              │ ❌ 403 Forbidden                    │
│ Deactivated Login Attempt             │ ❌ 403 Forbidden                    │
│ Deactivated Refresh Attempt           │ ❌ 403 Forbidden                    │
│ Replay Consumed Verification Token    │ ❌ 400 Bad Request                  │
└───────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 6. Final Verdict

# READY WITH SPECIFIC GAPS

### Explanation:
1. **Ready for Hackathon & Demo**: The full real-user onboarding chain (`SUPER_ADMIN` provisions `HOSPITAL_ADMIN` $\rightarrow$ unverified gate $\rightarrow$ cryptographic token generation $\rightarrow$ single-use SHA-256 verification $\rightarrow$ verified login $\rightarrow$ hospital isolation $\rightarrow$ `HOSPITAL_STAFF` provisioning $\rightarrow$ negative RBAC prevention) is **100% operational, verified, and passing**.
2. **Specific Gaps for Full Enterprise Production**:
   - `GAP 1` (`PRODUCTION ONLY`): Dedicated `PATCH /api/users/me/password` endpoint.
   - `GAP 2` (`PRODUCTION ONLY`): Server/UI enforcement of `mustChangePassword`.
   - `GAP 3` (`PRODUCTION ONLY`): Public forgot/reset password routes.
   - `GAP 4` (`PRODUCTION ONLY`): Live SMTP email provider credentials.
3. **Zero Code Changes in Phase 30**: Maintained complete read-only integrity with no schema, code, or database modifications.
