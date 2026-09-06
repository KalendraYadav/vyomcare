# VyomCare / BioTrack — Authoritative Design Document (`design.md`)

**Status:** Updated from direct repository inspection (`github.com/KalendraYadav/vyomcare`, branch `main`, 3 commits as of inspection).
**Supersedes:** Prior frontend-only `design.md` (retained below as the UI/UX layer — nothing in it is contradicted by the repo and it remains authoritative for frontend behavior).
**Adds:** Current-state confirmation + a zero-cost hackathon deployment target, kept clearly separate from the future commercial production target.

**Labels used throughout:** `EXISTING` `VERIFIED` `HACKATHON` `TEMPORARY` `FUTURE PRODUCTION` `REQUIRES INSPECTION` `DO NOT CHANGE`

---

## 1–3. Product Purpose, Scope, Current Implementation Status

`EXISTING` `VERIFIED`

BioTrack/VyomCare is a role-based biomedical waste chain-of-custody and CPCB-compliance platform (hospital → collection → transport → CBWTF treatment, with government oversight). This is **not a greenfield project** — it is an implemented, working full-stack application. Confirmed directly from the repository:

- `design.md` (955 lines) — the full frontend UI/UX specification, present at repo root and unchanged from the version already reviewed. It documents 7 roles, 18 routes, full API contract mapping, and Socket.IO real-time behavior as `[VERIFIED]`.
- `implementationplan.md` (818 lines) — the original architecture/planning document. **Important:** this document specifies **PostgreSQL**, **Railway (backend) + Vercel (frontend)** hosting, and **S3-compatible object storage**. None of these three match the actual implementation (see §34 Discrepancies). Per the source-of-truth hierarchy already encoded in `design.md` §2, this plan document (Level 4) is superseded by the actual verified backend and by `design.md` itself wherever they conflict.
- `future.txt` — a working scratch/notes file. Its first line reads: **"PHASE 10 IMPLEMENTATION COMPLETE. EXTERNAL PRODUCTION CONFIGURATION REMAINS."** This is the only phase marker actually present in the repository. It also contains real dev MySQL Workbench connection details and 34 example inspection queries against the live schema (`user`, `facility`, `waste_batch`, `waste_category`, `custody_event`, `alert`, `audit_log`, `compliance_rule`, `gps_ping`, `notification`, `qr_code`, `refresh_token`, `transport_assignment`, `vehicle`) — this independently confirms the table list you supplied.
- `README.md` — a complete, accurate developer setup guide consistent with the compose files (see §11–13).
- `DEPLOYMENT.md` (292 lines) — a real, detailed production runbook, consistent with `docker-compose.prod.yml`.

**Phase 11–15 reports:** `REQUIRES INSPECTION` — **not found anywhere in the repository.** The top-level file listing (`.github/workflows`, `backend/`, `frontend/`, `nginx/`, `scripts/`, `.env.example`, `.env.production.example`, `.gitignore`, `DEPLOYMENT.md`, `README.md`, `design.md`, `docker-compose.prod.yml`, `docker-compose.yml`, `future.txt`, `implementationplan.md`) contains no Phase 11/12/13/14/15 document. Only Phase 10 is referenced, and only as one line in `future.txt`. Treat the detailed Phase 11–15 claims (refresh-token SHA-256 hashing, Redis-backed lockout, hardcoded-password removal, etc.) as **unverified prior context** until the actual backend source (`backend/src/...`) is inspected — I could not reach it this session (see §9 for why). They may well be true; they are just not independently confirmed from the repo in this pass.

---

## 4. Architecture (as verified)

`EXISTING` `VERIFIED`

```
DEVELOPMENT (confirmed via README.md + docker-compose.yml)

  Next.js (HOST, npm run dev)  :3000
        |  HTTP API
  NestJS (HOST, npm run start:dev)  :3001
        |                    |
     Prisma               BullMQ
        |                    |
  MySQL 8.0 (Docker)    Redis 7 (Docker)
     :3306                 :6379
```

```
PRODUCTION (confirmed via docker-compose.prod.yml + DEPLOYMENT.md)

  Internet
     |  :80 / :443
  Nginx (Docker container, reverse proxy + TLS termination)
     |-- /            -> frontend container (Next.js, :3000, internal)
     `-- /api, /notifications -> backend container (NestJS, :3001, internal)
                              |
                    +---------+---------+
                 MySQL 8.0            Redis 7
              (Docker, internal)   (Docker, internal)
```

**Key confirmed fact:** in **development**, only MySQL and Redis run in Docker; NestJS and Next.js run directly on the host (README's "Why localhost (not mysql)?" note is explicit about this). In **production**, `docker-compose.prod.yml` containerizes **all five services** — MySQL, Redis, backend, frontend, and Nginx — on one isolated bridge network (`biotrack_prod_network`), with MySQL/Redis never exposing ports to the host at all (no `ports:`, only implicit internal access). This is a materially different topology from dev, and it is the one that matters for the hackathon (§14, §16).

---

## 5. Technology Stack

`EXISTING` `VERIFIED` (from `docker-compose.prod.yml`, `README.md`, `design.md` §14)

| Layer | Technology | Source |
|---|---|---|
| Backend | NestJS | compose, README |
| ORM | Prisma | compose (`migrate deploy` in prod), README |
| Database | **MySQL 8.0** (not the Postgres in `implementationplan.md` — see §34) | compose, README, `future.txt` |
| Cache/Queue | Redis 7 + BullMQ | compose, `design.md` §4 |
| Real-time | Socket.IO, namespace `/notifications` | `design.md` §17, DEPLOYMENT.md WebSocket proxy notes |
| Frontend | Next.js 16, React 19 | `design.md` §14 package list |
| Containerization | Docker + Docker Compose (two files: dev infra-only, prod full-stack) | `docker-compose.yml`, `docker-compose.prod.yml` |
| Reverse proxy | Nginx 1.27-alpine (prod only) | `docker-compose.prod.yml` |
| CI | `.github/workflows/` exists (contents `REQUIRES INSPECTION` — directory listing seen, files not read this session) | repo root listing |

`DO NOT CHANGE`: MySQL as the database technology, Prisma as ORM, NestJS/Next.js as the app frameworks, Redis/BullMQ for background jobs, Socket.IO for real-time. Nothing found in this inspection suggests any reason to touch these.

---

## 6–8. Roles, Authorization, Facility Isolation

`EXISTING` `VERIFIED` — unchanged from `design.md` §7–§8. Seven roles (`HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `COLLECTION_STAFF`, `TRANSPORT_PERSONNEL`, `TREATMENT_FACILITY_STAFF`, `GOVERNMENT_AUTHORITY`, `SUPER_ADMIN`), full permission matrix, and facility-scoping rules (`user.facilityId`) are documented in the existing `design.md` and are **not contradicted** by anything found in this inspection. `implementationplan.md` §6 independently corroborates the same 7 roles and matrix — this is agreement, not conflict.

Actual guard/decorator implementation in backend source: `REQUIRES INSPECTION` (not reached this session).

---

## 9. What Could Not Be Directly Inspected This Session

`REQUIRES INSPECTION`

GitHub's `robots.txt` blocks automated access to directory/tree pages (`/tree/...`) from this tool, and this repository (0 stars, 3 commits, freshly created) is not indexed deeply enough by general web search to locate exact file paths inside subdirectories. Individual files could only be reached when their exact path was already known from a page already fetched (e.g., top-level files linked from the repo root listing). As a result, the following are **not yet confirmed from source** and must be inspected directly (e.g., by uploading the repo/zip here, or by running this same request inside Claude Code against the real filesystem) before being treated as fact in future revisions:

- `backend/prisma/schema.prisma` and `backend/prisma/migrations/` — exact field-level schema, enum values, index definitions.
- The backend's actual **upload/file/photo storage implementation** — which service handles `photoUrl` on `waste_batch` and `custody_event`, whether it writes to local disk, and what happens to those files on container restart. **Strong circumstantial evidence it is NOT S3**: `.env.production.example` (fully read, §12) has zero S3/object-storage variables, and the README's env-var table lists `S3_*` as "No / optional in dev" for the backend `.env`. This suggests local filesystem storage is the actual live path, with S3 as a planned-but-unused optional. **This is an inference, not a confirmed fact — treat as REQUIRES INSPECTION until the actual upload/storage module is read.**
- Frontend upload-handling code (how a captured photo file reaches the backend).
- `nginx/nginx.conf` exact contents (DEPLOYMENT.md quotes required directives — `proxy_set_header Upgrade`, `proxy_read_timeout 86400s`, a `/healthz` location, a `Permissions-Policy` header for camera/geolocation — but the actual file wasn't read).
- `backend/Dockerfile`, `frontend/Dockerfile` — confirmed to exist (referenced by `docker-compose.prod.yml` build context) and confirmed to run as non-root (`nextjs:nodejs`, `nestjs:nodejs` per DEPLOYMENT.md prose), but full contents not read.
- Docker entrypoint script(s) — confirmed to exist and confirmed behavior (`npx prisma migrate deploy` runs automatically on backend container start, per DEPLOYMENT.md §7), but the script file itself not read.
- `scripts/backup-db.sh`, `scripts/restore-db.sh` — confirmed to exist and confirmed behavior (`mysqldump --single-transaction`, 14-day retention, per DEPLOYMENT.md §8), contents not read.
- `backend/.env.example`, `frontend/.env.example` — the root `.env.example` and root `.env.production.example` were read in full (§11–§12); the per-package example files were not reached, though README quotes their variable names.
- `.github/workflows/` — directory confirmed present; workflow file contents not read.
- Phase 11–15 reports — see §3; not found as files in the repo at all.

None of this blocks writing an honest hackathon design below — it only means a few specific claims about file-storage mechanics and CI stay conditional until confirmed.

---

## 10. Verified Database & Table List

`EXISTING` `VERIFIED` (independently confirmed via `future.txt`'s working MySQL Workbench queries, in addition to your supplied list)

`user`, `facility`, `waste_batch`, `waste_category`, `custody_event`, `alert`, `audit_log`, `compliance_rule`, `gps_ping`, `notification`, `qr_code`, `refresh_token`, `transport_assignment`, `vehicle`, `_prisma_migrations`.

Dev connection (confirmed, `future.txt`): host `127.0.0.1`, port `3306`, user `biotrack`, database `biotrack_dev`. (`future.txt` additionally reveals a dev password, `BioTrack_Dev_2026!` — this is a **development-only** credential already committed in a plaintext notes file. `DO NOT CHANGE` in the sense of not touching schema/data, but flagging: this password should not be reused anywhere near production, and ideally shouldn't remain in a tracked file long-term — that's a repo hygiene note, not something to act on unprompted.)

MySQL persistence mechanism: `mysql_data` (dev) / `mysql_prod_data` (prod) are named Docker volumes (`driver: local`), confirmed line-by-line in both compose files. Data survives `docker compose down` / container restarts; only `docker compose down -v` destroys it (explicitly commented as destructive in both files).

---

## 11. Development Environment

`EXISTING` `VERIFIED`

Confirmed from `README.md` + `docker-compose.yml`:

- `docker-compose.yml` starts **only** `mysql` (8.0, port 3306) and `redis` (7-alpine, port 6379) — explicitly commented as "infrastructure services only."
- Backend (`cd backend && npm run start:dev`) and frontend (`cd frontend && npm run dev`) run **on the host**, not in Docker, in dev.
- Root `.env` configures the Docker containers (`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PORT`, `REDIS_PORT`).
- `backend/.env` requires `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `CORS_ORIGIN`; optional `PORT`, `NODE_ENV`, `S3_*`. Backend fails fast on missing required vars (`validateEnvironment()` in `main.ts`, per README).
- `frontend/.env.local` requires `NEXT_PUBLIC_API_URL=http://localhost:3001/api`.
- Seed data exists (`npm run db:seed`, upsert-safe, "safe to run multiple times") producing the 7 demo accounts at `BioTrack@2026`.

`DO NOT CHANGE`: this dev flow works today; nothing about the hackathon requires touching it.

---

## 12. Production Infrastructure (as it exists in the repo today)

`EXISTING` `VERIFIED` — **not currently deployed live** (per your own status: Phase 15 stopped before real cloud provisioning).

Fully read `docker-compose.prod.yml`, `.env.production.example`, and `DEPLOYMENT.md`. Confirmed:

- **All five services containerized**: `mysql`, `redis`, `backend` (build from `./backend/Dockerfile`), `frontend` (build from `./frontend/Dockerfile`), `nginx` (image `nginx:1.27-alpine`, mounts `./nginx/nginx.conf`).
- Only `nginx` publishes host ports (`${HTTP_PORT:-80}`, `${HTTPS_PORT:-443}`); MySQL and Redis have **no** `ports:` mapping in prod — internal-network-only, matching your stated security requirement.
- Backend container env is fully wired from `.env.production`: `DATABASE_URL` built from `MYSQL_USER`/`MYSQL_PASSWORD`/`MYSQL_DATABASE` against host `mysql` (service name, not `localhost` — correct for container-to-container), `REDIS_URL=redis://redis:6379`, `JWT_SECRET`, `JWT_EXPIRY`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRY`, `CORS_ORIGIN`.
- Frontend build args: `NEXT_PUBLIC_API_URL` (default `/api`), `NEXT_PUBLIC_SOCKET_URL` (default `/notifications`) — i.e., **relative paths**, meant to be served from the same origin behind Nginx. This detail matters directly for the hackathon (§16).
- Healthchecks defined for every container; `depends_on: condition: service_healthy` chains mysql/redis -> backend -> frontend -> nginx.
- `.env.production.example` has **no S3 variables at all** — reinforcing the §9 inference that object storage is not a live production dependency today.
- DEPLOYMENT.md confirms: Let's Encrypt/Certbot flow for a real domain, `mysqldump --single-transaction` nightly backup via `scripts/backup-db.sh`, restore via `scripts/restore-db.sh`, `prisma migrate deploy` (never `db push` / `migrate reset`) run automatically by the backend entrypoint, rollback via `git checkout <commit>` + rebuild, and — directly relevant to your HTTPS/camera question — an explicit troubleshooting entry: *"Browsers require HTTPS (or localhost) for `navigator.mediaDevices.getUserMedia` and `navigator.geolocation`. Ensure Nginx serves `Permissions-Policy: camera=(self), geolocation=(self)`."*

**This is not currently live** (no VPS/domain/TLS provisioned, matching your Phase 15 status) but the artifact is real, complete, and ready to run the moment real infrastructure exists.

`DO NOT CHANGE`: none of this needs to be touched for the hackathon. It should be left completely intact as the future production path.

---

## 13. File/Photo Storage Model

`REQUIRES INSPECTION` (see §9) with one solid lead: no S3 configuration exists anywhere in the repo's env templates (dev or prod). The likeliest actual mechanism is local filesystem storage on the backend container/host, referenced by path/URL in `waste_batch.photoUrl` / `custody_event.photoUrl` (both columns are confirmed to exist per `design.md` API contracts). **Before building the hackathon storage plan, the actual upload controller/service (likely `backend/src/**/upload/` or a Multer config in the waste-batches/custody-events modules) needs to be read.** Until then:

- If local disk: the production Dockerfile/compose would need a named volume or bind mount for the upload directory to survive container restarts — **checked**: `docker-compose.prod.yml` currently defines only `mysql_prod_data`, `redis_prod_data`, and `nginx_logs` as volumes. There is **no** uploads volume for the backend container today. This is a real gap if local-disk storage is confirmed: a `FUTURE CHANGE` candidate, pending inspection — either add a bind-mounted uploads volume to `docker-compose.prod.yml`, or confirm files are actually going elsewhere.
- If S3/R2 (as originally planned in `implementationplan.md` but seemingly not wired into current env templates): would need real credentials, which is out of scope for a zero-cost hackathon.

For the hackathon specifically: if local-disk storage is confirmed, it works fine on a laptop server as long as the same bind-mount/volume pattern used for MySQL is applied to the upload directory too.

---

## 14. Multi-Device / Multi-Hospital Hackathon Requirements

`HACKATHON`

Nothing here changes application logic — it's a hosting decision. Requirements as stated: laptop as centralized server, phones/laptops on LAN or via tunnel, all devices hitting one backend and one MySQL instance, 10–15 simulated facilities via real seed data (not fake frontend data), full lifecycle exercised through `VERIFIED_CLOSED` for the demo.

---

## 15. MySQL Persistence Model (Hackathon)

`HACKATHON`

Unchanged mechanism from §10 — Docker named volume. On the laptop, `mysql_prod_data` (if using the prod compose) persists across `docker compose down` and laptop reboots, as long as `docker compose down -v` is never run. This requires no new design; it's the same volume mechanism already built.

---

## 16. Hackathon Deployment Architecture — Recommended Approach

`HACKATHON` `DESIGN DECISION`

**Key finding that changes the plan for the better:** `docker-compose.prod.yml`, as it already exists in the repository, **is already the "Laptop -> Docker -> Next.js -> NestJS -> MySQL -> Redis" topology the hackathon needs** — it just also happens to be labeled "production." The only things separating "run this on a laptop for a hackathon" from "run this on a real VPS for production" are: (a) the domain name in `CORS_ORIGIN` / TLS cert, and (b) whether `nginx.conf`'s HTTPS server block is active.

Two realistic options, in order of preference:

**Option A (recommended) — Reuse `docker-compose.prod.yml` as-is, with hackathon-specific env values.**
Do not create a third compose file. Create a separate env file, e.g. `.env.hackathon` (copied from `.env.production.example`), with:
- `CORS_ORIGIN` set to the tunnel's or LAN's actual origin (see §18) instead of a real domain.
- Real but hackathon-scoped MySQL/JWT/refresh secrets (still generated with `openssl rand`, per DEPLOYMENT.md §4.2 — "hackathon" is not a reason to weaken these, per §25).
- `NEXT_PUBLIC_API_URL=/api`, `NEXT_PUBLIC_SOCKET_URL=/notifications` (same relative-path pattern already in the file — this is exactly right for a laptop server too, since Nginx serves everything from one origin regardless of what that origin's hostname is).
Then run exactly the documented command with a different env file:
```
docker compose --env-file .env.hackathon -f docker-compose.prod.yml up -d --build
```
This is the lowest-risk path: it reuses a file that already works, changes zero application code, and keeps `docker-compose.prod.yml` itself completely untouched (`DO NOT CHANGE`) — satisfying the instruction not to overwrite production configuration for hackathon purposes.

**Option B — A genuinely separate `docker-compose.hackathon.yml`.**
Only justified if, after inspecting the actual Dockerfiles/entrypoint (§9), something in the production image build assumes a real domain or a resource profile unsuitable for a laptop (e.g., a build step that fails without a real TLS cert path). **This cannot be confirmed without reading those files — flagged as a decision to make after §9's inspection gaps are closed, not before.**

Either way: `nginx/nginx.conf`'s TLS/Certbot-specific server block (mentioned in DEPLOYMENT.md §5) would need a hackathon-mode toggle — either commented out for LAN-only HTTP demos, or left as-is if a tunnel provider supplies its own TLS termination in front of Nginx (see §18, this is the cleaner option and avoids touching `nginx.conf` at all).

---

## 17. Multi-Hospital Demonstration Model

`HACKATHON`

No architecture change needed — this is a seed-data question, not an infrastructure question. The repo already has a working, upsert-safe seed script (`npm run db:seed`, confirmed in README, "safe to run multiple times"). Extending it to 10–15 facilities is a data task, not a design task, and per instruction should be proposed and reviewed separately rather than silently modified. `REQUIRES INSPECTION`: the actual seed script (`backend/prisma/seed.ts` or similar — exact path not confirmed this session) needs to be read before proposing specific additional seed records, so the additions match its existing structure/conventions exactly.

---

## 18. HTTPS / QR Camera Requirements

`HACKATHON` `VERIFIED` (requirement itself, per DEPLOYMENT.md §11 Issue 3, quoted in full in §12 above)

This is a browser platform requirement, not a BioTrack-specific one: `getUserMedia` (camera) and `navigator.geolocation` require a secure context — HTTPS, or the special-cased `localhost`. A phone hitting the laptop's **LAN IP** over plain HTTP is neither, so the QR scanner and background GPS features will not work over LAN-HTTP from a phone, exactly as observed in prior testing.

Two zero-cost options; both are `HACKATHON` / `TEMPORARY` and neither should replace the DEPLOYMENT.md Certbot/Let's-Encrypt path once a real domain exists:

- **Tunnel with built-in TLS** (a TLS-terminating tunnel pointed at the laptop's Nginx port 80): the tunnel provider terminates HTTPS at its edge and forwards plain HTTP to the laptop, so `nginx.conf`'s existing HTTP-only behavior needs no changes at all — the browser sees HTTPS at the tunnel's public URL. `CORS_ORIGIN` in `.env.hackathon` must then be set to that tunnel URL. No specific provider is assumed here; whichever is chosen, the requirement is simply "terminates TLS in front of the existing Nginx container."
- **LAN-only demo**: skip HTTPS entirely and demo only the flows that don't need camera/geolocation over the network (e.g., anything driven from the laptop's own browser, which satisfies the `localhost` exception) — acceptable as a fallback, not as the primary hackathon demo, since QR scanning from phones is central to the product.

---

## 19. Docker Strategy (Hackathon)

`HACKATHON`

Reuse `docker-compose.prod.yml` per §16 Option A. No new Dockerfiles needed unless §9's inspection reveals a hard-coded production assumption inside them.

---

## 20. Nginx Architecture (Hackathon)

`HACKATHON` `REQUIRES INSPECTION` (exact file contents, per §9)

Expected to need zero changes if a TLS-terminating tunnel is used (§18, first option) — Nginx keeps doing exactly what it already does (serve `/` to the frontend container, proxy `/api` and `/socket.io/`/`/notifications` to the backend, per DEPLOYMENT.md's WebSocket-upgrade notes). Only needs inspection/edits if going the LAN-HTTPS route with a self-signed cert, which is not recommended given a zero-cost tunnel is simpler and avoids browser cert-warning friction on demo day.

---

## 21. Backup Architecture (Hackathon)

`HACKATHON`

`scripts/backup-db.sh` / `scripts/restore-db.sh` already exist and already work against any MySQL instance reachable at the configured `DATABASE_URL` — they don't care whether that MySQL is on a laptop or a VPS. Running `./scripts/backup-db.sh` once before a hackathon demo (as a safety net, not a requirement) costs nothing and uses existing, unmodified tooling.

---

## 22–23. Future Cloud Production Architecture / Environment Separation

`FUTURE PRODUCTION` `DO NOT CHANGE`

Everything in §12 stands, untouched, as the target for when a real VPS + domain exist. The only actual difference between "hackathon" and "future production" in this design is **which env file and which public entry point (tunnel vs. real domain + Certbot) sit in front of the same, unmodified `docker-compose.prod.yml`.** This is a deliberate design choice: it means there is no "hackathon architecture" to maintain as a separate thing long-term — the migration path (§26) is close to a no-op.

---

## 24. Deployment Strategy Summary

`HACKATHON` + `FUTURE PRODUCTION` side by side

| | Hackathon (laptop) | Future Production (VPS) |
|---|---|---|
| Compose file | `docker-compose.prod.yml` (unmodified) | `docker-compose.prod.yml` (unmodified) |
| Env file | `.env.hackathon` (new, hackathon secrets) | `.env.production` (per DEPLOYMENT.md §4) |
| Public entry | Zero-cost TLS tunnel -> laptop Nginx :80 | Real domain -> Certbot/Let's Encrypt -> Nginx :443 |
| MySQL/Redis | Same containers, same volumes, on laptop disk | Same containers, same volumes, on VPS disk |
| Cost | Rs. 0 | Hosting + domain cost |
| Uptime | Only while laptop is on and connected | Persistent |

---

## 25. Security Requirements (Hackathon)

`DO NOT CHANGE`

Nothing in this design weakens security for the hackathon. Real MySQL, real Redis, real JWT/refresh flow, real RBAC, real facility isolation, real audit logging — all identical to production, just pointed at a laptop instead of a VPS. Hackathon secrets must still be generated with `openssl rand` (per DEPLOYMENT.md §4.2), never reused from `future.txt`'s dev credentials, and never committed.

---

## 26. Hackathon → Cloud Migration Path

`FUTURE PRODUCTION`

Because §16 Option A reuses the exact production compose file, migrating off the laptop later is: provision a VPS, `git clone`, generate real production secrets into `.env.production`, point DNS at it, run Certbot, run the exact same `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build` command already documented in DEPLOYMENT.md §6, then restore the hackathon's `backup-db.sh` dump if that demo data should carry forward (optional — most likely it should not, and a clean production seed should run instead).

---

## 27. Known Limitations

`HACKATHON`

- Laptop must stay powered on and network-connected for the entire hackathon window; any shutdown takes frontend, backend, MySQL, and Redis down simultaneously.
- If a tunnel provider is used, its free-tier URL may change between restarts unless a fixed/reserved subdomain is configured — check the chosen provider's current free-tier behavior before demo day (time-sensitive and provider-specific, hence not committed to a specific choice here).
- Laptop hardware (Wi-Fi radio, battery, thermals under sustained Docker load with 4-5 containers) becomes a demo-day operational risk that a VPS doesn't have.

## 28. Remaining Work

- Confirm §9's inspection gaps (schema.prisma, upload storage, nginx.conf, Dockerfiles, entrypoint, backup scripts, backend/.env.example, frontend/.env.example, `.github/workflows`) — needed before locking exact hackathon env values and before proposing specific seed-data additions.
- Choose a specific zero-cost tunnel provider (§18) once §9 confirms nginx.conf doesn't already assume a fixed domain.
- Decide, after confirming file storage (§13), whether `docker-compose.prod.yml` needs an added uploads volume — and if so, propose that as a scoped, reviewed change rather than making it silently.

## 29. Items Requiring Inspection (consolidated from above)

See §9 and §13 in full — repeated here for scan-ability: `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, upload/storage service code (backend + frontend), `nginx/nginx.conf`, `backend/Dockerfile`, `frontend/Dockerfile`, Docker entrypoint script(s), `scripts/backup-db.sh`, `scripts/restore-db.sh`, `backend/.env.example`, `frontend/.env.example`, `.github/workflows/*`, any Phase 11-15 report files (currently believed not to exist in-repo).

## 30. Explicit DO NOT CHANGE Rules

- Do not replace MySQL, Prisma, NestJS, Next.js, Redis, BullMQ, or Socket.IO.
- Do not modify `docker-compose.prod.yml`'s service definitions for hackathon purposes — use a separate env file instead (§16 Option A).
- Do not modify `backend/prisma/schema.prisma` or run any migration outside the documented `prisma migrate deploy` flow.
- Do not touch `scripts/backup-db.sh` / `scripts/restore-db.sh` logic — only invoke them.
- Do not weaken JWT/refresh/RBAC/facility-isolation logic for the hackathon.
- Do not fabricate frontend-only demo data — extend the real seed script instead, and only after review.

---

## 31–36. Cross-references

Sections 5-24 of the original frontend `design.md` (roles, routes, design tokens, API contracts, Socket.IO events, page specs, forms, UI states, security UX, performance, testing checklist) remain fully in force and are not duplicated here — this document is additive, covering current-state confirmation and hackathon deployment strategy on top of that existing frontend contract.