# REAL-WORLD USER ONBOARDING, EMAIL VERIFICATION & ROLE PROVISIONING DESIGN

**Document Version:** 1.0  
**Status:** Architectural Design & Provisioning Specification  
**Scope:** BioTrack / VyomCare Biomedical Waste Governance Platform  
**Target System:** Production-Ready & Hackathon Compatible  

---

## 1. Executive Summary

BioTrack (VyomCare) is a statutory biomedical waste tracking and chain-of-custody governance platform built in compliance with India's Central Pollution Control Board (CPCB) Bio-Medical Waste Management Rules, 2016. The platform's integrity relies on strict administrative provisioning, cryptographic non-repudiation, role-based access control (RBAC), and multi-tenant facility isolation.

This design document establishes the authoritative organizational hierarchy, user provisioning lifecycle, email verification mechanism, and administrative governance model for real-world production onboarding while maintaining 100% backward compatibility with demo/hackathon environments.

### Core Principles
1. **Administrative Delegation Hierarchy**: The platform owner (`SUPER_ADMIN`) provisions organizational root accounts (e.g., `HOSPITAL_ADMIN`, `TREATMENT_FACILITY_STAFF`, central logistics, and regulators). Tenant administrators (`HOSPITAL_ADMIN`) provision operational personnel strictly within their assigned facility boundary.
2. **Zero Plaintext Credentials**: Plaintext passwords are never stored, logged, or returned via API. All passwords undergo salted cryptographic hashing (`bcrypt`, 10 rounds).
3. **Cryptographic Email Ownership Verification**: Newly provisioned accounts are created with unverified email state. Single-use high-entropy tokens are hashed with SHA-256 before persistence, ensuring tokens cannot be stolen via database read access.
4. **Authoritative Server-Side Enforcement**: Frontend views guide user experience, but `RolesGuard`, JWT claims, and service-level tenant checks strictly gate all mutations and data access.
5. **Separation of Concerns**: Account creation, email ownership verification, administrative activation/deactivation, and role/facility assignment are distinct, well-defined lifecycle states.

---

## 2. Current Implementation Audit

A comprehensive audit of the active repository confirms that core authentication, provisioning, and isolation mechanisms are already operational:

| Subsystem | File Location | Verified Implementation Details |
|---|---|---|
| **Authentication & Tokens** | `backend/src/modules/auth/auth.service.ts` | Issues 15-minute JWT access tokens (`{ sub, role, facilityId }`) and 7-day rotated refresh tokens. Hashes refresh tokens via SHA-256 (`refreshToken` table). Enforces 15-minute Redis-backed lockout on 5 failed attempts. |
| **Email Verification** | `backend/src/modules/auth/auth.service.ts` | `verifyEmail()` consumes single-use SHA-256 token hashes with 24-hour expiration. Nullifies token upon verification. `resendVerification()` enforces anti-enumeration and 120s Redis rate-limiting. |
| **Email Dispatch Abstraction** | `backend/src/common/email/email.service.ts` | Dynamically extracts request origin / Cloudflare tunnel headers (`extractRequestBaseUrl`). Outputs structured email verification cards to logs/console and API payload. |
| **User Management API** | `backend/src/modules/users/users.service.ts` | Guarded by `RolesGuard` for `SUPER_ADMIN` and `HOSPITAL_ADMIN`. Enforces hospital-only role provisioning and facility locking for `HOSPITAL_ADMIN`. Hashes passwords with `bcrypt`. Generates verification tokens. |
| **Audit Logging** | `backend/src/modules/audit-log/audit-log.service.ts` | Emits immutable `USER_PROVISIONED` and `USER_STATUS_UPDATED` records to the `audit_log` table with actor ID, target entity, timestamp, and metadata. |
| **Frontend Provisioning UI** | `frontend/src/components/admin/CreateUserDialog.tsx` | Dynamic form adjusting role options and facility selection based on actor (`SUPER_ADMIN` vs `HOSPITAL_ADMIN`). Displays verification links for demo operators. |
| **Verification Page** | `frontend/src/app/(auth)/verify-email/page.tsx` | React client handling URL token validation, loading spinners, success transitions, error alerts, and resend workflows. |

---

## 3. Real-World Organizational Model

In a real-world biomedical waste management ecosystem, BioTrack acts as the central technology and regulatory platform provider. Multiple distinct legal entities interact with the platform:

```
                            ┌────────────────────────────────────────┐
                            │             BIOTRACK CORP              │
                            │             (Platform Root)            │
                            └───────────────────┬────────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 │ provisions                   │ provisions                   │ provisions
                 ▼                              ▼                              ▼
    ┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
    │  HEALTHCARE FACILITIES  │    │  CENTRAL LOGISTICS /    │    │  STATE POLLUTION BOARD  │
    │  (Hospitals / Clinics)  │    │  CBWTF DISPOSAL SITES   │    │  (Regulatory Authority) │
    └────────────┬────────────┘    └────────────┬────────────┘    └────────────┬────────────┘
                 │                              │                              │
        ┌────────┴────────┐            ┌────────┴────────┐                     │
        ▼                 ▼            ▼                 ▼                     ▼
 HOSPITAL_ADMIN    HOSPITAL_STAFF  COLLECTION_STAFF  CBWTF_STAFF      GOVERNMENT_AUTHORITY
 (Facility Root)   (Ward Generator)TRANSPORT_DRIVER  (Treatment Plant)(Statewide Oversight)
```

### Entity Responsibilities & Authority
1. **BioTrack Platform Administration (`SUPER_ADMIN`)**:
   - Onboards and approves Healthcare Facilities (`HOSPITAL`) and Common Biomedical Waste Treatment Facilities (`TREATMENT_FACILITY`).
   - Provisions primary Hospital Administrators (`HOSPITAL_ADMIN`) for verified healthcare organizations.
   - Provisions Common Bio-Medical Waste Treatment Facility personnel (`TREATMENT_FACILITY_STAFF`).
   - Provisions logistics personnel (`COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`).
   - Provisions accredited State Pollution Control Board auditors (`GOVERNMENT_AUTHORITY`).
2. **Healthcare Facility Administration (`HOSPITAL_ADMIN`)**:
   - Represents the hospital's bio-safety and administrative leadership.
   - Provisions and manages operational ward and biomedical waste generator staff (`HOSPITAL_STAFF`) within their own hospital.
   - May provision secondary `HOSPITAL_ADMIN` accounts for their own hospital.
   - Cannot create, view, or modify users belonging to other hospitals, CBWTFs, logistics fleets, or regulatory bodies.
3. **Common Treatment Facility (`TREATMENT_FACILITY_STAFF`)**:
   - Operates autoclaves, incinerators, shredders, and effluent treatment plants at licensed CBWTF sites.
   - Accepts inbound waste transfers within verified GPS geofences and confirms treatment.
4. **Logistics & Fleet (`COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`)**:
   - Independent operational roles operating between multiple generator hospitals and treatment centers.
5. **Government Authority (`GOVERNMENT_AUTHORITY`)**:
   - Read-only real-time radar and oversight over state-wide compliance, SLA violations, and custody chains.

---

## 4. Role Provisioning Matrix

| Role | Permitted Creators | Required Facility Type | Geographic / Tenant Scope | Can Create Other Users? | Can Deactivate Users? |
|---|---|---|---|---|---|
| **`SUPER_ADMIN`** | `SUPER_ADMIN` | None (Platform) | Global (All facilities, all data) | Yes (All 7 roles) | Yes (All users) |
| **`HOSPITAL_ADMIN`** | `SUPER_ADMIN`, `HOSPITAL_ADMIN` (Same facility) | `HOSPITAL` | Tenant Hospital (`facilityId`) | Yes (`HOSPITAL_STAFF`, `HOSPITAL_ADMIN` for own hospital) | Yes (Own hospital users only) |
| **`HOSPITAL_STAFF`** | `SUPER_ADMIN`, `HOSPITAL_ADMIN` (Same facility) | `HOSPITAL` | Tenant Hospital (`facilityId`) | No | No |
| **`COLLECTION_STAFF`** | `SUPER_ADMIN` | None (Central Fleet) | Multi-Facility Logistics | No | No |
| **`TRANSPORT_PERSONNEL`** | `SUPER_ADMIN` | None (Central Fleet) | Multi-Facility Fleet Routes | No | No |
| **`TREATMENT_FACILITY_STAFF`** | `SUPER_ADMIN` | `TREATMENT_FACILITY` | Tenant CBWTF (`facilityId`) | No | No |
| **`GOVERNMENT_AUTHORITY`** | `SUPER_ADMIN` | None (State Agency) | Statewide / Jurisdictional | No | No |

---

## 5. Facility Scope Matrix

```
┌───────────────────────────┬─────────────────────────┬───────────────────────────────────────────┐
│ ROLE                      │ FACILITY REQUIREMENT    │ PERMITTED DATA ACCESS & ACTION SCOPE      │
├───────────────────────────┼─────────────────────────┼───────────────────────────────────────────┤
│ SUPER_ADMIN               │ None (null)             │ System-wide (All hospitals, CBWTFs, logs) │
│ HOSPITAL_ADMIN            │ Mandatory (HOSPITAL)    │ Scoped exclusively to assigned Hospital   │
│ HOSPITAL_STAFF            │ Mandatory (HOSPITAL)    │ Scoped exclusively to assigned Hospital   │
│ COLLECTION_STAFF          │ None (null)             │ Waste pickup scanning across all hospitals│
│ TRANSPORT_PERSONNEL       │ None (null)             │ Active manifest routes & GPS telematics   │
│ TREATMENT_FACILITY_STAFF  │ Mandatory (TREATMENT)   │ Scoped exclusively to assigned CBWTF      │
│ GOVERNMENT_AUTHORITY      │ None (null)             │ State-wide read-only compliance radar     │
└───────────────────────────┴─────────────────────────┴───────────────────────────────────────────┘
```

---

## 6. User Onboarding Lifecycle

A real user progresses through an orderly, secure administrative provisioning flow:

```
[ Step 1: Request & Verification ]
  Hospital/Entity submits certified credentials & authorization letter to BioTrack.

[ Step 2: Administrative Provisioning ]
  SUPER_ADMIN (or HOSPITAL_ADMIN) calls POST /api/users.
  - Generates record with emailVerified = false, status = ACTIVE, mustChangePassword = true.
  - Generates secure random token; stores SHA-256 hash in DB with 24h expiration.
  - Emits USER_PROVISIONED AuditLog entry.

[ Step 3: Verification Link Dispatch ]
  EmailService transmits verification link: https://<domain>/verify-email?token=<rawToken>

[ Step 4: Email Certification ]
  User clicks link -> POST /api/auth/verify-email validates hash and single-use status.
  - Marks emailVerified = true, emailVerifiedAt = now(), tokenHash = null.

[ Step 5: First Authentication & Password Setting ]
  User authenticates -> Prompted to set permanent private password (mustChangePassword = false).

[ Step 6: Full Operational Access ]
  JWT access token issued -> Role-specific dashboard rendered.
```

---

## 7. Email Verification Lifecycle

### Cryptographic Invariants
1. **Raw Token Entropy**: 32-byte high-entropy string (`uuidv4() + crypto.randomBytes(24).toString('hex')`).
2. **Storage Invariant**: MySQL never receives the plaintext token. The database stores:
   $$\text{TokenHash} = \text{SHA-256}(\text{RawToken})$$
3. **Expiration**: 24 hours from timestamp of creation.
4. **Single-Use Consumption**: Upon successful execution of `POST /api/auth/verify-email`, `emailVerificationTokenHash` and `emailVerificationExpiresAt` are immediately set to `NULL`.
5. **Anti-Enumeration Rate-Limiting**: `POST /api/auth/resend-verification` enforces a 120-second Redis cooldown per email address and returns an identical message whether or not the email exists in the database.

---

## 8. Password Setup Lifecycle

### Option Analysis

* **Option A: Administrator Sets Temporary Password (Current Hackathon Implementation)**
  - *Mechanism*: Admin types a temporary password upon creation; user logs in and is flagged with `mustChangePassword = true`.
  - *Pros*: Simple, immediate, works in offline/demo scenarios.
  - *Cons*: Administrator briefly knows the initial temporary password.
* **Option B: Cryptographic Invitation & User Self-Setup (Recommended Production Target)**
  - *Mechanism*: Admin provisions user without specifying any password. Server generates an `InvitationToken`. User clicks the invitation email, verifies ownership, and sets their password directly.
  - *Pros*: Zero password exposure to any third party or administrator.
  - *Cons*: Requires active transactional email deliverability.

### Production Recommendation
Maintain Option A for backward-compatible development/demo modes while introducing Option B for enterprise production onboarding via an optional `invitationMode: true` parameter in `CreateUserDto`. In both modes, plaintext passwords are never stored in MySQL.

---

## 9. SUPER_ADMIN Workflow

1. **Facility Creation**: Navigates to `/admin/facilities`, creates a new `HOSPITAL` or `TREATMENT_FACILITY`, and approves its status.
2. **Hospital Administrator Provisioning**:
   - Opens `/admin/users` → clicks **"Provision New User"**.
   - Selects Role: `HOSPITAL_ADMIN`.
   - Selects Affiliated Hospital from the dropdown.
   - Enters Admin Full Name and official email (e.g., `admin@citygeneral.example`).
   - Submits form → System provisions account and dispatches email verification token.
3. **Logistics & CBWTF Provisioning**:
   - Provisions `COLLECTION_STAFF` and `TRANSPORT_PERSONNEL` (no facility required).
   - Provisions `TREATMENT_FACILITY_STAFF` (bound to CBWTF facility).
4. **Governance Oversight**:
   - Monitors `/admin/audit-log` for all administrative mutations.
   - May deactivate or reactivate any user account.

---

## 10. HOSPITAL_ADMIN Workflow

1. **Hospital Personnel Directory**: Navigates to `/admin/users` (dynamically presented as *"Hospital Personnel Management"*).
2. **Hospital Staff Provisioning**:
   - Clicks **"Provision New User"**.
   - Form is automatically locked to the Administrator's assigned hospital (`actor.facilityId`).
   - Role dropdown offers only `HOSPITAL_STAFF` or `HOSPITAL_ADMIN`.
   - Enters Staff Name, Email, and Phone.
   - Submits form → Account created, verification dispatched.
3. **Staff Lifecycle Management**:
   - Toggles status between `ACTIVE` and `DEACTIVATED` for departing or reassigned hospital employees.
   - Cannot modify or view users outside their hospital.

---

## 11. Other Role Provisioning Workflows

* **COLLECTION_STAFF**: Created solely by `SUPER_ADMIN`. Assigned to central logistics fleet. Operates barcode/QR scanning at hospital waste pickup points.
* **TRANSPORT_PERSONNEL**: Created solely by `SUPER_ADMIN`. Assigned vehicle manifests and submits real-time GPS telemetry during transit.
* **TREATMENT_FACILITY_STAFF**: Created solely by `SUPER_ADMIN`. Locked to a specific CBWTF. Confirms inbound waste arrival and closes custody records upon treatment.
* **GOVERNMENT_AUTHORITY**: Created solely by `SUPER_ADMIN`. Read-only access to state compliance radar, SLA violations, and audit history.

---

## 12. User Status State Machine

```
                   ┌──────────────────────────────────────┐
                   │               INVITED                │
                   │ (emailVerified: false, ACTIVE)       │
                   └──────────────────┬───────────────────┘
                                      │
                         Email Verified (Token Consumed)
                                      ▼
                   ┌──────────────────────────────────────┐
                   │               VERIFIED               │
                   │ (emailVerified: true, ACTIVE)        │
                   └──────────┬───────────────────────────┘
                              │                           ▲
                  Deactivated │                           │ Reactivated
                  by Admin    ▼                           │ by Admin
                   ┌──────────────────────────────────────┐
                   │             DEACTIVATED              │
                   │ (status: DEACTIVATED)                │
                   └──────────────────────────────────────┘
```

### State Matrix Rules
- `emailVerified = false` + `status = ACTIVE`: User **cannot** log in. Error: `403 Forbidden: Email address not verified`.
- `emailVerified = true` + `status = ACTIVE`: User **can** log in and refresh tokens.
- `status = DEACTIVATED` (regardless of `emailVerified`): User **cannot** log in, refresh tokens, or query endpoints. Error: `403 Forbidden: Account deactivated`.

---

## 13. Frontend User Management Design

### Super Admin View (`/admin/users`)
- **Page Title**: *"User Account Directory"*
- **Controls**:
  - Search bar (by name, email, phone).
  - Role filter dropdown (All 7 roles).
  - Status filter (All, Active, Deactivated).
  - Primary button: `+ Provision New User`.
- **Table Columns**: User Name & Email, Assigned Role (Badge), Affiliated Facility Name, Status Toggle (`ACTIVE`/`DEACTIVATED`), Verification State Badge (`VERIFIED`/`UNVERIFIED`), Last Login Timestamp, Created Date.

### Hospital Admin View (`/admin/users`)
- **Page Title**: *"Hospital Personnel Management"*
- **Subtitle**: *"Manage ward generator staff and authorized administrators for [Hospital Name]"*
- **Role Selector**: Restricted strictly to `HOSPITAL_STAFF` and `HOSPITAL_ADMIN`.
- **Facility Selector**: Hidden / Automatically preset to current hospital.

---

## 14. Backend API Requirements

```http
### 1. Provision User (Super Admin / Hospital Admin)
POST /api/users
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "Dr. Ananya Sen",
  "email": "ananya.sen@hospital.example",
  "role": "HOSPITAL_STAFF",
  "facilityId": "a13ef6cd-ed6c-4f95-8c49-3c5e781e9e74",
  "password": "InitialTempPassword#2026"
}

### 2. Verify Email Token (Public)
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "3cfe53fe-8404-4187-b65f-8f7ed04293ea1a8cf25eef40..."
}

### 3. Resend Verification Token (Public / Rate Limited)
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "ananya.sen@hospital.example"
}

### 4. Update User Status (Super Admin / Hospital Admin)
PATCH /api/users/:id/status
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "status": "DEACTIVATED"
}

### 5. Get Own Profile
GET /api/users/me
Authorization: Bearer <JWT>
```

---

## 15. Audit Logging Requirements

All user provisioning and administrative mutations must write immutable records to the `audit_log` table:

| Action Identifier | Trigger Condition | Required Metadata Payload |
|---|---|---|
| `USER_PROVISIONED` | Successful `POST /api/users` | `{ role, email, facilityId }` |
| `USER_STATUS_UPDATED` | Successful `PATCH /api/users/:id/status` | `{ previousStatus, newStatus, targetRole }` |
| `USER_EMAIL_VERIFIED` | Successful `POST /api/auth/verify-email` | `{ email, verifiedAt }` |
| `USER_PASSWORD_CHANGED`| User updates own password | `{ userId, changedAt }` |

---

## 16. Security Requirements

1. **Authoritative Server Guards**: All endpoints must pass through `AuthGuard('jwt')` and `RolesGuard`.
2. **Tenant Boundary Guarantee**: `HOSPITAL_ADMIN` queries and mutations are hard-filtered in Prisma where clauses by `actor.facilityId`.
3. **Secret Protection**: API responses must strip `passwordHash`, `emailVerificationTokenHash`, and `passwordResetTokenHash`.
4. **Brute Force Defense**: Redis-backed exponential lockout on authentication attempts.
5. **Token Tampering Prevention**: JWT access tokens are signed with high-entropy server secrets; client-supplied role parameters are ignored in favor of `req.user`.

---

## 17. Edge Cases & Resilience

| Scenario | System Response & Resolution |
|---|---|
| **Duplicate Email Submission** | Backend returns `409 Conflict: 'A user with this email address already exists'`. No records overwritten. |
| **Expired Verification Link (>24h)** | `verifyEmail()` returns `400 Bad Request: 'Verification link has expired. Please request a new verification email.'` |
| **Replayed / Re-used Token** | Token hash is nullified upon first use; subsequent submission returns `400 Bad Request`. |
| **Hospital Admin Provisions for Another Hospital** | Backend enforces `facilityId = actor.facilityId` or throws `403 Forbidden`. |
| **Hospital Admin Attempts Creating Super Admin** | Throws `403 Forbidden: 'You can only create hospital roles'`. |
| **Hospital Facility Suspended** | If facility status is `SUSPENDED`, user creation is rejected with `400 Bad Request`. |
| **Deactivated User with Active JWT** | Profile endpoint (`GET /api/users/me`) and refresh token endpoints reject with `403 Forbidden`; frontend clears session immediately. |

---

## 18. Hackathon / Demo Workflow

* **Seeded Accounts**: Pre-verified demo accounts (`admin@citygeneral.in`, `staff@citygeneral.in`, etc.) remain in place with pre-hashed credentials for instant demo access.
* **Email Dispatch**: Verification links are written to the server console and surfaced in the admin creation dialog modal for rapid testing without third-party email dependencies.
* **Cloudflare HTTPS Quick Tunnel**: Dynamic origin detection ensures verification links and API callbacks route correctly over live mobile/desktop tunnel domains.

---

## 19. Production Workflow

* **Transactional SMTP/SES Provider**: `EmailService` connects to AWS SES, Resend, or SendGrid via environment variables (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`).
* **Strict Email Verification**: Verification links delivered exclusively into recipient email inboxes; no links surfaced in API payloads or admin UI.
* **Mandatory First-Login Password Change**: `mustChangePassword` forces users to establish private credentials immediately upon first verified login.
* **Domain Whitelisting**: Automated checks against official hospital institutional domains.

---

## 20. Recommended Final Architecture

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                      SUPER_ADMIN                         │
                    │               (BioTrack Platform Owner)                  │
                    └─────────────┬──────────────────────────────┬─────────────┘
                                  │                              │
                    creates &     │                              │ creates &
                    provisions    │                              │ provisions
                                  ▼                              ▼
                 ┌────────────────────────────────┐    ┌────────────────────────────────┐
                 │        HOSPITAL_ADMIN          │    │    CENTRAL / CBWTF / STATE     │
                 │   (City General Hospital)      │    │  (Transport, CBWTF, Regulator) │
                 └───────────────┬────────────────┘    └────────────────────────────────┘
                                 │
                   creates &     │
                   provisions    │
                                 ▼
                 ┌────────────────────────────────┐
                 │        HOSPITAL_STAFF          │
                 │    (Ward Waste Generator)      │
                 └────────────────────────────────┘
```

---

## 21. Existing Implementation Gaps

1. **Transactional Email Provider Integration**: Currently uses logging driver; needs SMTP/SES credentials for live production inboxes.
2. **Self-Service Password Reset UI**: `passwordResetTokenHash` schema exists in Prisma but lacks frontend `/forgot-password` and `/reset-password` views.
3. **Batch Personnel CSV Import**: Optional future feature to allow Hospital Admins to upload a staff roster spreadsheet.

---

## 22. Required Future Changes (Post-Hackathon Roadmap)

1. Configure production SMTP environment variables in `EmailService`.
2. Build frontend pages for `/forgot-password` and `/reset-password`.
3. Add multi-factor authentication (MFA / TOTP) for `SUPER_ADMIN` and `GOVERNMENT_AUTHORITY` accounts.

---

## 23. What MUST NOT Be Changed

1. **Do NOT modify role names**: The 7 enum roles (`SUPER_ADMIN`, `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`, `TREATMENT_FACILITY_STAFF`, `GOVERNMENT_AUTHORITY`) are verified across all backend services.
2. **Do NOT alter password storage**: Must remain bcrypt hashes with salt rounds $\ge 10$.
3. **Do NOT remove token hashing**: Verification tokens must always be stored as SHA-256 digests.
4. **Do NOT remove seeded demo accounts**: Preserved for demonstration stability.
5. **Do NOT bypass `RolesGuard` or tenant filters**: Facility-level isolation must remain authoritative on the server.

---

## 24. Final Recommendation

The BioTrack account lifecycle architecture is **fully sound, secure, and ready for production operationalization**. The existing codebase already implements the complete 7-role RBAC matrix, tenant facility isolation, cryptographic email verification hashing, Redis-backed lockout, and audit logging.

---

## Final Decision Table

| Role | Created By | Facility Required? | Permitted Facility Type | Data Scope | Can Create Users? | Can Deactivate Users? |
|---|---|---|---|---|---|---|
| **`SUPER_ADMIN`** | `SUPER_ADMIN` | No | None | Platform-Wide | Yes (All 7 Roles) | Yes (All Users) |
| **`HOSPITAL_ADMIN`** | `SUPER_ADMIN`, `HOSPITAL_ADMIN` (Same facility) | Yes | `HOSPITAL` | Single Hospital | Yes (`HOSPITAL_STAFF`, `HOSPITAL_ADMIN`) | Yes (Own Hospital Only) |
| **`HOSPITAL_STAFF`** | `SUPER_ADMIN`, `HOSPITAL_ADMIN` (Same facility) | Yes | `HOSPITAL` | Single Hospital | No | No |
| **`COLLECTION_STAFF`** | `SUPER_ADMIN` | No | None | Central Logistics | No | No |
| **`TRANSPORT_PERSONNEL`** | `SUPER_ADMIN` | No | None | Central Fleet | No | No |
| **`TREATMENT_FACILITY_STAFF`** | `SUPER_ADMIN` | Yes | `TREATMENT_FACILITY` | Single CBWTF | No | No |
| **`GOVERNMENT_AUTHORITY`** | `SUPER_ADMIN` | No | None | State-Wide | No | No |

---

## Recommended User Onboarding Flow

1. **Facility Onboarding**: BioTrack Super Admin registers and approves the healthcare facility in the platform registry (`POST /api/facilities`).
2. **Hospital Admin Provisioning**: Super Admin creates the primary `HOSPITAL_ADMIN` account assigned to the hospital (`POST /api/users`).
3. **Email Verification Dispatch**: Backend generates a SHA-256 token digest and dispatches the verification link.
4. **Email Ownership Verification**: The Hospital Admin clicks the link (`POST /api/auth/verify-email`), certifying ownership and activating the account.
5. **Initial Password Setup / First Login**: Hospital Admin authenticates and establishes a permanent private password.
6. **Hospital Staff Provisioning**: Hospital Admin logs into `/admin/users` and provisions `HOSPITAL_STAFF` ward personnel for their hospital.
7. **Staff Verification & Onboarding**: Hospital Staff verify their emails and log in on ward workstations/mobile devices.
8. **Logistics & Fleet Provisioning**: Super Admin provisions `COLLECTION_STAFF` and `TRANSPORT_PERSONNEL` for central waste pickup.
9. **Treatment Facility Provisioning**: Super Admin registers the CBWTF facility and provisions `TREATMENT_FACILITY_STAFF`.
10. **Government Authority Provisioning**: Super Admin provisions State Pollution Control Board auditors (`GOVERNMENT_AUTHORITY`).
11. **Continuous Audit Logging**: All user lifecycle mutations automatically record in the tamper-evident `audit_log` table.
12. **Administrative Deactivation/Reactivation**: Hospital Admins and Super Admins manage staff status with instant revocation of access upon deactivation.

---

## Implementation Safety Breakdown

* **Already Implemented Correctly**: 7-Role RBAC, `RolesGuard`, tenant facility isolation, bcrypt password hashing, cryptographic token SHA-256 hashing, single-use token consumption, Redis lockout, and dedicated `audit_log` persistence.
* **Requires No Code Changes**: Core authentication API, user controllers, user services, and database schema.
* **Requires Backend Configuration Only**: Setting production SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) when migrating from development/hackathon to full cloud production.
* **Requires Frontend Additions (Future)**: Self-service `/forgot-password` and `/reset-password` pages.
* **Requires Database/Schema Changes**: None. Current schema cleanly supports the entire state machine.
* **Can Wait Until Post-Hackathon**: Real SMTP provider binding, self-service password reset UI, and multi-factor authentication (MFA).
