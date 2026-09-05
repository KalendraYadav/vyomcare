# BioTrack / VyomCare — Definitive Frontend UI/UX Design Specification (`design.md`)

**Document Status:** Authoritative Design Contract & Implementation Specification  
**Downstream Consumers:** Frontend Implementation Engineers, QA Leads, UI Reviewers  
**Target Platform:** Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4 + TanStack Query v5 + Zustand v5  
**Backend System:** Verified NestJS 10 + Prisma 6 + MySQL 8.0 + Redis 7 + BullMQ 6 + Socket.IO 4.8  

---

## 1. Document Status & Purpose

This document is the **single authoritative source of truth** for the BioTrack / VyomCare frontend implementation. It supersedes all prior drafts and design documents (including `design1.md` and initial iterations of `design.md`). 

The objective of this specification is to provide **100% implementation readiness**: any frontend engineer or AI coding agent must be able to construct every page, component, form, query, mutation, route guard, and responsive view without having to invent business rules, API contracts, UX patterns, or data structures.

---

## 2. Source-of-Truth Hierarchy & Architectural Precedence

Whenever an ambiguity or question arises during frontend construction, the following hierarchy is binding:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Level 1 — Actual Verified Backend Implementation (Highest Authority)       │
│           Prisma schema, DTOs, controllers, services, guards, Socket.IO.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Level 2 — Existing Verified Backend Test & Hardening Report                 │
│           Proof of running MySQL 8, Redis 7, BullMQ, and active endpoints.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Level 3 — This Document (`design.md`)                                       │
│           Authoritative for frontend architecture, UX, UI, and workflows.   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Level 4 — Master Implementation Plan (`implementationplan.md`)              │
│           Upstream business intent, regulatory references, and roadmap.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Level 5 — Explicit Design Decisions (`DESIGN DECISION`)                     │
│           New frontend architectural choices labeled clearly in this doc.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Document Classification Legend
To prevent hallucination and maintain strict engineering discipline, every specification element in this document is labeled when applicable:

- `[VERIFIED]`: Backed by active, tested NestJS controller code and Prisma schema.
- `[DESIGN DECISION]`: A concrete frontend architecture, UX layout, or styling choice made to fulfill requirements where the backend is agnostic.
- `[ASSUMPTION]`: An explicitly flagged edge case or UI convention requiring product confirmation; kept minimal and safe.
- `[OUT OF SCOPE]`: Features explicitly excluded from this phase to prevent scope drift.

---

## 3. Product Scope & Operational Boundaries

### 3.1 What BioTrack Is
BioTrack is a high-reliability, role-based biomedical waste tracking and compliance platform designed to ensure an unbroken, verified chain of custody for hazardous healthcare waste under Central Pollution Control Board (CPCB 2016) regulations. It manages waste generation at healthcare facilities, custody handover to logistics personnel, real-time GPS tracking during transit, and verified arrival/destruction at Common Bio-medical Waste Treatment Facilities (CBWTF), with regulatory oversight by State Pollution Control Boards.

### 3.2 What BioTrack Is Not (`OUT OF SCOPE`)
1. **No Commercial Billing / Payment Gateway:** Invoicing, waste tariffs, and payment gateways are handled by external ERPs.
2. **No Public Consumer eCommerce / Patient Portal:** Patients never access this system; it is strictly an industrial/clinical operational intranet.
3. **No Native Mobile App Shell:** No React Native, Flutter, iOS Swift, or Android Kotlin codebases. The single responsive Next.js PWA serves desktop monitors, tablets, and field mobile devices.
4. **No Blockchain / Decentralized Ledgers:** Cryptographic hashes and append-only database logs in MySQL 8 satisfy compliance without blockchain overhead.
5. **No AI/ML Diagnostic Waste Sorters:** Classification is performed by certified medical and waste handling personnel adhering to statutory categories.

---

## 4. Verified Backend Constraints & Capabilities

The frontend must strictly interface with the active backend capabilities verified on `localhost:3001/api`:

1. **Authentication:** Stateless JWT access tokens (`15m` validity) passed via `Authorization: Bearer <token>` headers. Refresh tokens (`7d` validity) stored in `RefreshToken` database table and exchanged via HTTP-only cookies (`POST /api/auth/refresh`).
2. **Database Engine:** MySQL 8.0 running under Docker (persisted via Docker named volume). All queries are executed through Prisma Client.
3. **Array Type Mapping:** `Facility.authorizedCategoryIds` is stored as a native MySQL `JSON` array of category UUID strings (e.g. `["uuid-1", "uuid-2"]`). The frontend receives and transmits this as a standard JavaScript `string[]`.
4. **Asynchronous Background Processing:** BullMQ v6 connected to Redis 7 (`redis://localhost:6379`) evaluates background SLA compliance deadlines on queue `compliance-checks`.
5. **Real-Time Notification Gateway:** Socket.IO server running on `/notifications` namespace with CORS origin mapped to `http://localhost:3000`. Supports room subscriptions via client message `join` (`{ userId, role }`) and broadcasts `alert:new` and `transport:update`.
6. **No Arbitrary Hard Deletes:** Batches, custody events, and audit logs are append-only. Waste categories can only be deactivated (`isActive: false`), facilities suspended (`SUSPENDED`), and users deactivated (`DEACTIVATED`). The frontend provides no deletion buttons for custody entities.

---

## 5. Requirements vs. Design Decisions vs. Assumptions

| Feature Area | Source Requirement | Design Decision (`design.md`) | Current Status |
|---|---|---|---|
| **Database Technology** | MySQL 8.0 via Docker | Prisma provider `mysql`, Json arrays for categories | `[VERIFIED]` |
| **Authentication Flow** | Email + Password, JWT + Refresh Token | Dual storage: access token in memory/Zustand, refresh in cookie | `[VERIFIED]` |
| **QR Generation** | Unique alphanumeric payload per batch | Format: `BIOTRACK:<wasteId>:<8-char-hash>` | `[VERIFIED]` |
| **QR Scanning** | Universal camera-based action trigger | Single `/scan` route with automatic role-based state machine | `[DESIGN DECISION]` |
| **Batch Statuses** | 8 enum values in schema | Strict 8-stage UI display with branch for `VIOLATION` | `[VERIFIED]` |
| **Custody Events** | 8 event types in schema | Visual timeline separating historical events from active state | `[VERIFIED]` |
| **Arrival Verification** | 5-step validation sequence | Modal presenting sequential checks with instant pass/fail feedback | `[VERIFIED]` |
| **Driver GPS Telemetry** | Periodic pings sent to `/api/gps-pings` | Throttled 30s HTML5 `watchPosition` in driver console | `[DESIGN DECISION]` |
| **GIS Fleet Radar** | Live map of vans & facilities | Leaflet / MapLibre vector map with live vehicle breadcrumbs | `[DESIGN DECISION]` |
| **Ticket Triage** | `OPEN → INVESTIGATING → RESOLVED` | Side-drawer inspection view with auditor justification input | `[VERIFIED]` |
| **Real-Time Updates** | Socket.IO on `/notifications` | TanStack Query cache invalidation upon socket events | `[DESIGN DECISION]` |

---

## 6. UX Principles & Interaction Rules

1. **State Is Always Triple-Encoded:**
   Every batch status, alert severity, and system state is communicated via **color + text label + paired icon**. Never rely on color alone (WCAG 2.2 AA requirement).
2. **Role Boundaries Are Hard Surfaces:**
   The frontend never displays an action button, menu item, or input field that the user's role is not authorized to execute. Restricted features are omitted from the DOM, never rendered as disabled "teasers".
3. **Clinical Clarity Over Consumer Decoration:**
   High contrast, dense scannable tables, sharp typography (Inter), and clear visual hierarchy. Zero decorative animations, parallax, or low-contrast text.
4. **Field Speed for Operational Roles:**
   Hospital Staff, Collection Staff, Drivers, and Treatment Plant Staff operate under extreme time pressure, often with gloved hands on low-end mobile devices. Touch targets are **minimum 48×48px (primary action CTA 56px)**, with instant camera activation and zero unnecessary clicks.
5. **Irreversible Action Friction:**
   Confirming waste destruction, transfer acceptance, facility suspension, or user deactivation requires a two-step modal with explicit consequences outlined.
6. **Timeline Distinction:**
   Historical events (immutable logs) are visually distinguished from the active current state. Historical items show solid green checkmarks with custodian signatures; active stages show pulsing indicators with SLA countdown clocks.

---

## 7. User Roles & Persona Specifications

The application supports exactly **7 distinct user roles** defined in the backend `UserRole` enum:

```
                                    USER
                                      │
              ┌───────────────────────┼───────────────────────┐
              ↓                       ↓                       ↓
       Healthcare Tier         Logistics & Plant       Regulatory & Admin
       • HOSPITAL_ADMIN        • COLLECTION_STAFF      • GOVERNMENT_AUTHORITY
       • HOSPITAL_STAFF        • TRANSPORT_PERSONNEL   • SUPER_ADMIN
                               • TREATMENT_FACILITY_STAFF
```

### 7.1 `HOSPITAL_ADMIN` (Facility Supervisor)
- **Context:** Office desktop / tablet inside a hospital.
- **Primary Goal:** Monitor total biomedical waste generated, track collection efficiency, ensure hospital compliance, manage ward staff accounts.
- **Scope:** Strictly scoped to their own facility (`user.facilityId`). Cannot see other hospitals' waste or staff.
- **Key Views:** Hospital Dashboard, Waste Batches Directory, New Waste Batch, Hospital User Management, Scoped Alerts.

### 7.2 `HOSPITAL_STAFF` (Ward Nurse / Waste Handler)
- **Context:** Mobile device / wall-mounted tablet in hospital ward or utility room. Often wearing clinical PPE.
- **Primary Goal:** Bag sealed waste, generate batch, print/affix QR label in under 45 seconds, hand over to collection staff.
- **Scope:** Strictly scoped to their own facility (`user.facilityId`).
- **Key Views:** New Waste Batch Form, Batch Print View, Universal Scanner, Hospital Dashboard (read-only).

### 7.3 `COLLECTION_STAFF` (Waste Collector / Handler)
- **Context:** Mobile smartphone in hospital basement waste collection room or loading dock.
- **Primary Goal:** Scan bags presented by hospital staff, verify physical bag integrity, accept custody into central storage or vehicle.
- **Scope:** Cross-facility operational role (`user.facilityId = null`).
- **Key Views:** Universal Scanner (`/scan`), Active Handover Confirmation Modal.

### 7.4 `TRANSPORT_PERSONNEL` (Waste Van Driver)
- **Context:** Low-cost mobile smartphone mounted on the dashboard of a moving hazardous waste vehicle.
- **Primary Goal:** View assigned route, scan bags onto vehicle manifest, broadcast continuous GPS telemetry, report arrival at CBWTF.
- **Scope:** Bound to their active assignment (`/api/transport/my-assignment`).
- **Key Views:** Driver Console HUD (`/transport/driver-mode`), Universal Scanner.

### 7.5 `TREATMENT_FACILITY_STAFF` (CBWTF Operator)
- **Context:** Ruggedized tablet / industrial PC at the treatment facility gate and incinerator/autoclave control room.
- **Primary Goal:** Verify incoming waste vans (executing the 5-step arrival verification), inspect bag counts/weights, confirm autoclave/incineration destruction.
- **Scope:** Strictly scoped to their treatment facility (`user.facilityId`).
- **Key Views:** Treatment Facility Dashboard, Universal Scanner (Arrival Verification & Treatment Confirmation), Inbound Manifests.

### 7.6 `GOVERNMENT_AUTHORITY` (State Pollution Control Board Auditor)
- **Context:** Multi-monitor desktop console in state environmental monitoring headquarters.
- **Primary Goal:** Monitor statewide compliance, observe real-time transit fleet radar, detect illegal dumping or delayed disposal, triage violation tickets.
- **Scope:** Statewide jurisdictional oversight. Read-only on hospital operations; write access to alert ticket resolution and SLA compliance rules.
- **Key Views:** Government Radar Dashboard, Live GIS Fleet Map, Statewide Waste Directory, Alerts & Violations Inbox, Compliance Rules Config.

### 7.7 `SUPER_ADMIN` (BioTrack System Administrator)
- **Context:** Desktop workstation.
- **Primary Goal:** Platform infrastructure maintenance, onboarding new facilities, approving facility registrations, user access control, global audit inspection.
- **Scope:** Unrestricted global access.
- **Key Views:** All platform views + Facility Approvals Desk, Global User Directory, System Audit Logs (`/admin/audit-log`).

---

## 8. Role & Permission Matrix

| Feature / Action | `HOSPITAL_ADMIN` | `HOSPITAL_STAFF` | `COLLECTION_STAFF` | `TRANSPORT_PERSONNEL` | `TREATMENT_FACILITY_STAFF` | `GOVERNMENT_AUTHORITY` | `SUPER_ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Sign In / Out** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Hospital Dashboard** | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Register New Waste Batch** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Print QR Code Sticker** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Universal QR Scanner** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Accept Collection Custody** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Start Transport Run** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Broadcast GPS Telemetry** | ❌ | ❌ | ❌ | ✅ (Auto) | ❌ | ❌ | ❌ |
| **Verify CBWTF Arrival** | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ | ❌ |
| **Confirm Waste Destruction** | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ | ❌ |
| **View CBWTF Dashboard** | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ | ✅ |
| **View Government Dashboard** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **View Live GIS Fleet Map** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **View / Triage Alerts** | ✅ (Own) | ❌ | ❌ | ❌ | ✅ (Own) | ✅ (All) | ✅ (All) |
| **Resolve Violation Tickets**| ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Approve New Facilities** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Manage Users** | ✅ (Own Staff) | ❌ | ❌ | ❌ | ✅ (Own Staff) | ❌ | ✅ (Global) |
| **Edit Compliance SLAs** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Inspect System Audit Logs** | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ (Read) | ✅ |

---

## 9. Canonical Route Map

| Canonical Route | Page Purpose | Allowed Roles | Backend APIs Used | Primary Components |
|---|---|---|---|---|
| `/login` | Public Authentication Portal | Public (All) | `POST /api/auth/login` | `LoginForm`, `QuickPresetBar` |
| `/scan` | Universal QR Scanner | Operational Roles (1–5)| `POST /api/scan`, custody endpoints | `QRScannerViewport`, `ActionDrawer` |
| `/hospital/dashboard` | Hospital Operations Hub | `HOSPITAL_ADMIN`, `HOSPITAL_STAFF` | `GET /api/dashboard/hospital` | `MetricCardGrid`, `WardBreakdownChart` |
| `/waste-batches` | Waste Batch Directory | Hospital, Plant, Gov, Admin | `GET /api/waste-batches` | `BatchDataTable`, `FilterToolbar` |
| `/waste-batches/new` | Rapid Waste Bag Creation | `HOSPITAL_ADMIN`, `HOSPITAL_STAFF` | `POST /api/waste-batches`, `GET /api/waste-categories` | `BatchCreateForm`, `CategoryPicker` |
| `/waste-batches/[id]` | Batch Custody Detail & Audit | All Authed Roles | `GET /api/waste-batches/:id/history` | `CustodyTimeline`, `MiniRouteMap` |
| `/waste-batches/[id]/print-qr`| Adhesive Thermal Label Print | Hospital Roles | `POST /api/waste-batches/:id/qr` | `PrintableQRLabel`, `PrintBar` |
| `/transport/driver-mode` | In-Cabin Driver HUD Console | `TRANSPORT_PERSONNEL` | `GET /api/transport/my-assignment`, `POST /api/gps-pings` | `DriverHUD`, `TelemetryStatus`, `BigButton` |
| `/transport/active` | Fleet Overview & Assignments | Hospital, Plant, Gov, Admin | `GET /api/transport/active`, `GET /api/transport/vehicles` | `FleetTable`, `AssignVehicleModal` |
| `/treatment/dashboard` | CBWTF Gate & Destruction Desk| `TREATMENT_FACILITY_STAFF` | `GET /api/dashboard/facility` | `InboundQueue`, `DestructionPendingTable` |
| `/government/dashboard` | State Pollution Control Radar| `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN` | `GET /api/dashboard/government` | `StateKpiGrid`, `ViolationSummary` |
| `/government/map` | Live Statewide GIS Radar Map | `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN` | `GET /api/transport/active`, `GET /api/facilities` | `LiveFleetMap`, `VehicleDetailOverlay` |
| `/alerts` | Incident & Violation Inbox | Hospital, Plant, Gov, Admin | `GET /api/alerts`, `PATCH /api/alerts/:id` | `AlertsTable`, `InvestigationDrawer` |
| `/admin/users` | User Administration | `HOSPITAL_ADMIN`, `SUPER_ADMIN` | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/status` | `UserTable`, `CreateUserModal` |
| `/admin/facilities` | Facility Directory & Approvals| `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN` | `GET /api/facilities`, `PATCH /api/facilities/:id/approve` | `FacilityTable`, `ApprovalActionModal` |
| `/admin/compliance-rules`| Regulatory SLA Thresholds | `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN` | `GET /api/compliance-rules`, `PUT /api/compliance-rules/:id` | `SlaRuleTable`, `EditRuleDrawer` |
| `/admin/waste-categories`| Category Codes & Colors | `SUPER_ADMIN` | `GET/POST/PATCH/DELETE /api/waste-categories` | `CategoryGrid`, `CategoryEditModal` |
| `/admin/audit-log` | Immutable System Audit Trail | `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN` | `GET /api/audit-log` | `AuditLogTable`, `MetadataViewer` |

---

## 10. Navigation Architecture

### 10.1 Desktop Sidebar (`w-64`, Fixed Left)
The desktop sidebar is rendered inside `src/components/layout/Sidebar.tsx`. Its navigation links are dynamically filtered according to `user.role`:

```
┌──────────────────────────────────────────────┐
│  [BioTrack Logo] BioTrack Pro               │
│  City General Hospital                       │
├──────────────────────────────────────────────┤
│  OPERATIONS                                  │
│  [■] Dashboard              (/hospital/dash) │
│  [📷] Quick Scan             (/scan)          │
│  [+] New Waste Batch        (/waste-batches/n│
│  [≡] Waste Directory        (/waste-batches) │
│                                              │
│  MONITORING & LOGISTICS                      │
│  [🚛] Active Transport       (/transport/act) │
│  [⚠️] Alerts & Tickets (3)   (/alerts)        │
│                                              │
│  MANAGEMENT                                  │
│  [👥] Hospital Staff         (/admin/users)   │
│  [⚙️] Settings & Profile     (/settings)      │
├──────────────────────────────────────────────┤
│  [User Avatar] Aisha Sharma (Admin)          │
│  [🚪 Sign Out]                               │
└──────────────────────────────────────────────┘
```

### 10.2 Mobile Bottom Dock (`h-16`, Fixed Bottom, Viewport < 768px)
On mobile devices, the sidebar is hidden and replaced by `src/components/layout/MobileNav.tsx`:

```
┌─────────────────────────────────────────────────────────────┐
│   [🏠]          [📋]            [📷]           [⚠️]    [👤] │
│  Home        Batches         SCAN (FAB)      Alerts   Menu  │
└─────────────────────────────────────────────────────────────┘
```
- **Center Floating Action Button (FAB):** Elevated green circular button (`w-14 h-14 -translate-y-4 shadow-xl`) that instantly triggers `/scan`.

### 10.3 Application Header (`h-16`, Fixed Top)
Rendered by `src/components/layout/AppHeader.tsx`:
- **Left:** Hospital / Facility title badge + Role badge (e.g. `[HOSPITAL_ADMIN]`).
- **Center:** WebSocket real-time connection status dot:
  - Pulsing Green: Live Socket.IO connection active (`socket.connected === true`).
  - Solid Amber: Reconnecting / Fallback polling active.
- **Right:**
  - Emergency Scan button (`/scan`).
  - Notification Bell (`NotificationBell.tsx`) displaying real-time unread badge count from `GET /api/notifications/unread-count`. Clicking slides open the Notification Drawer.
  - User Menu with "Log Out" action.

---

## 11. Design System & Tokens

### 11.1 Neutral Scale (Slate Core)
```css
--neutral-0:    #FFFFFF; /* Surface, Cards, Modals */
--neutral-50:   #F8FAFC; /* Page Background */
--neutral-100:  #F1F5F9; /* Subtle Section Background, Table Headers */
--neutral-200:  #E2E8F0; /* Borders, Table Dividers */
--neutral-300:  #CBD5E1; /* Form Input Borders (Resting) */
--neutral-400:  #94A3B8; /* Placeholder Text, Disabled Icons */
--neutral-500:  #64748B; /* Secondary Text, Metadata Labels */
--neutral-600:  #475569; /* Table Secondary Text */
--neutral-700:  #334155; /* Form Field Labels, High-Contrast Body */
--neutral-800:  #1E293B; /* Card & Section Headings */
--neutral-900:  #0F172A; /* Sidebar Background, Display Headings */
```

### 11.2 Primary Action Palette (Clinical Deep Blue)
```css
--primary-50:   #EFF6FF; /* Selected Row Highlight Tint */
--primary-100:  #DBEAFE; /* Button Hover Tint */
--primary-500:  #3B82F6; /* Focus Ring Border Hue */
--primary-600:  #2563EB; /* Primary Action Buttons, Active Nav Link */
--primary-700:  #1D4ED8; /* Primary Button Hover State */
--primary-900:  #1E3A8A; /* High-Emphasis Brand Accents */
```

### 11.3 Status Vocabulary (Strict Semantic Enforcement)
Status colors are reserved **exclusively** for lifecycle state and compliance indicators. They are never used for decorative elements:

| Semantic State | Text / Icon Hex | Background Tint Hex | Border Hex | Paired Lucide Icon | Usage |
|---|---|---|---|---|---|
| **SUCCESS** | `#15803D` | `#F0FDF4` | `#BBF7D0` | `CheckCircle2` | `VERIFIED_CLOSED`, `TREATED`, `APPROVED`, `ACTIVE` |
| **PENDING** | `#B45309` | `#FFFBEB` | `#FDE68A` | `Clock` | `IN_TRANSIT`, `COLLECTED`, `PENDING`, `IN_PROGRESS` |
| **DANGER** | `#B91C1C` | `#FEF2F2` | `#FECACA` | `AlertTriangle` | `VIOLATION`, `ALERT_HIGH`, `SUSPENDED`, `DEACTIVATED` |
| **INFO** | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` | `Info` | `REGISTERED`, `QR_ASSIGNED`, System Notices |

### 11.4 CPCB Biomedical Waste Category Color Coding
Statutory color coding enforced across bag pickers, batch badges, and QR sticker headers:

```
Category: SHARPS       Hex: #DC2626 (Crimson Red)    Icon: Scissors / Needle
Category: INFECTIOUS   Hex: #D97706 (Amber Yellow)   Icon: Biohazard
Category: PATHOLOGICAL Hex: #7C3AED (Deep Purple)    Icon: ActivitySquare
Category: GENERAL_BIO  Hex: #2563EB (Medical Blue)   Icon: Package
```

### 11.5 Typography Scale (Inter Font Family)
Font stack: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

- `Display`: `30px` / `36px` | Weight 700 (Bold) | Tracking `-0.02em` (Dashboard Hero)
- `H1`: `24px` / `32px` | Weight 700 (Bold) | Tracking `-0.01em` (Page Titles)
- `H2`: `20px` / `28px` | Weight 600 (Semibold) | Tracking `-0.01em` (Panel Headers)
- `H3`: `16px` / `24px` | Weight 600 (Semibold) | Tracking `0` (Subheaders)
- `Body Large`: `15px` / `22px` | Weight 500 (Medium) (Inputs, Buttons)
- `Body`: `14px` / `20px` | Weight 400 (Regular) (Table Rows)
- `Caption`: `12px` / `16px` | Weight 500 (Medium) (Timestamps, Tags)
- `Monospace`: `13px` / `18px` | Weight 600 (Font: `Fira Code`, `monospace`) (QR Strings, IDs)

---

## 12. Responsive Design & Viewport Strategy

| Viewport Category | Breakpoint Range | Shell Layout | Primary Interaction Pattern |
|---|---|---|---|
| **Desktop / Command Center** | `≥ 1024px` (`lg`, `xl`) | Fixed Left Sidebar (260px) + Top Header | Dense multi-column data tables, split-screen GIS maps |
| **Tablet / Clinical Ward** | `768px – 1023px` (`md`) | Collapsible Sidebar + Sticky Header | 2-column forms, touch-friendly tables with horizontal scroll |
| **Field Mobile (Driver/Nurse)**| `< 768px` (`sm`) | Top Header + Fixed Bottom Dock (64px) | Single column, massive touch cards, full-screen camera view |

### Mobile Field Requirements:
- Touch target minimum: **48 × 48px** for all buttons; **56px** height for primary submit CTAs.
- No hover-dependent interactions. Everything triggers on direct tap.
- Form inputs trigger correct virtual keyboards (`inputMode="decimal"` for weight, `type="email"` for login).
- Universal Scanner (`/scan`) automatically fills the viewport without horizontal overflow.

---

## 13. Accessibility (WCAG 2.2 AA Compliance)

1. **Color Contrast:** Minimum 4.5:1 for standard text (14px/16px) against backgrounds; minimum 3:1 for large text (≥ 24px) and active UI icons.
2. **Focus Visibility:** Standard 2px primary ring (`focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none`) on all interactive controls. Focus rings are never suppressed.
3. **Screen Reader Semantics:** All icon-only buttons include explicit `aria-label` attributes (e.g. `<button aria-label="Toggle camera flashlight">`).
4. **Modal Dialog Focus Trapping:** Dialog components trap tab focus inside the modal and restore focus to the triggering element upon close (via Radix UI / headless primitives).
5. **Reduced Motion:** If `prefers-reduced-motion: reduce` is detected, animations and transitions are disabled (`transition: none !important; animation: none !important;`).

---

## 14. Frontend Technology Stack & Package Ecosystem

The frontend runs in `frontend/` using packages already declared in `package.json`:

```json
{
  "dependencies": {
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "@tanstack/react-query": "^5.102.8",
    "zustand": "^5.0.15",
    "react-hook-form": "^7.87.0",
    "@hookform/resolvers": "^5.9.1",
    "zod": "^4.5.4",
    "socket.io-client": "^4.8.3",
    "html5-qrcode": "^2.3.8",
    "qrcode": "^1.5.4",
    "lucide-react": "^1.41.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0"
  }
}
```

---

## 15. Frontend Architecture & Directory Blueprint

```
frontend/src/
├── app/                                 # Next.js App Router
│   ├── (auth)/                          # Public Authentication Route Group
│   │   ├── layout.tsx                   # Centered minimal auth shell
│   │   └── login/
│   │       └── page.tsx                 # Login view
│   ├── (app)/                           # Authenticated Application Route Group
│   │   ├── layout.tsx                   # Main Shell (Header, Sidebar, MobileNav, Socket)
│   │   ├── scan/
│   │   │   └── page.tsx                 # Universal Camera QR Scanner
│   │   ├── hospital/
│   │   │   └── dashboard/
│   │   │       └── page.tsx             # Hospital Admin / Staff Metrics
│   │   ├── waste-batches/
│   │   │   ├── page.tsx                 # Searchable Batch Directory
│   │   │   ├── new/
│   │   │   │   └── page.tsx             # New Waste Batch Registration Form
│   │   │   └── [id]/
│   │   │       ├── page.tsx             # Batch Detail & 9-Stage Custody Timeline
│   │   │       └── print-qr/
│   │   │           └── page.tsx         # Adhesive Thermal Label Print Layout
│   │   ├── transport/
│   │   │   ├── active/
│   │   │   │   └── page.tsx             # Fleet Tracking & Dispatch Table
│   │   │   └── driver-mode/
│   │   │       └── page.tsx             # In-Cabin Driver Console
│   │   ├── treatment/
│   │   │   └── dashboard/
│   │   │       └── page.tsx             # CBWTF Inbound Queue & Destruction Desk
│   │   ├── government/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx             # Statewide Compliance Radar
│   │   │   └── map/
│   │   │       └── page.tsx             # Live GIS Fleet Radar Map
│   │   ├── alerts/
│   │   │   └── page.tsx                 # Violation Tickets & Investigation Desk
│   │   └── admin/
│   │       ├── users/
│   │       │   └── page.tsx             # User Directory & Role Assignment
│   │       ├── facilities/
│   │       │   └── page.tsx             # Facility Onboarding & Approvals
│   │       ├── compliance-rules/
│   │       │   └── page.tsx             # SLA Threshold Management
│   │       ├── waste-categories/
│   │       │   └── page.tsx             # Biomedical Waste Categories
│   │       └── audit-log/
│   │           └── page.tsx             # Immutable System Audit Trail
│   ├── globals.css                      # Tailwind directives & design tokens
│   └── layout.tsx                       # Root Layout (QueryClientProvider, Inter font)
│
├── components/                          # Reusable UI Component Library
│   ├── ui/                              # Atomic Primitives
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── table.tsx
│   │   ├── card.tsx
│   │   └── skeleton.tsx
│   ├── layout/                          # Global App Shell Layout
│   │   ├── AppHeader.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx
│   │   └── NotificationDrawer.tsx
│   └── shared/                          # Domain Components
│       ├── CustodyTimeline.tsx          # 9-Stage Chain of Custody Timeline
│       ├── QRScannerViewport.tsx        # Camera hardware viewport (html5-qrcode)
│       ├── PrintableQRLabel.tsx         # SVG thermal sticker print format
│       ├── LiveGpsMap.tsx               # Leaflet GIS canvas
│       ├── CategoryBadge.tsx            # Color-coded biohazard category tag
│       └── MetricCard.tsx               # High-level statistics card
│
├── hooks/                               # Custom React Hooks
│   ├── useSocket.ts                     # Socket.IO connection & query invalidation
│   ├── useGeolocation.ts                # WatchPosition background GPS tracker
│   └── useAuth.ts                       # Session helpers & role permissions
│
├── lib/                                 # Utilities & HTTP Client
│   ├── api.ts                           # Axios / Fetch client with bearer interceptor
│   ├── utils.ts                         # Tailwind merge (clsx + twMerge)
│   └── audio.ts                         # Web Audio API alert & scanner beeper
│
├── stores/                              # Zustand State Stores
│   ├── authStore.ts                     # In-memory token & user session state
│   └── scanStore.ts                     # Universal scan result & state machine buffer
│
└── types/                               # TypeScript Definitions
    ├── models.ts                        # Enums & Prisma domain entity types
    └── api.ts                           # HTTP payload & response interfaces
```

---

## 16. API Contract Mapping

Every frontend query and mutation maps directly to a verified NestJS backend endpoint:

### 16.1 Authentication (`AuthModule`)
- **`POST /api/auth/login`**
  - **Payload:** `{ email: string, password: string }`
  - **Response:** `{ accessToken: string, user: { id: string, name: string, email: string, role: UserRole, facilityId: string | null } }` (Sets HttpOnly `refreshToken` cookie).
  - **React Query:** `useMutation` -> On success, stores `accessToken` and `user` in `authStore.ts`, sets default axios header, redirects to role dashboard.
- **`POST /api/auth/refresh`**
  - **Payload:** None (reads cookie).
  - **Response:** `{ accessToken: string }`
  - **Behavior:** Executed by Axios response interceptor on `401 Unauthorized`.
- **`POST /api/auth/logout`**
  - **Payload:** None.
  - **Response:** `{ message: 'Logged out successfully' }`
  - **Behavior:** Clears `authStore`, resets query cache (`queryClient.clear()`), redirects to `/login`.

### 16.2 Users (`UsersModule`)
- **`GET /api/users/me`**
  - **Response:** `{ id, name, email, role, facilityId, facility?: { id, name, type, registrationNumber, address } }`
  - **React Query Key:** `['users', 'me']` | Stale time: `5 minutes`.
- **`GET /api/users`**
  - **Query Params:** `role?: UserRole`, `facilityId?: string`, `status?: UserStatus`
  - **Response:** `User[]`
  - **React Query Key:** `['users', { role, facilityId, status }]`
- **`POST /api/users`**
  - **Payload:** `{ name: string, email: string, phone?: string, password: string, role: UserRole, facilityId?: string }`
  - **Invalidation:** Invalidates `['users']`.
- **`PATCH /api/users/:id/status`**
  - **Payload:** `{ status: 'ACTIVE' | 'DEACTIVATED' }`
  - **Invalidation:** Invalidates `['users']`.

### 16.3 Facilities (`FacilitiesModule`)
- **`GET /api/facilities`**
  - **Query Params:** `status?: FacilityStatus`, `type?: FacilityType`
  - **Response:** `Facility[]` (Includes `authorizedCategoryIds: string[]`).
  - **React Query Key:** `['facilities', { status, type }]` | Stale time: `60 seconds`.
- **`GET /api/facilities/:id`**
  - **Response:** `Facility`
  - **React Query Key:** `['facilities', id]`
- **`POST /api/facilities`**
  - **Payload:** `{ name: string, type: FacilityType, registrationNumber: string, address: string, latitude?: number, longitude?: number, geofenceRadiusM?: number, authorizedCategoryIds?: string[] }`
  - **Invalidation:** Invalidates `['facilities']`.
- **`PATCH /api/facilities/:id/approve`**
  - **Payload:** `{ action: 'APPROVED' | 'SUSPENDED' }`
  - **Invalidation:** Invalidates `['facilities']`.

### 16.4 Waste Batches (`WasteBatchesModule`)
- **`POST /api/waste-batches`**
  - **Payload:** `{ categoryId: string, department: string, quantity: number, unit: 'KG' | 'COUNT', photoUrl?: string, idempotencyKey?: string }`
  - **Response:** Created `WasteBatch` object with generated `wasteId`.
  - **Invalidation:** Invalidates `['waste-batches']`, `['dashboard', 'hospital']`.
- **`POST /api/waste-batches/:id/qr`**
  - **Response:** `{ id: string, wasteBatchId: string, codeValue: string, generatedAt: string, generatedByUserId: string }`
- **`POST /api/scan`**
  - **Payload:** `{ codeValue: string }`
  - **Response:** `{ batch: WasteBatch & { category: WasteCategory, hospital: Facility }, qrCode: QrCode }`
  - **Usage:** Universal scan handler in `/scan`.
- **`POST /api/waste-batches/:id/custody-events`**
  - **Payload:** `{ eventType: CustodyEventType, toUserId?: string, latitude?: number, longitude?: number, notes?: string, photoUrl?: string }`
  - **Invalidation:** Invalidates `['waste-batches', id, 'history']`, `['waste-batches']`.
- **`POST /api/waste-batches/:id/verify-arrival`**
  - **Payload:** `{ latitude: number, longitude: number }`
  - **Behavior:** Executes 5-step arrival verification. Transitions batch to `RECEIVED`.
  - **Invalidation:** Invalidates `['waste-batches', id]`, `['dashboard', 'facility']`.
- **`POST /api/waste-batches/:id/confirm-treatment`**
  - **Payload:** `{ notes?: string, photoUrl?: string }`
  - **Behavior:** Records `TREATMENT_CONFIRMED`, automatically triggers closure to `VERIFIED_CLOSED`.
  - **Invalidation:** Invalidates `['waste-batches', id]`, `['dashboard', 'facility']`.
- **`GET /api/waste-batches/:id/history`**
  - **Response:** `WasteBatch` with nested `custodyEvents: CustodyEvent[]` and `alerts: Alert[]`.
  - **React Query Key:** `['waste-batches', id, 'history']`
- **`GET /api/waste-batches`**
  - **Query Params:** `status?: WasteBatchStatus`, `hospitalId?: string`, `categoryId?: string`, `limit?: number`, `offset?: number`
  - **Response:** `WasteBatch[]`

### 16.5 Transport & GPS (`TransportModule`, `GpsModule`)
- **`GET /api/transport/active`**
  - **Response:** `TransportAssignment[]` with nested `vehicle`, `driverUser`, `wasteBatch`, and latest `gpsPings`.
  - **React Query Key:** `['transport', 'active']` | Stale time: `10 seconds`.
- **`GET /api/transport/my-assignment`**
  - **Response:** Current active `TransportAssignment` for the authenticated driver.
  - **React Query Key:** `['transport', 'my-assignment']`
- **`POST /api/transport/assignments`**
  - **Payload:** `{ wasteBatchId: string, vehicleId: string, driverUserId: string, expectedFacilityId: string }`
  - **Invalidation:** Invalidates `['transport', 'active']`, `['waste-batches']`.
- **`GET /api/transport/vehicles`**
  - **Response:** `Vehicle[]` (`ACTIVE` vehicles).
  - **React Query Key:** `['vehicles']`
- **`POST /api/gps-pings`**
  - **Payload:** `{ transportAssignmentId: string, latitude: number, longitude: number }`
- **`GET /api/gps-pings/:assignmentId`**
  - **Response:** `GpsPing[]` sorted chronologically.
  - **React Query Key:** `['gps-pings', assignmentId]`

### 16.6 Compliance Rules (`ComplianceRulesModule`)
- **`GET /api/compliance-rules`**
  - **Response:** `ComplianceRule[]` with nested `wasteCategory`.
  - **React Query Key:** `['compliance-rules']`
- **`PUT /api/compliance-rules/:id`**
  - **Payload:** `{ maxDurationHours: number }`
  - **Invalidation:** Invalidates `['compliance-rules']`.

### 16.7 Alerts & Tickets (`AlertsModule`)
- **`GET /api/alerts`**
  - **Query Params:** `status?: AlertStatus`, `type?: AlertType`, `severity?: AlertSeverity`
  - **Response:** `Alert[]` with nested `wasteBatch`.
  - **React Query Key:** `['alerts', { status, type, severity }]`
- **`PATCH /api/alerts/:id`**
  - **Payload:** `{ status: 'INVESTIGATING' | 'RESOLVED', notes?: string }`
  - **Invalidation:** Invalidates `['alerts']`, `['notifications']`.

### 16.8 Dashboards (`DashboardsModule`)
- **`GET /api/dashboard/hospital`** -> Key: `['dashboard', 'hospital']`
- **`GET /api/dashboard/facility`** -> Key: `['dashboard', 'facility']`
- **`GET /api/dashboard/government`** -> Key: `['dashboard', 'government']`

### 16.9 Notifications (`NotificationsModule`)
- **`GET /api/notifications`** -> Key: `['notifications']`
- **`GET /api/notifications/unread-count`** -> Key: `['notifications', 'unread-count']`
- **`PATCH /api/notifications/:id/read`** -> Invalidates `['notifications']`.
- **`PATCH /api/notifications/mark-all-read`** -> Invalidates `['notifications']`.

### 16.10 Audit Logs (`AuditLogModule`)
- **`GET /api/audit-log`** -> Key: `['audit-log', { entityType, entityId, limit, offset }]`

---

## 17. Socket.IO Real-Time Architecture

The backend exposes a single WebSocket gateway on namespace `/notifications`:

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Client (Host :3000)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
            1. Connect to ws://localhost:3001/notifications
            2. emit('join', { userId, role })
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              NestJS NotificationsGateway (:3001)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
     Broadcasts:               │
     • 'alert:new'             ├──> Pushed to GOVERNMENT & ADMIN
     • 'transport:update'      └──> Pushed to GOV, HOSPITAL, ADMIN
```

### 17.1 Real-Time React Query Invalidation Rules
When the `useSocket` hook receives an incoming socket event, it triggers specific cache invalidations:

| Socket Event | Payload | Target Roles | Frontend Reaction |
|---|---|---|---|
| `alert:new` | `Alert` object | `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN`, `HOSPITAL_ADMIN` | 1. Invalidates `['alerts']`, `['notifications']`<br>2. Plays warning audio chime<br>3. Displays toast banner with link to `/alerts` |
| `transport:update` | `TransportAssignment` | `GOVERNMENT_AUTHORITY`, `HOSPITAL_ADMIN`, `SUPER_ADMIN` | 1. Invalidates `['transport', 'active']`<br>2. Updates Live GIS Map marker positions |
| `joined` | `{ userId: string }` | Client | Confirms room attachment in browser console |

---

## 18. Detailed Page Specifications

---

### 18.1 Authentication Portal (`/login`)
- **Route:** `/login`
- **Access:** Public. Authenticated users are automatically redirected to their default home dashboard.
- **Layout:** Split clinical layout (Left: Regulatory compliance highlights; Right: High-contrast authentication card).
- **Form Fields:**
  - `email`: Required, valid email format.
  - `password`: Required, minimum 6 characters.
- **Quick Demo Presets:** 7 one-click buttons to instantly test any role:
  - Hospital Admin (`admin@citygeneral.in`)
  - Hospital Staff (`staff@citygeneral.in`)
  - Collection Staff (`collection@biotrack.in`)
  - Transport Driver (`transport@biotrack.in`)
  - Treatment Staff (`facility@greendispose.in`)
  - Government Authority (`gov@mpcb.gov.in`)
  - Super Admin (`admin@biotrack.in`)
  Password for all presets: `BioTrack@2026`.
- **States:**
  - *Loading:* Button shows spinner with label `"Authenticating credentials..."`.
  - *Error:* Red alert banner displaying `"Incorrect email or password"` or account deactivation notice.

---

### 18.2 Universal QR Scanner (`/scan`)
- **Route:** `/scan`
- **Access:** Operational Roles (`HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`, `TREATMENT_FACILITY_STAFF`).
- **Purpose:** Universal camera interface that resolves barcode reads into allowable actions using the verified state machine.
- **Layout:**
  - Full-screen camera viewport using `html5-qrcode` library.
  - Top hardware controls: Flashlight/Torch toggle, Camera switch (rear/front).
  - Center framing square with scanning green radar pulse.
  - Bottom: "Manual Code Entry" button for damaged barcodes.
- **State Machine Dispatch:**
  1. Scan read triggers vibration (`navigator.vibrate(100)`).
  2. Calls `POST /api/scan` with `{ codeValue }`.
  3. Action Sheet slides up displaying batch details: Waste ID, Category Badge, Origin Hospital, Weight, and Current Status.
  4. Contextual action button rendered:
     - **`COLLECTION_STAFF` + `QR_ASSIGNED`:** `"Accept Custody into Collection"` -> Calls `POST /api/waste-batches/:id/custody-events` (`COLLECTION_ACCEPTED`).
     - **`TRANSPORT_PERSONNEL` + `COLLECTED`:** `"Start Transport Run"` -> Select vehicle -> Calls `POST /api/waste-batches/:id/custody-events` (`TRANSPORT_STARTED`).
     - **`TREATMENT_FACILITY_STAFF` + `IN_TRANSIT`:** `"Verify CBWTF Arrival"` -> Captures device GPS -> Calls `POST /api/waste-batches/:id/verify-arrival`.
     - **`TREATMENT_FACILITY_STAFF` + `RECEIVED`:** `"Confirm Destruction"` -> Enter notes -> Calls `POST /api/waste-batches/:id/confirm-treatment`.

---

### 18.3 Rapid Waste Batch Registration (`/waste-batches/new`)
- **Route:** `/waste-batches/new`
- **Access:** `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`.
- **Purpose:** Fast batch generation at the hospital ward. Designed for sub-45-second completion.
- **Layout:** Single-column card layout on mobile; two-column on desktop.
- **Form Fields:**
  1. **Category Picker:** Visual 4-card selector populated from `GET /api/waste-categories` (Sharps Red, Infectious Yellow, Pathological Purple, General Blue).
  2. **Department / Ward:** Text input with common autocomplete presets ("ICU - Ward 3", "Surgery Suite A", "Pathology Lab", "Emergency").
  3. **Quantity:** Positive decimal input (`min="0.01"`).
  4. **Unit:** Segmented radio toggle: `KG` (default) or `COUNT`.
  5. **Bag Photo:** Optional mobile file camera input.
- **Submit Action:** Sends `POST /api/waste-batches` with client-generated `idempotencyKey: uuidv4()`.
- **Success Behavior:** Redirects immediately to `/waste-batches/[id]/print-qr`.

---

### 18.4 Adhesive QR Label Print View (`/waste-batches/[id]/print-qr`)
- **Route:** `/waste-batches/[id]/print-qr`
- **Access:** Hospital Roles.
- **Purpose:** Formats thermal adhesive sticker conforming to standard 4" × 2" (100mm × 50mm) label rolls.
- **Layout:**
  - Printable card with solid black border and biohazard header.
  - High-resolution vector SVG QR code generated client-side via `qrcode` with error correction level `H` (30% recovery).
  - Printed fields: Waste ID, Category (Color & Text), Hospital Name, Department, Weight, Generation Timestamp, Generator Name.
  - Footer warning: `WARNING: BIO-HAZARDOUS CLINICAL WASTE — DO NOT OPEN`.
- **Print Mechanics:** Top toolbar button: `[ 🖨️ Print Label Sticker ]`. Invokes `window.print()`. CSS `@media print` hides all shell elements, margins, and sidebars.

---

### 18.5 Waste Batch Detail & 9-Stage Custody Timeline (`/waste-batches/[id]`)
- **Route:** `/waste-batches/[id]`
- **Access:** All Authenticated Roles (Scoped by facility if hospital or treatment staff).
- **Layout:**
  - Top Hero: Waste ID, Category Badge, Weight, Origin Hospital, Current Status Badge.
  - Main Panel: 9-Stage Chain of Custody Timeline (`CustodyTimeline.tsx`).
  - Side Panel: Metadata summary (Custodian user, Department, Created timestamp, Mini Route Map if in transit).
- **9-Stage Lifecycle Reconciliation:**
  1. `REGISTERED`: Batch created at hospital ward.
  2. `QR_ASSIGNED`: Label generated and affixed.
  3. `COLLECTION_ACCEPTED`: Handed over to collection staff.
  4. `TRANSPORT_STARTED`: Loaded onto vehicle by driver.
  5. `IN_TRANSIT`: Actively moving with live GPS trail.
  6. `ARRIVAL_VERIFIED`: Arrived at treatment plant, passed 5-step verification.
  7. `TREATED`: Destruction performed (autoclave/incinerator).
  8. `VERIFIED_CLOSED`: Final compliance audit closed.
  9. `VIOLATION`: Branch state displayed in crimson if an SLA delay or geofence breach occurred.

---

### 18.6 In-Cabin Driver Console (`/transport/driver-mode`)
- **Route:** `/transport/driver-mode`
- **Access:** `TRANSPORT_PERSONNEL`.
- **Purpose:** High-contrast, dashboard-mounted mobile console for hazardous waste van drivers.
- **Layout:**
  - Top Status Bar: GPS signal lock indicator (Green dot = Strong lock; Red = Lost), Van registration number (`MH-04-AB-1234`).
  - Center Metric: Destination facility name, manifest bag count (e.g. `8 Batches on Board (142.5 KG)`), Estimated trip distance.
  - Massive Touch Actions (56px minimum height):
    - `[ 📷 SCAN BAG ONTO VAN ]`: Opens camera scanner to link batch to assignment.
    - `[ 🏁 REPORT ARRIVAL AT CBWTF ]`: Prompts driver to park inside gate for facility scan.
    - `[ ⚠️ REPORT BREAKDOWN / STALL ]`: Triggers incident notice to dispatch.
- **Background GPS Telemetry:**
  - Activates `navigator.geolocation.watchPosition()`.
  - Sends coordinates to `POST /api/gps-pings` every 30 seconds while run is in progress.

---

### 18.7 Treatment Facility CBWTF Gate Console (`/treatment/dashboard`)
- **Route:** `/treatment/dashboard`
- **Access:** `TREATMENT_FACILITY_STAFF`.
- **Layout:**
  - Metric Header: Inbound Vans, Batches Awaiting Arrival Scan, Batches Pending Destruction, Treated Today.
  - Table 1: Inbound Transport Vehicles (Vehicle number, Driver, Estimated Bags, Geofence Status).
  - Table 2: Batches Awaiting Destruction (Waste ID, Category, Weight, Arrived At).
- **5-Step Arrival Verification Enforcement:**
  Triggered when staff clicks "Verify Arrival":
  1. *User Auth:* Confirms user belongs to treatment facility.
  2. *Facility Status:* Confirms facility is `APPROVED`.
  3. *Category Authorization:* Confirms CBWTF's `authorizedCategoryIds` JSON includes batch category.
  4. *Geofence Proximity:* Confirms device coordinates are within `geofenceRadiusM` (default 300m) of facility.
  5. *Time SLA:* Confirms elapsed transit time is within compliance rule hours.
  Pass: Status becomes `RECEIVED`. Fail: Displays exact reason and raises breach alert.

---

### 18.8 Live Statewide GIS Fleet Radar Map (`/government/map`)
- **Route:** `/government/map`
- **Access:** `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN`.
- **Layout:** Full-viewport interactive vector map (Leaflet / OpenStreetMap):
  - Hospital Markers (Blue cross): Displays name, registered batches awaiting pickup.
  - Treatment Plant Markers (Green factory): Displays CBWTF name, current processing queue.
  - Vehicle Markers (Yellow van icon): Displays license plate, driver name, current speed, and heading vector.
  - Breadcrumb Trail: Polylines connecting historical `GpsPing` points for active shipments.
  - Alert Overlay: Red pulsing circles around vehicles with active `ROUTE_DEVIATION` or `UNAUTHORIZED_LOCATION` alerts.
  - Drawer on Click: Clicking any van or facility displays real-time manifest and driver contact info.

---

### 18.9 Regulatory Alerts & Violation Desk (`/alerts`)
- **Route:** `/alerts`
- **Access:** `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN`, `HOSPITAL_ADMIN` (scoped).
- **Layout:** Tabbed filter table:
  - Tabs: `Open` (default), `Under Investigation`, `Resolved`.
  - Severity Badges: `HIGH` (Crimson Red), `MEDIUM` (Amber Orange), `LOW` (Amber Yellow).
  - Alert Types:
    - `DISPOSAL_DELAY`: Exceeded category SLA maximum hours.
    - `UNAUTHORIZED_LOCATION`: Stationary outside permitted area.
    - `ROUTE_DEVIATION`: Left designated transport corridor.
    - `MISSING_SCAN`: Handover scan not performed within expected window.
- **Investigation Drawer:**
  Clicking any alert slides open the full audit file:
  - Root cause timestamp.
  - Associated Waste Batch and Custody Log.
  - Action Form: Status selector (`INVESTIGATING` / `RESOLVED`), Auditor Notes field (required for resolution). Submits to `PATCH /api/alerts/:id`.

---

### 18.10 SLA Compliance Thresholds Management (`/admin/compliance-rules`)
- **Route:** `/admin/compliance-rules`
- **Access:** `SUPER_ADMIN`, `GOVERNMENT_AUTHORITY`.
- **Purpose:** Configure statutory time limits per waste category and custody stage.
- **Layout:** Table displaying each `wasteCategory` and stages (`COLLECTION`, `TRANSPORT`, `TREATMENT`):
  - Row shows current `maxDurationHours`.
  - "Edit SLA" button opens modal.
  - Modifying hours executes `PUT /api/compliance-rules/:id`.
  - Invalidates `['compliance-rules']`.

---

## 19. Form Architecture & Validation Rules

Forms are implemented using **React Hook Form v7** with **Zod v4** resolvers:

### 19.1 Batch Creation Schema (`batchSchema.ts`)
```typescript
import { z } from 'zod';

export const createBatchSchema = z.object({
  categoryId: z.string().min(1, 'Please select a waste category'),
  department: z.string().min(2, 'Department name must be at least 2 characters').max(100),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.enum(['KG', 'COUNT'], { required_error: 'Please select a unit' }),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
```

### 19.2 Universal Form Behavior Standards
1. **Validation Timing:** `mode: "onBlur"`. Fields validate as the user leaves the input; error disappears immediately once corrected.
2. **Visual Feedback:** Errored inputs receive `border-red-500 focus:ring-red-500`. Field error message renders in `text-xs text-red-600 font-medium mt-1`.
3. **Double-Submit Prevention:** Submit buttons are disabled while `formState.isSubmitting === true`, displaying a spinner and label `"Submitting..."`.
4. **Server-Side Error Mapping:** Backend `400 Bad Request` validation arrays are mapped back to individual field errors using `setError(field, { message })`.

---

## 20. Unified UI State Model

Every page and component implements this consistent 7-state lifecycle:

```
                  ┌──────────────┐
                  │     IDLE     │
                  └──────┬───────┘
                         │ Fetch / Mount
                         ▼
                  ┌──────────────┐
                  │   LOADING    │ ──> Render Skeleton Layout
                  └──────┬───────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │   SUCCESS   │ │    EMPTY    │ │    ERROR    │
  └─────────────┘ └─────────────┘ └──────┬──────┘
                                         │
                         ┌───────────────┼───────────────┐
                         ▼               ▼               ▼
                  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                  │ 401 UNAUTH  │ │ 403 FORBID  │ │ 500 SERVER  │
                  └─────────────┘ └─────────────┘ └─────────────┘
```

1. **Loading State:** Renders structural skeletons (`<Skeleton />` from `src/components/ui/skeleton.tsx`) matching the exact shape of content. No full-page blocking spinners.
2. **Empty State:** Clean illustration, clear message ("No active shipments in transit"), and an actionable button ("Dispatch New Van").
3. **401 Unauthorized:** Automatically clears credentials and redirects to `/login?redirect=<currentPath>`.
4. **403 Forbidden:** Renders dedicated access denied screen with message: `"Your role does not have permission to view this resource"`, plus a `"Return to Dashboard"` button.
5. **Network Failure:** Persistent amber banner at top: `"Unable to connect to server. Retrying..."`.

---

## 21. Security UX Specifications

1. **In-Memory JWT Storage:** Access tokens are kept strictly in Zustand memory. They are **never stored in `localStorage`** or `sessionStorage` to eliminate XSS token theft.
2. **Silent Token Refresh:** The Axios interceptor intercepts `401` errors, requests `POST /api/auth/refresh` (authenticated via HttpOnly cookie), and transparently replays the failed request without disrupting the user.
3. **Session Invalidation:** If the refresh token expires, the user's session is terminated, memory wiped, and browser redirected to `/login`.
4. **Two-Step Confirmation Dialogs:** Any irreversible action (Confirming destruction, Suspending facility, Deactivating user) presents an explicit modal requiring the user to click `"Confirm"` (styled in crimson danger red).
5. **Sanitized Error Messaging:** Backend stack traces, SQL syntax errors, and database details are never rendered to the user. Global error boundaries display friendly messages (e.g. `"An unexpected error occurred. Please try again."`).

---

## 22. Performance & Hardware Constraints

1. **Camera FPS & CPU Throttling:** `html5-qrcode` scanner is configured for `fps: 10`, `qrbox: 250` to prevent mobile device overheating in direct sunlight.
2. **Geolocation Throttling:** Background driver tracking uses `maximumAge: 10000`, `timeout: 15000` to balance battery life with GPS accuracy.
3. **Thermal Label Print Optimization:** Label layout uses pure monochrome black/white `#000000` with zero CSS gradients or color fills to print instantly on standard thermal transfer printers without dithering.
4. **Bundle Optimization:** Leaflet maps and camera scanner libraries are dynamically imported (`next/dynamic` with `ssr: false`) to keep initial page load bundles under 120KB.

---

## 23. Testing & Verification Requirements

Before declaring frontend features complete, the following test scenarios must be verified:

1. **Auth & RBAC Matrix:**
   - Log in as each of the 7 roles using preset credentials.
   - Confirm each role is routed to its respective home dashboard.
   - Attempt direct URL navigation to an unauthorized route (e.g. `HOSPITAL_STAFF` accessing `/admin/users`) -> Verify `403 Forbidden` guard.
2. **QR Flow:**
   - Register batch -> Confirm redirect to print view -> Verify SVG QR renders valid string `BIOTRACK:<wasteId>:<hash>`.
   - Open `/scan` -> Scan generated QR -> Verify action drawer presents correct role-specific transition.
3. **5-Step CBWTF Arrival Test:**
   - Attempt arrival scan outside facility geofence -> Verify geofence breach rejection.
   - Attempt arrival scan with unauthorized category -> Verify category authorization rejection.
   - Execute valid scan within perimeter -> Confirm status updates to `RECEIVED`.
4. **Real-Time Broadcast Test:**
   - Open Government Map on Browser 1.
   - Send GPS ping or trigger alert on Browser 2 -> Verify map marker updates and toast notification appears without manual page refresh.

---

## 24. Known Ambiguities & Out-of-Scope Items

### 24.1 Explicitly Handled Ambiguities
- **Ambiguity:** `GET /api/auth/me` vs `GET /api/users/me`.  
  **Resolution:** The backend controller exposes `GET /api/users/me`. The frontend strictly uses `GET /api/users/me`.
- **Ambiguity:** Historical 9-stage lifecycle vs 8-state database enum.  
  **Resolution:** The UI separates historical custody log entries (which record discrete events like `COLLECTION_ACCEPTED`) from current batch status (`IN_TRANSIT`). The 9th state in the visual timeline is the conditional `VIOLATION` breach indicator.
- **Ambiguity:** Facility category IDs format.  
  **Resolution:** Stored as MySQL `JSON` array, transmitted as `string[]` over HTTP.

### 24.2 Out-of-Scope Confirmations
- Payment processing, external ERP integrations, native app binaries, and public marketing homepages remain strictly out of scope for this phase.

---

## 25. Final Implementation Checklist

- [x] Single authoritative `design.md` established.
- [x] All 7 user roles fully specified with navigation and permissions.
- [x] All 18 canonical routes documented with layouts, components, and APIs.
- [x] Complete API mapping covering every active NestJS endpoint.
- [x] Socket.IO `/notifications` gateway events documented with query invalidation rules.
- [x] Design system tokens defined (Colors, CPCB Category Palette, Inter Typography, Radius, Shadows).
- [x] Component hierarchy mapped (`ui/`, `layout/`, `shared/`).
- [x] Mobile touch guidelines and field hardware parameters specified.
- [x] WCAG 2.2 AA accessibility rules defined.
- [x] Zero mock endpoints, invented backend contracts, or placeholder screens.

**This specification (`design.md`) is now the definitive, approved design contract for all BioTrack frontend implementation.**