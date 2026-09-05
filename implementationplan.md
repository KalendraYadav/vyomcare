# BioTrack — Smart Biomedical Waste Tracking & Compliance System
## Production-Grade Master Implementation Plan

**Document type:** Engineering blueprint (architecture + roadmap), derived from raw SIH project documentation
**Status:** Planning complete — no application code has been written yet
**Target:** A real, deployable product (not a throwaway hackathon demo), with a scoped MVP for the SIH judging round

---

## 1. Executive Summary

BioTrack is a role-based, web-first platform that gives biomedical waste a **digital identity** (via QR code) from the moment it's generated in a hospital until it is verified as treated at an authorized facility. Every handover is scanned, timestamped, and geolocated, producing an immutable chain-of-custody log. A rules engine watches every batch against category-specific time limits and geofences, and automatically raises violation tickets when something breaks — a missed scan, a late arrival, an off-route vehicle, or a status update from outside an authorized facility.

The system is **not a public app**. It is a closed, permissioned platform for registered hospitals, collection/transport crews, treatment facilities, and government oversight bodies, gated by strict role-based access control (RBAC).

This document is the single architectural source of truth for the build. It separates what the raw documentation explicitly requires from what had to be engineered on top of it (labeled `ASSUMPTION`), and flags anything left open for the team to decide (labeled `AMBIGUITY` / `NOT SPECIFIED`).

The recommended build approach is a **modular monolith**: one NestJS backend, one Next.js frontend (the same frontend serves the mobile-optimized PWA scanning views — no separate mobile codebase for MVP), one PostgreSQL database. This avoids microservice overhead the project doesn't yet need, while keeping module boundaries clean enough to split out later if scale demands it.

---

## 2. Product Understanding

### 2.1 Product Definition

- **What it is:** A closed B2B/B2G SaaS platform for tracking biomedical waste custody, transport, and disposal compliance.
- **Problem solved:** Biomedical waste passes through many hands (hospital → collector → transporter → treatment facility) with no unified record. Segregation errors, missing handover records, delays, unauthorized disposal, and broken chains of responsibility are currently invisible until something goes wrong.
- **Primary users:** Hospital staff/admins, collection crews, transport personnel, treatment facility staff.
- **Secondary users:** Government/ministry compliance officers, super admins (platform operators).
- **Core value proposition:** Turn an untracked physical process into a verifiable digital chain of custody, with automatic detection of compliance violations — no manual auditing required.
- **Major workflows:** Waste registration → QR issuance → collection handover → transport → facility verification → treatment confirmation → closure; plus continuous compliance monitoring and alerting running alongside every batch.
- **Expected user journey:** A hospital staff member registers a batch in under a minute, prints/attaches a QR label, and from then on every actor in the chain interacts with that batch purely by scanning — no manual lookup, no paperwork.

### 2.2 Functional Scope (Feature Inventory)

| Category | Features |
|---|---|
| **Core** | Waste registration, QR generation, QR scan-based custody handover, transport assignment & tracking, facility arrival verification, treatment confirmation, chain-of-custody log |
| **Supporting** | Category-based SLA/compliance rules, geofencing, GPS tracking (live or simulated), photo capture at registration/handover |
| **Administrative** | Facility (hospital/treatment facility) registration & approval, user management, role assignment, waste category management, compliance-rule configuration |
| **Authentication** | Login, session/token management, password reset, account lockout on repeated failed attempts |
| **User management** | Role-based profiles, per-facility user scoping, activation/deactivation |
| **Data management** | Waste batch CRUD (create/register, read/track, controlled updates via status transitions, no hard delete — see §17) |
| **Search/filtering** | Search batches by ID/category/status/date/facility; filter dashboards by date range, status, facility |
| **Communication** | In-app notifications, alert broadcasts to relevant roles |
| **Analytics** | Compliance dashboards, per-hospital/per-facility waste volume trends, violation trend reporting |
| **Notifications** | Real-time alert push (in-app + optionally email) on violations and pending actions |
| **Settings** | Facility profile settings, notification preferences, compliance-rule tuning (Super Admin / Government) |
| **Security** | RBAC enforcement at API and UI layer, audit logging, geofenced action verification |
| **Other** | Public-facing "about/compliance info" marketing page is explicitly **out of scope** — see §5 |

---

## 3. Requirements Analysis

### 3.1 Explicit Requirements (directly from raw documentation)

- End-to-end chain of custody: Generated → Segregated → Registered → QR Assigned → Collected → Transported → Received → Treated/Disposed → Verified & Closed.
- Seven user types: Hospital Admin, Hospital Staff, Collection Staff, Transport Personnel, Treatment Facility Staff, Government/Ministry Authority, Super Admin.
- RBAC with a defined permission matrix (§7).
- Waste registration captures category, department/location, quantity/batch info, date/time, responsible staff, optional photo.
- Unique QR code per waste batch acting as its digital identity (example format `BMW-2026-001245`).
- QR scanning usable via smartphone camera; workers see only actions relevant to their role.
- Every handover scan records waste ID, previous handler, new handler, timestamp, GPS location, status.
- Transport tracking records vehicle ID, driver, start time, expected destination, GPS location; detects route deviation, long stops, non-arrival, missing updates.
- **Category-based, configurable time limits** per workflow stage (not one fixed deadline for everything) — compliance alerts fire when a batch misses its configured deadline.
- Facility verification on arrival checks: user authorization, facility registration, facility's authorization for that waste category, GPS/geofence match, arrival within time limit.
- Geofencing: a digital boundary around each authorized treatment facility; disposal/receipt actions only verify inside that boundary.
- Four named automated alert types: Disposal Delay, Unauthorized Location, Route Deviation, Missing Scan (Chain of Custody Incomplete).
- Three role-scoped dashboards: Hospital, Treatment Facility, Government — each with a defined widget list (§14).
- MVP demo scenario is explicitly scripted (10 steps) plus a failure-path demo (missed deadline → violation ticket → dashboard alert).
- The documentation itself flags three open decisions the team must make first: exact waste categories in scope, tracking granularity (bag/container/batch), and the exact demo flow.

### 3.2 Necessary Engineering Decisions (not stated, but required)

- Concrete technology stack (raw doc only lists loose categories: "frontend," "backend," "central database").
- Authentication mechanism and session strategy.
- Database schema and relational model.
- API design (REST vs. other).
- Hosting/deployment target.
- Geofence verification implementation (PostGIS vs. application-layer Haversine calculation).
- Real-time update mechanism for "vehicle moving on dashboard" (raw doc implies live movement but does not specify push vs. poll).
- Image storage mechanism for verification photos.
- What happens to a batch after a violation is resolved (manual override path).

### 3.3 Optional Enhancements (useful, not required for MVP)

- Native mobile apps (iOS/Android) beyond the PWA.
- SMS-based notifications for facilities with poor connectivity.
- Predictive analytics (e.g., forecasting which hospitals are trending toward violations).
- Multi-language UI (relevant given `2026` and an Indian government/hospital user base).
- Public transparency portal (aggregate, non-sensitive compliance stats) for citizens/NGOs.
- Blockchain-anchored audit trail (raw doc never mentions this — flagged only because it's a common but unjustified over-engineering temptation; **explicitly rejected** as unnecessary — a properly access-controlled, append-only audit log table achieves the same integrity guarantee at a fraction of the complexity).

### 3.4 Ambiguities / Conflicts

> **AMBIGUITY 1 — Tracking granularity.** The raw doc explicitly leaves open whether the system tracks individual bags, containers, or collection batches.
> **Recommended resolution:** Track at the **batch** level for MVP (a batch = one or more bags/containers registered together under one QR code, same category, same department, same time window). This is the standard real-world unit biomedical waste is actually handled in, and it avoids QR-per-bag operational overhead. Individual-bag granularity is flagged as Future Scope.

> **AMBIGUITY 2 — Live vs. simulated GPS.** The raw doc says live tracking "can be implemented or simulated depending on time/resources." This is a resourcing decision, not an architecture one — the system must be built so a real GPS feed and a simulated one are interchangeable at the data-ingestion boundary.
> **Recommended resolution:** Build a single `GPSPing` ingestion endpoint. For the SIH demo, a scripted simulator posts to that same endpoint. No architectural branching required.

> **AMBIGUITY 3 — Photo capture is mentioned as "may" (optional) at registration but implied as required for verification.**
> **Recommended resolution:** Photo optional at registration, **required** at final treatment-confirmation step (this is the step most exposed to fraud/dispute).

---

## 4. Requirements Traceability

| Req ID | Requirement | Source | Feature | FE Impact | BE Impact | DB Impact | API Impact | Security Impact | Test Impact | Phase |
|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | Chain of custody, 9 stages | §1, §8 raw doc | Waste lifecycle | Status timeline UI | Status state machine | `WasteBatch`, `CustodyEvent` | `/waste-batches/*` | Status transitions must be role-gated | E2E lifecycle test | 7, 10 |
| R-02 | 7 user roles w/ RBAC | §4 raw doc | Auth/RBAC | Role-aware nav/routes | Guards/decorators | `User.role` enum | All endpoints | Core security control | RBAC unit + E2E | 6 |
| R-03 | Waste registration form | §5 raw doc | Registration | Registration form | Create-batch service | `WasteBatch`, `WasteCategory` | `POST /waste-batches` | Only Hospital Staff/Admin | Form validation tests | 7, 9 |
| R-04 | QR generation, unique ID | §6 raw doc | QR system | QR display/print | QR generation service | `QRCode` | `POST /waste-batches/:id/qr` | QR must be unforgeable/opaque | Uniqueness test | 7 |
| R-05 | Mobile QR scanning per role | §7 raw doc | Scan PWA | Camera scan UI, role-filtered actions | Scan-resolution service | — | `POST /scan` | Action allow-list per role | Role-scan matrix test | 8, 9, 10 |
| R-06 | Custody log on every scan | §8 raw doc | Chain of custody | Timeline component | Custody event service | `CustodyEvent` | `GET /waste-batches/:id/history` | Append-only, no edit/delete | Immutability test | 7 |
| R-07 | Transport + GPS + anomaly detection | §9 raw doc | Transport | Live map | GPS ingestion + anomaly job | `TransportAssignment`, `Vehicle`, `GPSPing` | `POST /gps-pings`, `GET /transport/:id` | Location spoofing mitigation (rate-limit pings) | Route-deviation test | 7, 10 |
| R-08 | Category-based configurable SLAs | §10 raw doc | Compliance engine | SLA config UI | Deadline scheduler (BullMQ) | `ComplianceRule` | `GET/PUT /compliance-rules` | Only Super Admin/Gov edits rules | Deadline trigger test | 7, 10 |
| R-09 | Facility arrival verification + geofence | §11 raw doc | Verification | Arrival confirm screen | Geofence check service | `Facility.latitude/longitude/geofence_radius_m` | `POST /waste-batches/:id/verify-arrival` | Reject scans outside geofence | Geofence boundary test | 7 |
| R-10 | 4 alert types, auto-generated | §12 raw doc | Alerts | Alert inbox/badge | Alert engine (BullMQ worker) | `Alert` | `GET /alerts`, `PATCH /alerts/:id` | Alerts visible per role scope | Alert-generation test | 7, 10 |
| R-11 | 3 role dashboards | §13 raw doc | Dashboards | Dashboard pages | Aggregation queries | Read from all core tables | `GET /dashboard/*` | Dashboard data scoped to facility/role | Dashboard access test | 9 |
| R-12 | Registered/authorized facilities only | §2, §4 raw doc | Facility registry | Facility admin UI | Facility approval service | `Facility` | `/facilities/*` | Only approved facilities can transact | Approval-gate test | 6, 7 |

*(This table covers representative core requirements; the same structure extends to every remaining line item in the raw documentation — category management, notification preferences, audit export, etc. — during Phase 0 backlog grooming.)*

---

## 5. Scope Definition

### In Scope (MVP → V1)
- Full 9-stage chain-of-custody lifecycle for waste batches.
- 7-role RBAC across a single unified web app + mobile-optimized scanning PWA.
- QR generation and camera-based scanning.
- GPS-based transport tracking (real-feed-compatible, simulator-driven for demo).
- Geofenced facility verification.
- Configurable, category-based compliance SLAs and automated deadline alerts.
- 4 automated alert/violation types.
- 3 role-scoped dashboards (Hospital, Treatment Facility, Government) + Super Admin console.
- Facility and user registration/approval workflow.
- Full audit trail.

### Out of Scope (explicitly excluded from initial release)
- Public/citizen-facing application or marketing site.
- Payment/billing functionality (nothing in the raw doc implies monetization at this stage).
- Native iOS/Android apps.
- Blockchain-based audit anchoring.
- Multi-tenant white-labeling for other countries' regulatory regimes.

### Future Scope (valuable, deliberately deferred)
- Individual bag/container-level tracking (vs. batch-level).
- Predictive/ML-based violation forecasting.
- SMS/offline-first support for low-connectivity rural facilities.
- Multi-language UI (Hindi + regional languages).
- Public transparency/aggregate-stats portal.
- Native mobile apps with offline QR scan queueing.

---

## 6. Users and Roles

| Role | Purpose | Key Permissions | Facility-scoped? |
|---|---|---|---|
| **Hospital Admin** | Oversee a hospital's waste operations | View all hospital records, manage hospital staff accounts, view hospital compliance reports | Yes — own hospital only |
| **Hospital Staff** | Front-line waste registration | Register waste, select category, generate QR, view own hospital's batches | Yes — own hospital only |
| **Collection Staff** | First handover custody | Scan QR to accept custody, cannot modify hospital records | No (acts across assigned pickups) |
| **Transport Personnel** | Move waste between custody points | Start/update transport status, submit GPS pings | No (acts across assigned routes) |
| **Treatment Facility Staff** | Final verification & disposal | Scan QR on arrival, confirm receipt, confirm treatment/disposal, cannot falsely mark waste as treated without geofence + auth pass | Yes — own facility only |
| **Government/Ministry Authority** | Oversight & compliance monitoring | Read-only across all facilities, view/manage violation tickets, view analytics, configure compliance rules | No — cross-facility (read + rule-config only) |
| **Super Admin** | Platform operation | Full system access: approve facilities, manage all users/roles, system configuration, cannot be impersonated | No — platform-wide |

### 6.1 Permission Matrix

| Action | Hosp. Admin | Hosp. Staff | Collection | Transport | Treatment Staff | Gov. Authority | Super Admin |
|---|---|---|---|---|---|---|---|
| Register waste batch | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✔ |
| Generate QR | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✔ |
| Scan: accept collection custody | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ | ✔ |
| Start/update transport | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ |
| Scan: confirm arrival | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ | ✔ |
| Confirm treatment/disposal | ✘ | ✘ | ✘ | ✘ | ✔ | ✘ | ✔ |
| View own-facility dashboard | ✔ | ✔ (read) | ✘ | ✘ | ✔ | — | ✔ |
| View cross-facility analytics | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |
| Manage violation tickets | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |
| Approve new facility/user | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| Configure compliance SLA rules | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |

RBAC is enforced **twice**: once at the UI (route/component gating, so users never see actions they can't take) and once — authoritatively — at the API layer via NestJS guards. The UI check is a UX convenience, never a security boundary.

---

## 7. User Journeys

### 7.1 Waste Registration → QR Issuance
1. Hospital Staff logs in → lands on Hospital Dashboard.
2. Clicks "Register Waste" → form: category, department, quantity, optional photo.
3. Frontend validates required fields client-side (Zod schema shared with backend).
4. `POST /waste-batches` → backend validates role + facility scope → creates `WasteBatch` (status `REGISTERED`) → creates `CustodyEvent` (type `REGISTERED`).
5. Backend generates QR payload (`POST /waste-batches/:id/qr`) → creates `QRCode` row → batch status → `QR_ASSIGNED`.
6. Frontend renders printable QR label.
7. **Success:** batch appears in hospital's "Pending Collection" list.
8. **Failure (validation error):** inline field errors, no partial batch created (transactional).
9. **Edge case:** duplicate rapid submission → idempotency key on the create endpoint prevents double-registration.
10. **Security:** only Hospital Staff/Admin scoped to *that* hospital can register; enforced via JWT claim → facility_id match.

### 7.2 Collection Handover
1. Collection Staff opens scan PWA, scans QR.
2. `POST /scan` resolves QR → returns only the actions valid for `COLLECTION_STAFF` given current status (`QR_ASSIGNED` → offer "Accept Custody").
3. On confirm: `POST /waste-batches/:id/custody-events` (type `HANDOVER`) — captures GPS via browser geolocation API, timestamp server-side (never trust client clock).
4. Batch status → `COLLECTED`.
5. **Failure:** if batch is in wrong status (already collected) → 409 Conflict, UI shows "Already collected by X at [time]."
6. **Edge case:** GPS permission denied → block the action with a clear explanation (geolocation is required for chain-of-custody integrity, not optional).

### 7.3 Transport
1. Collection Staff or dispatcher assigns a vehicle + driver → `TransportAssignment` created, batch status → `IN_TRANSIT`.
2. Transport Personnel's device periodically posts `GPSPing`s (simulated or real).
3. BullMQ worker evaluates each ping against expected route/geofence corridor and elapsed time.
4. **Anomaly detected** → `Alert` created (`ROUTE_DEVIATION` or, if silence exceeds threshold, `MISSING_SCAN`/stalled-transport alert) → pushed to Government + originating Hospital dashboards in real time (Socket.IO).

### 7.4 Facility Arrival & Verification
1. Treatment Facility Staff scans QR on arrival.
2. Backend checks, in order: user is authorized staff of a **registered** facility → facility is authorized for this waste **category** → scan's GPS point falls inside the facility's **geofence** → elapsed time from collection is within the category's configured limit.
3. Any check failing produces a specific, actionable error (not a generic "verification failed") **and**, where relevant, raises the corresponding `Alert`.
4. On full pass: batch status → `RECEIVED`.
5. Staff confirms treatment (photo required) → status → `TREATED` → auto-transitions to `VERIFIED_CLOSED` once all custody-log integrity checks pass.

### 7.5 Government Oversight
1. Government Authority logs in → Government Dashboard.
2. Views registered facilities, in-transit batches, open violation tickets, compliance analytics, map view.
3. Opens a violation ticket → sees full custody-event timeline for that batch, all timestamps/locations/actors → can mark `INVESTIGATING` / `RESOLVED` with notes.
4. **Security:** read access is cross-facility, but write access is limited to violation-ticket workflow and SLA configuration — Government users cannot alter waste records themselves (preserves evidentiary integrity).

### 7.6 Authentication (all roles)
Login → email/password → backend verifies hash (argon2) → issues short-lived JWT access token + httpOnly refresh cookie → frontend stores role/facility context → route guards apply immediately. Failed logins are rate-limited (5 attempts / 15 min per account) to prevent brute force. Logout invalidates the refresh token server-side.

---

## 8. Functional Architecture

Grouping the full feature inventory (§2.2) into implementation-oriented modules — this list becomes the backend's module boundaries and the frontend's feature-folder boundaries (§11, §15):

`auth` · `users` · `facilities` · `waste-categories` · `waste-batches` · `qr` · `custody-events` · `transport` · `gps` · `compliance-rules` · `alerts` · `dashboards` · `notifications` · `audit-log`

---

## 9. Technology Stack

| Layer | Decision | Reason | Alternatives Considered | Why Selected |
|---|---|---|---|---|
| Frontend framework | **Next.js 14 (App Router) + TypeScript** | SSR for dashboard performance, file-based routing suits role-scoped route groups, one codebase serves both desktop dashboards and the mobile scan PWA | Plain React SPA (Vite), Remix | Next.js's App Router route groups map cleanly onto the 7-role access model; SSR helps first-load performance on hospital-floor devices with mediocre connectivity |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent design-system implementation without hand-rolling a component library | MUI, Chakra | Tailwind + shadcn gives full visual control (needed — this must look like a real government-grade product, not a template) while staying lightweight |
| Server state | **TanStack Query (React Query)** | Purpose-built for API data caching/sync — matches this app's read-heavy dashboards + periodic polling for alerts | SWR, raw fetch + useEffect | Built-in stale-time/polling controls suit near-real-time dashboard needs |
| Global UI state | **Zustand** (minimal) | Only for auth/session context and UI-only state (modals, active scan session) | Redux | Zustand avoids boilerplate for what is a genuinely small amount of true global state |
| Forms/validation | **React Hook Form + Zod** | Zod schemas shared between frontend forms and backend DTO validation | Formik | Shared validation source of truth reduces drift between client and server rules |
| Backend framework | **NestJS + TypeScript** | Opinionated modular architecture maps directly onto §8's module list; built-in DI, guards, pipes cover RBAC and validation needs natively | Express (bare), Fastify (bare) | Nest's module/guard system is precisely what a 7-role RBAC system needs — not reinventing it on bare Express |
| API style | **REST** | Straightforward CRUD + action endpoints (scan, verify-arrival); no need for GraphQL's flexible querying here | GraphQL | Team familiarity + simpler caching/versioning for a permissioned internal system |
| Database | **PostgreSQL** | Relational integrity is essential (custody chains, foreign-key-enforced facility/category relationships); mature, reliable | MongoDB | Chain-of-custody data is inherently relational and demands strong consistency — wrong fit for a document store |
| Geospatial | **PostGIS extension** *(see ADR-05, §10, for the app-layer fallback)* | Native geofence (point-in-radius/polygon) queries and distance calculations at the DB layer | Application-layer Haversine math | PostGIS is the correct long-term tool; Haversine-in-app is the pragmatic MVP fallback if Prisma/PostGIS friction costs too much hackathon time |
| ORM | **Prisma** | Type-safe schema, migrations, matches existing team stack/experience | TypeORM, Drizzle | Prisma's DX and migration tooling are proven in the team's other projects; PostGIS geometry columns handled via `Unsupported("geometry")` + raw SQL where needed |
| Cache / queues | **Redis + BullMQ** | Powers the compliance-deadline scheduler, alert-generation jobs, and notification dispatch | RabbitMQ | Redis+BullMQ is lighter-weight and sufficient at this scale; also usable as a general cache layer |
| Real-time updates | **Socket.IO** | Live dashboard updates (vehicle position, new alerts) without polling everything | Server-Sent Events | Bidirectional channel useful for future features (live chat/dispatch); consistent with the team's other real-time project |
| QR generation/scanning | `qrcode` (server-side generation) + `html5-qrcode` (browser camera scanning) | Well-maintained, no native app dependency | Native scanning SDK | Browser-based scanning keeps this a pure PWA — no app-store distribution needed for MVP |
| Object storage | **S3-compatible storage** (e.g., Cloudflare R2) for verification photos | Cheap, standard, decouples large binary data from the primary DB | Storing photos as DB blobs | Never store binary blobs in the primary relational DB — standard practice |
| Auth | **JWT (short-lived access) + httpOnly refresh cookie**, argon2 password hashing | Stateless access token scales well; refresh cookie mitigates XSS token theft | Session-based (server-stored) | JWT fits a system with mobile PWA clients + API-first backend; refresh-cookie pattern closes the classic JWT-in-localStorage XSS gap |
| Hosting | **Railway** (backend, Postgres, Redis) + **Vercel** (Next.js frontend) | Fast to provision, matches team's existing deployment experience; Vercel is the best-fit host for Next.js specifically | All-on-Railway, AWS from scratch | Splitting frontend to Vercel gets Next.js-specific edge/SSR optimizations for free; backend/DB/queue stay together on Railway for simple networking |

> **ASSUMPTION:** No specific government cloud/data-residency mandate is stated in the raw documentation. For a real (non-hackathon) deployment handling government/hospital data, data residency (India-based hosting) and formal empanelment (e.g., MeitY-approved cloud) would very likely become a hard requirement — flagged under §39 Open Questions.

---

## 10. Architecture Decision Records (ADRs)

**ADR-01 — Modular monolith over microservices**
*Context:* 9 functional modules, small initial team, hackathon timeline.
*Options:* Microservices per module; modular monolith; single unstructured app.
*Selected:* Modular monolith (NestJS modules with enforced boundaries).
*Reason:* Microservices add deployment/networking overhead with zero benefit at this scale; an unstructured app risks the "giant backend file" anti-pattern explicitly warned against in §41 of the master prompt.
*Trade-off:* Scaling individual modules independently isn't free later — acceptable, deferred to Future Scope (§32).

**ADR-02 — Batch-level tracking granularity**
*Context:* AMBIGUITY 1 (§3.4).
*Selected:* Track at batch level.
*Reason:* Matches real-world handling unit; keeps QR-per-item operational burden low.
*Impact:* `WasteBatch` is the central entity; individual item tracking is a schema extension, not a rewrite, if pursued later.

**ADR-03 — REST over GraphQL**
*Reason:* See §9 table. Impact: standard OpenAPI-documentable endpoints (§16).

**ADR-04 — JWT + refresh cookie over server sessions**
*Reason:* See §9 table. Impact: stateless horizontal scaling of the API layer; refresh tokens stored server-side (hashed) for revocation capability.

**ADR-05 — Geofencing implementation: PostGIS with app-layer fallback**
*Context:* Prisma has partial, raw-SQL-dependent PostGIS support.
*Options:* (a) Full PostGIS with `$queryRaw` geometry queries; (b) store lat/lng floats, compute Haversine distance in application code, compare to `geofence_radius_m`.
*Selected:* Start with (b) for MVP — it's fully sufficient for circular geofences around single-point facility coordinates and has zero ORM friction. Migrate to PostGIS (a) only if polygon-shaped (non-circular) geofences or spatial-query-heavy analytics become a real requirement.
*Reason:* Avoids burning hackathon time on Prisma/PostGIS raw-SQL plumbing for a feature (circular radius check) that a 5-line Haversine function solves correctly.
*Trade-off:* Revisit if the product needs irregular-shaped facility boundaries.

**ADR-06 — Idempotency on create/scan endpoints**
*Reason:* Flaky mobile connectivity on hospital/collection floors makes duplicate submissions likely; idempotency keys prevent duplicate batches/custody events.

**ADR-07 — No hard deletes on waste/custody data**
*Reason:* This system's core value is an audit trail. Hard-deleting a `WasteBatch` or `CustodyEvent` would destroy evidentiary integrity. Soft-delete/status-based lifecycle only (see §17, §18).

---

## 11. System Architecture

```
                         ┌───────────────────────────┐
                         │   Government Dashboard     │
                         │   (Next.js, role: GOV)     │
                         └────────────┬──────────────┘
                                      │ HTTPS/JWT
┌──────────────┐   ┌─────────────┐   │   ┌───────────────┐   ┌──────────────────┐
│ Hospital Web  │   │ Collection/ │   │   │ Transport     │   │ Treatment Facility│
│ Portal        │   │ Scan PWA    │   │   │ Update PWA    │   │ Portal            │
└──────┬────────┘   └──────┬──────┘   │   └───────┬───────┘   └────────┬─────────┘
       │                   │          │           │                    │
       └─────────────┬─────┴──────────┴───────────┴────────────────────┘
                      ▼
            ┌───────────────────────┐
            │   NestJS API Layer     │
            │  (REST + Socket.IO)    │
            │ ── auth guard          │
            │ ── RBAC guard          │
            │ ── validation pipes    │
            └───────────┬────────────┘
                         │
     ┌───────────────────┼────────────────────┐
     ▼                   ▼                    ▼
┌──────────┐    ┌─────────────────┐   ┌────────────────┐
│PostgreSQL │    │ Redis + BullMQ  │   │ S3-compatible   │
│ (Prisma)  │    │ (SLA scheduler, │   │ object storage  │
│           │    │  alert engine)  │   │ (photos)        │
└──────────┘    └─────────────────┘   └────────────────┘
```

**Flow:** User → role-appropriate frontend surface → API layer (auth → RBAC → validation → business logic) → PostgreSQL (source of truth) with Redis/BullMQ running asynchronous compliance checks and pushing alerts back out over Socket.IO to subscribed dashboards.

---

## 12. Frontend Architecture

```
frontend/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # login, forgot-password
│   │   ├── (hospital)/             # Hospital Admin + Staff routes
│   │   ├── (collection)/           # Collection Staff scan flow
│   │   ├── (transport)/            # Transport Personnel flow
│   │   ├── (facility)/             # Treatment Facility routes
│   │   ├── (government)/           # Government dashboard
│   │   ├── (admin)/                # Super Admin console
│   │   └── layout.tsx
│   ├── components/                 # shared, role-agnostic UI (buttons, cards, tables…)
│   ├── features/                   # feature-scoped logic, one folder per §8 module
│   │   ├── waste-batches/
│   │   ├── qr/
│   │   ├── custody/
│   │   ├── transport/
│   │   ├── alerts/
│   │   └── dashboards/
│   ├── hooks/                      # shared hooks (useAuth, useGeolocation, useSocket)
│   ├── services/                   # typed API client functions (per module)
│   ├── lib/                        # query client, socket client, constants
│   ├── types/                      # shared TS types (mirrors backend DTOs)
│   └── styles/
```

Each `(role-group)` route folder is protected by a layout-level guard checking the JWT's role claim before rendering — unauthorized roles never even receive the page bundle's data.

---

## 13. UI/UX Design System

**Visual direction:** This is a compliance/regulatory tool used by hospital staff under time pressure and government officers doing formal review — not a consumer app. The design language should read as **clinical, precise, and trustworthy**: generous whitespace, high-contrast status colors, minimal decoration, strong typographic hierarchy for scannable dashboards.

- **Color system:** Neutral base (slate/gray) + a strict status-color vocabulary reused everywhere: green (verified/closed), amber (in-transit/pending), red (violation/alert), blue (informational). Status colors are never used decoratively — only to mean status.
- **Typography:** One clean, highly legible sans-serif (e.g., Inter) — dashboards live or die on scanability of dense tables.
- **Components (shared library):** buttons, inputs, selects, data tables (sortable/filterable), status badges, timeline/stepper (for custody history), modal/dialog, toast notifications, empty states, skeleton loaders, confirmation dialogs for destructive/irreversible actions (e.g., confirming treatment).
- **QR scan screen** is a distinct, mobile-first interaction pattern: full-screen camera viewport, single large primary action button, immediate scan-result feedback (success/error state fills the screen — no small toast that's easy to miss in a busy loading dock).
- **Accessibility & consistency:** every interactive element keyboard-navigable; every async action has loading/error/empty states defined before implementation (see §31 Definition of Done).

---

## 14. Page-by-Page Specification (representative set)

| Page | Route | Roles | Key contents | API calls |
|---|---|---|---|---|
| Login | `/login` | All | Email/password form | `POST /auth/login` |
| Hospital Dashboard | `/hospital` | Hosp. Admin, Hosp. Staff | Waste-by-category chart, pending collection list, in-transit list, delayed/flagged, compliance summary | `GET /dashboard/hospital` |
| Register Waste | `/hospital/waste/new` | Hosp. Staff, Admin | Registration form → QR result screen | `POST /waste-batches`, `POST /waste-batches/:id/qr` |
| Batch Detail | `/waste/:id` | Role-dependent view | Full custody timeline, current status, map of last known location | `GET /waste-batches/:id`, `GET /waste-batches/:id/history` |
| Scan | `/scan` | Collection, Transport, Facility Staff | Full-screen camera, role-filtered action after scan | `POST /scan`, `POST /waste-batches/:id/custody-events` |
| Transport Live Map | `/transport/live` | Transport, Hosp. Admin, Gov. | Map with vehicle positions, route corridor overlay | `GET /transport/active`, Socket.IO `transport:update` |
| Facility Dashboard | `/facility` | Treatment Facility Staff | Incoming waste, pending verification, received, treatment status | `GET /dashboard/facility` |
| Government Dashboard | `/government` | Gov. Authority | Registered facilities, in-transit map, violation tickets, analytics | `GET /dashboard/government` |
| Violation Ticket Detail | `/alerts/:id` | Gov., Super Admin | Full timeline, resolve/investigate actions | `GET /alerts/:id`, `PATCH /alerts/:id` |
| Facility Management | `/admin/facilities` | Super Admin | Approve/reject facility registrations | `GET/PATCH /facilities` |
| User Management | `/admin/users` | Super Admin, Hosp. Admin (own facility) | Create/deactivate users, assign roles | `GET/POST/PATCH /users` |
| Compliance Rules | `/admin/compliance-rules` | Super Admin, Gov. | SLA hours per category/stage | `GET/PUT /compliance-rules` |

Each page follows the standard state contract defined in §31 (loading / empty / error / success), which is not re-listed per row to avoid redundancy.

---

## 15. Backend Architecture

NestJS modules mirror §8's functional module list 1:1. Standard internal layering per module:

```
module/
├── module.module.ts
├── module.controller.ts     # HTTP layer only — no business logic
├── module.service.ts        # business logic
├── repositories/            # Prisma-backed data access, isolated from service logic
├── dto/                     # request/response DTOs (class-validator decorated)
├── guards/                  # module-specific guards if beyond global RBAC guard
└── module.spec.ts
```

Global cross-cutting concerns (auth guard, RBAC guard, validation pipe, exception filter, logging interceptor) live in a `common/` module applied app-wide, so no controller can accidentally skip them.

Background processing (compliance deadline checks, alert generation, notification dispatch) lives in a separate `jobs/` module of BullMQ processors, decoupled from the request/response cycle.

---

## 16. API Specification (core endpoints)

| Method | Route | Purpose | Auth | Roles |
|---|---|---|---|---|
| `POST` | `/auth/login` | Login | Public | All |
| `POST` | `/auth/refresh` | Refresh access token | Refresh cookie | All |
| `POST` | `/auth/logout` | Invalidate session | JWT | All |
| `POST` | `/facilities` | Register a new facility (pending approval) | Public (rate-limited) | — |
| `PATCH` | `/facilities/:id/approve` | Approve/reject facility | JWT | Super Admin |
| `POST` | `/users` | Create user under a facility | JWT | Hosp. Admin, Super Admin |
| `GET` | `/waste-categories` | List categories & default SLAs | JWT | All |
| `POST` | `/waste-batches` | Register a waste batch | JWT | Hosp. Staff, Admin |
| `POST` | `/waste-batches/:id/qr` | Generate QR for a batch | JWT | Hosp. Staff, Admin |
| `POST` | `/scan` | Resolve a scanned QR → valid next actions for caller's role | JWT | Collection, Transport, Facility Staff |
| `POST` | `/waste-batches/:id/custody-events` | Record a custody handover | JWT | Role depends on current status |
| `POST` | `/transport-assignments` | Assign vehicle/driver to a batch | JWT | Collection Staff, Hosp. Admin |
| `POST` | `/gps-pings` | Ingest a location ping | JWT (device token) | Transport Personnel |
| `POST` | `/waste-batches/:id/verify-arrival` | Facility arrival verification | JWT | Treatment Facility Staff |
| `POST` | `/waste-batches/:id/confirm-treatment` | Final treatment confirmation | JWT | Treatment Facility Staff |
| `GET` | `/waste-batches/:id/history` | Full custody timeline | JWT | Scoped to related facilities + Gov/Admin |
| `GET` | `/alerts` | List alerts (filterable) | JWT | Gov., Super Admin, relevant facility |
| `PATCH` | `/alerts/:id` | Update alert status/notes | JWT | Gov., Super Admin |
| `GET` | `/dashboard/hospital` \| `/facility` \| `/government` | Aggregated dashboard data | JWT | Role-matched |
| `GET/PUT` | `/compliance-rules` | View/edit SLA config | JWT | Super Admin, Gov. (read: broader) |

All list endpoints support `page`, `limit`, `sortBy`, `sortDir`, and relevant `filter[...]` query params. All mutating endpoints validate request bodies via Zod-mirrored class-validator DTOs and return RFC-7807-style problem+json error bodies on failure.

---

## 17. Database Architecture

### 17.1 Core Tables

**`facility`**
`id (uuid, pk)` · `name` · `type (enum: HOSPITAL, TREATMENT_FACILITY)` · `registration_number (unique)` · `address` · `latitude (float)` · `longitude (float)` · `geofence_radius_m (int)` · `authorized_category_ids (uuid[])` · `status (enum: PENDING, APPROVED, SUSPENDED)` · `created_at` · `updated_at`

**`user`**
`id (uuid, pk)` · `facility_id (fk → facility, nullable — null for Gov/Super Admin)` · `name` · `email (unique)` · `phone` · `password_hash` · `role (enum: HOSPITAL_ADMIN, HOSPITAL_STAFF, COLLECTION_STAFF, TRANSPORT_PERSONNEL, TREATMENT_FACILITY_STAFF, GOVERNMENT_AUTHORITY, SUPER_ADMIN)` · `status (enum: ACTIVE, DEACTIVATED)` · `created_at` · `updated_at` · `last_login_at`

**`waste_category`**
`id (uuid, pk)` · `code (unique)` · `name` · `description` · `color_code` · `created_at`

**`compliance_rule`**
`id (uuid, pk)` · `waste_category_id (fk)` · `stage (enum: COLLECTION, TRANSPORT, TREATMENT)` · `max_duration_hours (int)` · `created_at` · `updated_at`

**`waste_batch`**
`id (uuid, pk)` · `waste_id (string, unique, human-readable — e.g. BMW-2026-001245)` · `category_id (fk)` · `hospital_id (fk → facility)` · `department` · `quantity (decimal)` · `unit (enum: KG, COUNT)` · `generated_by_user_id (fk → user)` · `generated_at` · `status (enum: REGISTERED, QR_ASSIGNED, COLLECTED, IN_TRANSIT, RECEIVED, TREATED, VERIFIED_CLOSED, VIOLATION)` · `photo_url (nullable)` · `current_custodian_user_id (fk, nullable)` · `current_latitude` · `current_longitude` · `created_at` · `updated_at`

**`qr_code`**
`id (uuid, pk)` · `waste_batch_id (fk, unique)` · `code_value (unique)` · `generated_at` · `generated_by_user_id (fk)`

**`custody_event`** *(append-only — see §18)*
`id (uuid, pk)` · `waste_batch_id (fk)` · `event_type (enum: REGISTERED, QR_ASSIGNED, COLLECTION_ACCEPTED, TRANSPORT_STARTED, TRANSPORT_UPDATED, ARRIVAL_VERIFIED, TREATMENT_CONFIRMED, VERIFIED_CLOSED)` · `from_user_id (fk, nullable)` · `to_user_id (fk, nullable)` · `latitude` · `longitude` · `occurred_at` · `notes (nullable)` · `photo_url (nullable)`

**`vehicle`**
`id (uuid, pk)` · `registration_number (unique)` · `type` · `capacity` · `status (enum: ACTIVE, INACTIVE)`

**`transport_assignment`**
`id (uuid, pk)` · `waste_batch_id (fk)` · `vehicle_id (fk)` · `driver_user_id (fk → user)` · `start_time` · `expected_facility_id (fk → facility)` · `end_time (nullable)` · `status (enum: IN_PROGRESS, ARRIVED, ABANDONED)`

**`gps_ping`**
`id (uuid, pk)` · `transport_assignment_id (fk)` · `latitude` · `longitude` · `recorded_at` — indexed on `(transport_assignment_id, recorded_at)`

**`alert`**
`id (uuid, pk)` · `waste_batch_id (fk, nullable)` · `type (enum: DISPOSAL_DELAY, UNAUTHORIZED_LOCATION, ROUTE_DEVIATION, MISSING_SCAN)` · `severity (enum: LOW, MEDIUM, HIGH)` · `status (enum: OPEN, INVESTIGATING, RESOLVED)` · `created_at` · `resolved_at (nullable)` · `resolved_by_user_id (fk, nullable)` · `notes (nullable)`

**`audit_log`** *(append-only)*
`id (uuid, pk)` · `actor_user_id (fk, nullable)` · `action (string)` · `entity_type (string)` · `entity_id (uuid)` · `metadata (jsonb)` · `ip_address` · `occurred_at`

**`notification`**
`id (uuid, pk)` · `user_id (fk)` · `type` · `message` · `read_at (nullable)` · `created_at`

### 17.2 Relationships
- `facility` 1—N `user`
- `facility` (as hospital) 1—N `waste_batch`
- `waste_category` 1—N `waste_batch`, 1—N `compliance_rule`
- `waste_batch` 1—1 `qr_code`
- `waste_batch` 1—N `custody_event`
- `waste_batch` 1—N `transport_assignment` (practically 0–1 active at a time, but modeled as N for history)
- `transport_assignment` 1—N `gps_ping`
- `waste_batch` 1—N `alert`
- `user` 1—N `notification`

### 17.3 Text ER Diagram
```
facility ──< user
facility ──< waste_batch (as hospital)
waste_category ──< waste_batch
waste_category ──< compliance_rule
waste_batch ──1 qr_code
waste_batch ──< custody_event
waste_batch ──< transport_assignment ──< gps_ping
waste_batch ──< alert
user ──< notification
(all) ──< audit_log  (polymorphic via entity_type/entity_id)
```

Indexes: `waste_batch(status)`, `waste_batch(hospital_id, status)`, `custody_event(waste_batch_id, occurred_at)`, `gps_ping(transport_assignment_id, recorded_at)`, `alert(status, type)` — all chosen to match the dashboard/filter queries in §14.

---

## 18. Database Security and Integrity

- Passwords: **argon2id** hashing, never plaintext, never logged.
- **Append-only tables** (`custody_event`, `audit_log`): no `UPDATE`/`DELETE` grants at the application layer — corrections happen via new compensating records, never edits, preserving evidentiary value.
- **No hard deletes** on `waste_batch`, `facility`, or `user` — status/soft-delete fields only (`DEACTIVATED`, `SUSPENDED`). Real records never disappear from the audit trail.
- Foreign keys enforced with `ON DELETE RESTRICT` on all custody-chain relationships (a facility can't be hard-deleted out from under historical records — deactivate instead).
- All state transitions on `waste_batch.status` happen inside a **database transaction** together with their corresponding `custody_event` insert — the two must never be able to diverge.
- Migrations via Prisma Migrate, version-controlled, never edited after being applied to a shared environment.
- Seed data: waste categories + demo facilities/users for local dev and the SIH demo environment, clearly separated from any production seed path.
- Backups: daily automated PostgreSQL backups (Railway-managed) with a documented restore drill before go-live.

---

## 19. Authentication and Security

- **Authentication:** JWT access token (15 min expiry) + httpOnly, secure, SameSite=strict refresh cookie (7 day expiry, rotated on use, revocable server-side via a `refresh_token` table).
- **Password hashing:** argon2id.
- **Authorization:** NestJS `RolesGuard` reading the JWT's `role` + `facility_id` claims; every controller method decorated with `@Roles(...)`.
- **Input validation:** class-validator DTOs on every endpoint; Zod mirrors on the frontend for the same rules.
- **Output sanitization:** no raw HTML rendering of user-submitted text fields (department names, notes) — React's default escaping plus explicit sanitization on any field ever rendered as rich text.
- **CSRF:** mitigated by SameSite cookie policy + custom header requirement on state-changing requests.
- **XSS:** React's default escaping + strict CSP headers.
- **SQL injection:** Prisma parameterizes all queries; the few raw-SQL geofence queries (if PostGIS path is later adopted) use parameterized `$queryRaw`, never string concatenation.
- **CORS:** allow-list of the deployed frontend origin(s) only.
- **Rate limiting:** login endpoint (5/15min/account), scan/GPS-ping endpoints (per-device throttling to blunt spoofed-location spam).
- **Brute-force protection:** progressive lockout after repeated failed logins.
- **Secrets:** environment variables only, never committed; managed via Railway/Vercel secret stores.
- **HTTPS:** enforced everywhere (Railway/Vercel provide TLS termination by default).
- **Security headers:** standard `helmet` middleware defaults (HSTS, X-Content-Type-Options, etc.).
- **File upload security:** verification photos restricted to image MIME types, size-capped, uploaded via signed URLs directly to object storage (never proxied through the API as a raw blob), scanned for type-spoofing.
- **Audit logs:** every state-changing action writes an `audit_log` row with actor, action, entity, and IP.
- **Geolocation spoofing:** acknowledged as a real risk (see Risk Register §33) — browser geolocation can be faked. Mitigation: cross-check GPS against facility geofence + require the scan to originate from an authenticated, role-matched device session; flag (don't silently trust) any GPS reading with unrealistic accuracy/speed deltas between consecutive pings.

---

## 20. Error-Handling Strategy

A single global NestJS `ExceptionFilter` normalizes all errors into a consistent shape (`{ statusCode, error, message, path, timestamp }`). Categories: `400` validation, `401` unauthenticated, `403` unauthorized (wrong role/facility scope), `404` not found, `409` conflict (e.g., scanning a batch already in a later status), `422` business-rule violation (e.g., outside geofence), `500` unhandled — logged server-side with full context, returned to the client as a generic message only (never leaking stack traces or internals). Frontend maps each error shape to a consistent toast/inline-error pattern, with `409`/`422` given specific, human-readable copy per action screen (these are the errors real users will hit most often, so generic messages there would be a UX failure, not just an edge case).

---

## 21. State Management

- **Server state** (waste batches, alerts, dashboards): TanStack Query — cached, polling on dashboards, invalidated on relevant mutations.
- **Real-time state** (live transport positions, new alerts): Socket.IO events merged into the TanStack Query cache via `queryClient.setQueryData` on receipt.
- **Local UI state** (modal open/closed, form drafts, active scan-camera state): component-local `useState`.
- **Global state** (authenticated user/role/facility context): a small Zustand store hydrated once at login, read everywhere via a `useAuth()` hook.

No Redux, no over-centralization — matches §21's "do not introduce global state management if unnecessary" directive.

---

## 22. Performance Architecture

- Pagination on every list endpoint (default 25/page).
- Indexes matched to actual dashboard/filter queries (§17.3).
- Dashboard aggregation queries pre-computed where possible via scheduled BullMQ jobs (e.g., nightly compliance-rate rollups) rather than recomputed on every page load.
- GPS pings written in batches where feasible; `gps_ping` table pruned/archived beyond a retention window (e.g., raw pings older than 90 days summarized and archived) to keep it from growing unbounded.
- Frontend: Next.js automatic code-splitting per route group; images (verification photos) served via the object storage CDN, not proxied through the API.
- Socket.IO rooms scoped per facility/role so clients only receive events relevant to them — not a global broadcast firehose.

---

## 23. Accessibility

Semantic HTML throughout; all form fields properly labeled; full keyboard navigation on every interactive flow including the scan-action confirmation screens; visible focus states; color is never the sole indicator of status (status badges always pair color with text/icon, critical given the red/amber/green vocabulary in §13); error messages are programmatically associated with their fields (`aria-describedby`); target WCAG 2.1 AA as the baseline standard for a government-facing platform.

---

## 24. Testing Strategy

| Type | Coverage |
|---|---|
| **Unit** | Service-layer business logic per module — especially the compliance-rule evaluator, geofence check, and status state-machine transition guard |
| **Integration** | API ↔ DB ↔ BullMQ job flows (e.g., "batch collected but not received in time → alert row created") |
| **API** | Every endpoint in §16 — happy path, validation failure, unauthorized role, wrong facility scope, conflicting status |
| **E2E** | Full demo scenario from §7 raw doc (registration → QR → collection → transport → verification → closure) and its failure-path variant (missed deadline → violation ticket) |
| **Security** | RBAC matrix fuzz test (every role attempting every endpoint — only the permission-matrix-approved combinations should succeed); auth token expiry/refresh; rate-limit enforcement |
| **Performance** | Dashboard query response time under realistic data volume (seed 10k+ historical batches) |
| **Accessibility** | Automated (axe-core) + manual keyboard-only pass on core flows |
| **Responsive** | Manual + automated viewport testing on the scan PWA specifically (this is the screen most likely used one-handed on a hospital floor) |
| **Regression** | Full E2E suite re-run before every deploy |

Every module's test scenarios explicitly include: happy path, invalid input, missing data, unauthorized access, duplicate submission, and (for scan/transport flows) simulated network failure.

---

## 25. Development Environments

- **Local:** Docker Compose spinning up Postgres + Redis; `.env.local` with dev secrets; seed script populates demo facilities/categories/users.
- **Staging:** Railway staging service + separate Postgres instance, mirrors production config, used for demo rehearsal and QA.
- **Production:** Railway production service, environment variables set via Railway's secret manager, never hard-coded.
- No secrets, API keys, or environment-specific URLs are ever committed — all via `process.env`, validated at boot with a schema (fail fast if a required var is missing).

---

## 26. Git and Project Management

- **Branch strategy:** `main` (always deployable) ← `develop` ← feature branches (`feature/waste-registration`, `fix/geofence-radius-bug`, etc.).
- **Commit convention:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
- **PRs:** required for merges into `develop`/`main`; at minimum a self-review checklist against §31 Definition of Done before requesting review.
- **Release strategy:** tag releases off `main`; staging deploys automatically from `develop`, production deploys manually promoted from a tagged `main` commit.
- **Milestones:** one GitHub milestone per Implementation Phase (§34).

---

## 27. Project Directory Structure

```
biotrack/
├── frontend/                # Next.js app (see §12)
├── backend/                 # NestJS app (see §15)
│   ├── src/
│   │   ├── modules/          # auth, users, facilities, waste-batches, qr, custody-events,
│   │   │                     #   transport, gps, compliance-rules, alerts, dashboards,
│   │   │                     #   notifications, audit-log
│   │   ├── common/            # guards, filters, interceptors, pipes
│   │   ├── jobs/               # BullMQ processors
│   │   └── main.ts
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
├── docs/                    # this plan + ADRs + API docs
├── tests/                   # E2E test suite (Playwright)
├── scripts/                 # seed scripts, GPS simulator for demo
└── infrastructure/          # Docker Compose, deployment configs
```

---

## 28. Documentation Strategy

`README.md` (setup + run instructions) · `docs/architecture.md` (this plan, kept current) · `docs/api.md` (OpenAPI-generated from NestJS decorators) · `docs/database.md` (schema + ERD, regenerated from Prisma schema) · `docs/deployment.md` · `docs/testing.md` · `CONTRIBUTING.md`. Documentation updates are part of each phase's Definition of Done (§31), not a separate afterthought task.

---

## 29. Deployment Architecture

Frontend → **Vercel** (auto-deploy from `main`, preview deployments per PR). Backend + PostgreSQL + Redis → **Railway** (auto-deploy from `main`). Environment variables managed per-platform secret store. Prisma migrations run as a deploy-step (`prisma migrate deploy`), never manually against production. Rollback: Railway/Vercel both support one-click rollback to a prior deployment; database migrations are additive-first (avoid destructive migrations without a reversible plan).

---

## 30. Observability

Application logs structured (JSON) via NestJS's built-in logger, shipped to Railway's log viewer at minimum (upgrade path: a dedicated log aggregator if volume grows). Error monitoring via a hosted error-tracking service (e.g., Sentry) capturing unhandled exceptions with request context (never logging password hashes, tokens, or full JWTs). Health check endpoint (`GET /health`) for uptime monitoring. Never logged: passwords, raw tokens, full request bodies containing PII beyond what's needed for debugging.

---

## 31. Backup and Recovery

Daily automated Postgres backups (Railway-managed), retained 30 days minimum. A documented, periodically-tested restore procedure. Disaster recovery target: restore to last nightly backup within a defined RTO (recommend: 4 hours for a system of this criticality — flagged as **NOT SPECIFIED, requires decision** by the team/stakeholders once this moves beyond hackathon scope).

---

## 32. Scalability

Current expected scale (hackathon → early pilot): a handful of hospitals, low thousands of batches. Likely bottlenecks at real growth: `gps_ping` volume (mitigated by §22's archival strategy) and dashboard aggregation queries (mitigated by scheduled rollups). Database can scale vertically well past pilot scale before any sharding conversation is needed. The modular monolith (ADR-01) can be split module-by-module into services later — the module boundaries were chosen specifically to make that split clean if/when it's justified, without over-engineering for it now.

---

## 33. Risk Register

| Risk | Probability | Impact | Why it matters | Prevention | Mitigation | Detection |
|---|---|---|---|---|---|---|
| GPS/location spoofing | Medium | High | Undermines the entire compliance-verification premise | Cross-check geofence + device/session binding | Flag anomalous ping patterns for manual review | Anomaly-detection job (§19) |
| Scope creep before core flow is solid | High | Medium | §46 of the raw doc's own closing warning — messy collection of features with no coherent workflow | Lock the 3 open decisions (§3.4) before coding starts | Phase-gated development (§34) — no phase starts before the prior one's Definition of Done is met | PR review against phase scope |
| Prisma/PostGIS integration friction burns hackathon time | Medium | Medium | Could stall Phase 7 | ADR-05's app-layer fallback decided up front | Haversine fallback always available | N/A — pre-mitigated by design |
| Duplicate/offline scan submissions | Medium | Medium | Flaky connectivity in loading docks/hospital floors | Idempotency keys (ADR-06) | Client-side optimistic UI with server-side conflict resolution | 409 conflict responses surfaced clearly |
| Role/permission misconfiguration exposes data across facilities | Low | High | Core trust boundary of the whole platform | RBAC enforced server-side on every endpoint, never UI-only | RBAC fuzz test suite (§24) | Automated test gate in CI |
| Government/hospital data residency requirement emerges post-hackathon | Medium | High | Could force a re-platform of hosting | Flagged now as an open question (§39) | Choose easily-migratable hosting (Railway/Vercel are not lock-in-heavy) | Legal/compliance review before real pilot |

---

## 34. Implementation Phases

| Phase | Name | Objective |
|---|---|---|
| 0 | Requirement Analysis | Resolve the raw doc's 3 open questions; finalize this plan |
| 1 | Architecture | Freeze tech stack, schema draft, module boundaries (this document) |
| 2 | Project Foundation | Repo scaffolding, CI skeleton, environment config |
| 3 | Design System | Tailwind/shadcn setup, shared component library, status-color tokens |
| 4 | Database | Prisma schema, migrations, seed data |
| 5 | Backend Foundation | NestJS app skeleton, global guards/filters/pipes, health check |
| 6 | Authentication | Login, JWT/refresh flow, RBAC guard, facility/user approval flow |
| 7 | Core Backend Features | Waste batches, QR, custody events, transport, GPS, compliance rules, alerts |
| 8 | Frontend Foundation | Next.js app shell, route groups per role, auth-gated layouts |
| 9 | Core UI | Registration form, scan PWA, batch detail/timeline, all 3 dashboards |
| 10 | Feature Integration | Wire FE ↔ BE for full lifecycle; Socket.IO live updates; BullMQ alert engine live |
| 11 | Testing | Full test suite per §24 |
| 12 | Security Hardening | Rate limiting, header audit, RBAC fuzz test pass, dependency audit |
| 13 | Performance | Index verification under seeded load, dashboard query tuning |
| 14 | Deployment | Staging + production environments live on Railway/Vercel |
| 15 | Final QA | Full demo-scenario rehearsal (success path + failure/violation path) |
| 16 | Production/Demo Release | SIH submission-ready build tagged and deployed |

---

## 35. Phase Dependencies (detail on the critical early phases)

**Phase 0 — Requirement Analysis**
*Prerequisites:* none. *Tasks:* Decide tracking granularity (recommend: batch — ADR-02), confirm exact waste category list for the demo (recommend 3–4 representative categories, e.g., Sharps, Infectious, Pathological, General Biomedical), lock the exact 10-step demo script. *Completion criteria:* All 3 raw-doc open questions have written answers in this document (done — §3.4, §17.1). *Output:* Finalized scope for Phase 1.

**Phase 4 — Database**
*Prerequisites:* Phase 1 schema (§17) reviewed and approved. *Tasks:* Write `schema.prisma` per §17.1; generate initial migration; write seed script (demo hospitals, treatment facility, categories, compliance rules, test users per role). *Completion criteria:* `prisma migrate dev` runs clean; seed script populates a fully demo-able dataset; ERD doc generated. *Output:* Working local DB any developer can spin up in one command.

**Phase 6 — Authentication**
*Prerequisites:* Phase 4 (User table exists), Phase 5 (Nest app skeleton exists). *Tasks:* Password hashing service, login endpoint, JWT strategy, refresh-token rotation + revocation table, `RolesGuard` + `@Roles()` decorator, facility-scope guard, facility/user approval endpoints, rate-limit on login. *Completion criteria:* All 7 roles can log in and are correctly blocked from each other's protected routes (verified by the RBAC fuzz test from §24, written now even though the full test suite phase is later). *Output:* Auth is production-usable, not a placeholder.

**Phase 7 — Core Backend Features**
*Prerequisites:* Phase 6. *Tasks (granular — see §36).* *Completion criteria:* The entire §7 user-journey set (7.1–7.6) is executable via API calls (e.g., Postman/Thunder Client script) end-to-end, including the failure/violation path. *Output:* A fully functional backend, demo-able via API before any UI exists.

*(Phases 2–3, 5, 8–16 follow the same objective → prerequisites → tasks → completion-criteria → output structure; abbreviated here for length, expanded in `docs/architecture.md` as the team executes each phase per the Phase Execution Protocol in §48 of the master prompt.)*

---

## 36. Detailed Task Breakdown (Phase 7 — Core Backend Features, as the representative granular example)

1. Create `waste-categories` module: entity, seed-backed read endpoints.
2. Create `compliance-rules` module: CRUD, scoped to Super Admin/Gov write access.
3. Create `waste-batches` module: DTO + validation for registration.
4. Implement waste-batch creation service with facility-scope enforcement.
5. Implement idempotency-key handling on batch creation (ADR-06).
6. Create `qr` module: QR payload generation, `QRCode` persistence, uniqueness enforcement.
7. Implement QR-to-batch resolution endpoint (`POST /scan`) returning role-filtered valid next actions.
8. Create `custody-events` module: append-only insert service, batch-status transition guard (state machine).
9. Implement collection-handover endpoint + status transition `QR_ASSIGNED → COLLECTED`.
10. Create `transport` module: `TransportAssignment` + `Vehicle` CRUD.
11. Create `gps` module: `POST /gps-pings` ingestion endpoint with device-session validation.
12. Implement Haversine-based geofence-check utility (ADR-05).
13. Implement BullMQ job: periodic route-deviation/stall check against active `TransportAssignment`s.
14. Implement facility arrival-verification endpoint (`POST /waste-batches/:id/verify-arrival`) running the full check sequence from §7.4.
15. Implement treatment-confirmation endpoint (photo required) + auto-transition to `VERIFIED_CLOSED`.
16. Create `alerts` module: `Alert` entity, creation service callable from any job/service, list/detail/update endpoints.
17. Implement BullMQ job: compliance-deadline scanner (per `ComplianceRule`) generating `DISPOSAL_DELAY` alerts.
18. Implement `MISSING_SCAN` detection (batch stuck in a status past its expected transition window).
19. Wire alert creation to Socket.IO broadcast (room-scoped by facility/role).
20. Write unit tests for the status state-machine guard (illegal transitions rejected).
21. Write integration tests for the full lifecycle + failure-path scenario.
22. Update `docs/api.md` with all new endpoints.

---

## 37. Definition of Done (applies per feature / per phase)

- [ ] UI implemented (where applicable) and responsive
- [ ] Client + server validation both in place and matched
- [ ] API integrated (no mock data remaining)
- [ ] Database integrated, migrations applied
- [ ] Loading, empty, error, and success states all implemented
- [ ] Authorization verified (correct roles allowed, all others rejected — tested, not assumed)
- [ ] Relevant unit + integration tests written and passing
- [ ] Linting and type-checking passing
- [ ] No hard-coded secrets, no leftover mock/fake data paths
- [ ] Relevant documentation updated

---

## 38. Master Development Checklist

**Product:** [ ] All §4 traceable requirements implemented [ ] All §7 user journeys demo-able end to end [ ] All 7 roles functioning per the §6 permission matrix

**Frontend:** [ ] All §14 pages complete [ ] Responsive on mobile (scan PWA specifically tested one-handed) [ ] WCAG 2.1 AA pass [ ] Error/loading/empty states everywhere

**Backend:** [ ] All §16 APIs complete and documented [ ] Validation on every mutating endpoint [ ] Auth + RBAC enforced everywhere [ ] Global error handling [ ] Structured logging

**Database:** [ ] Full §17 schema migrated [ ] All relationships/indexes in place [ ] Append-only integrity enforced on custody/audit tables [ ] Backups configured

**Security:** [ ] Password hashing (argon2id) [ ] Rate limiting on auth + scan/GPS endpoints [ ] Secrets in env vars only [ ] Security headers (helmet) [ ] RBAC fuzz-tested

**Testing:** [ ] Unit [ ] Integration [ ] API [ ] E2E (success + failure demo paths) [ ] Security [ ] Accessibility

**Deployment:** [ ] Production config separated from dev/staging [ ] CI running tests on every PR [ ] HTTPS enforced [ ] Error monitoring live [ ] Backups verified with a restore drill [ ] Rollback path confirmed

---

## 39. Open Questions / Decisions Required

1. **NOT SPECIFIED** — Final list of waste categories for the actual demo (recommend deciding this in Phase 0, before Phase 4 seed data is written).
2. **NOT SPECIFIED** — Whether a real GPS device/driver-app integration is planned post-hackathon, or whether the simulator remains the permanent MVP approach for early pilots.
3. **NOT SPECIFIED** — Data residency / government cloud empanelment requirements for any real (post-hackathon) government pilot — this is a legal/compliance question outside engineering's ability to resolve unilaterally.
4. **NOT SPECIFIED** — Retention policy for closed/verified waste-batch records (how long must the audit trail be kept for regulatory purposes?).
5. **NOT SPECIFIED** — Whether email notifications (beyond in-app) are required for V1 or can wait for Future Scope.

---

## 40. Final Architectural Summary

BioTrack is architected as a single, well-bounded NestJS + Next.js + PostgreSQL modular monolith, chosen deliberately over microservices given the team size and timeline (ADR-01). Every waste batch's identity is anchored in a QR code, its movement is recorded in an append-only custody-event log, and a background rules engine (Redis/BullMQ) continuously checks every active batch against category-specific SLAs and geofence rules, automatically raising one of four defined alert types the moment something breaks the chain. RBAC is enforced authoritatively at the API layer across all 7 roles, never trusting the UI alone. The plan is phased (§34–§36) so that a complete, demo-able backend exists before UI work is layered on top, and every feature carries an explicit Definition of Done (§37) so "the page works" is never mistaken for "the feature is finished." Three genuine open questions remain (§39) and are explicitly flagged rather than silently assumed — resolving them is the team's first task before Phase 1 architecture is frozen for good.