# VyomCare / BioTrack — Developer Setup Guide

> **BioTrack** is a role-based biomedical waste tracking and compliance platform.
> This guide covers the complete local development environment setup.

---

## Architecture

```
                    DEVELOPMENT

             ┌───────────────┐
             │    Next.js    │
             │ localhost:3000│
             └───────┬───────┘
                     │ HTTP API
                     ↓
             ┌───────────────┐
             │    NestJS     │
             │ localhost:3001│
             └───────┬───────┘
                     │
           ┌─────────┴─────────┐
           │                   │
           ↓                   ↓
    ┌────────────┐      ┌────────────┐
    │   Prisma   │      │   BullMQ   │
    └─────┬──────┘      └─────┬──────┘
          │                   │
          ↓                   ↓
    ┌────────────┐      ┌────────────┐
    │   MySQL    │      │   Redis    │
    │   Docker   │      │   Docker   │
    └────────────┘      └────────────┘
```

**Key design decision:**
- **MySQL** = database technology
- **Docker** = development infrastructure choice
- In production, point `DATABASE_URL` and `REDIS_URL` at your production
  services (managed MySQL, cloud Redis, etc.) — no application code changes needed.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | v20+ | Run NestJS + Next.js |
| **npm** | v10+ | Package management |
| **Docker Desktop** | Latest | MySQL + Redis containers |
| **Docker Compose** | v2+ | Container orchestration |

> ⚠️ **Docker Desktop must be running** before starting infrastructure.
> Open Docker Desktop and wait for the engine to show "Running" status.

---

## Quick Start (TL;DR)

```powershell
# 1. Configure root env (Docker containers)
Copy-Item .env.example .env   # already filled with dev values

# 2. Configure backend env
Copy-Item backend\.env.example backend\.env   # already filled with dev values

# 3. Configure frontend env
Copy-Item frontend\.env.example frontend\.env.local   # already filled

# 4. Start Docker infrastructure
docker compose up -d

# 5. Wait for MySQL health check (first start takes ~30s)
docker compose ps

# 6. Generate Prisma client + migrate + seed
cd backend
npm run db:generate
npm run db:migrate
npm run db:seed

# 7. Start backend (new terminal)
cd backend
npm run start:dev

# 8. Start frontend (another new terminal)
cd frontend
npm run dev
```

---

## Step-by-Step Setup

### 1 — Clone and Install Dependencies

```powershell
# In the project root:
cd backend
npm install

cd ..\frontend
npm install
```

### 2 — Environment Configuration

#### Root `.env` (Docker containers)

```powershell
# In the project root (d:\web project\vyomcare\)
Copy-Item .env.example .env
```

Edit `.env` if you want to change ports or credentials:

| Variable | Default | Purpose |
|---|---|---|
| `MYSQL_DATABASE` | `biotrack_dev` | Database name |
| `MYSQL_USER` | `biotrack` | App database user |
| `MYSQL_PASSWORD` | *(set in .env)* | App user password |
| `MYSQL_ROOT_PASSWORD` | *(set in .env)* | MySQL root password |
| `MYSQL_PORT` | `3306` | Host port for MySQL |
| `REDIS_PORT` | `6379` | Host port for Redis |

#### Backend `.env`

```powershell
# In backend/
Copy-Item .env.example .env
```

The backend `.env` contains:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | JWT access token signing |
| `REFRESH_TOKEN_SECRET` | ✅ | Refresh token signing |
| `CORS_ORIGIN` | ✅ | Allowed frontend origin |
| `PORT` | No | Backend port (default: 3001) |
| `NODE_ENV` | No | Environment name |
| `S3_*` | No | Photo upload storage (optional in dev) |

> ⚠️ **For production:** Generate strong secrets with:
> ```
> node -e "require('crypto').randomBytes(64).toString('hex')"
> ```
> Use **different** values for `JWT_SECRET` and `REFRESH_TOKEN_SECRET`.

#### Frontend `.env.local`

```powershell
# In frontend/
Copy-Item .env.example .env.local
```

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Backend API base URL |

> 🔒 **Security:** Only `NEXT_PUBLIC_` variables are exposed to the browser.
> Never add `DATABASE_URL`, `JWT_SECRET`, or Redis credentials to the frontend env.

### 3 — Start Docker Infrastructure

```powershell
# In the project root
docker compose up -d
```

This starts:
- **MySQL 8.0** → exposed on `localhost:3306`
- **Redis 7** → exposed on `localhost:6379`

#### Verify containers are healthy

```powershell
docker compose ps
```

Wait until both show `healthy` status. First MySQL startup takes ~30 seconds.

```powershell
# View logs if something looks wrong
docker compose logs mysql
docker compose logs redis
```

### 4 — Database Setup

Run all Prisma commands from the `backend/` directory:

```powershell
cd backend

# Generate the Prisma client (TypeScript types)
npm run db:generate

# Apply database schema migrations (creates all tables in MySQL)
npm run db:migrate

# Seed demo data (categories, facilities, users, vehicles)
npm run db:seed
```

After seeding, you can log in with these accounts:

| Role | Email | Password |
|---|---|---|
| Hospital Admin | `admin@citygeneral.in` | `BioTrack@2026` |
| Hospital Staff | `staff@citygeneral.in` | `BioTrack@2026` |
| Collection Staff | `collection@biotrack.in` | `BioTrack@2026` |
| Transport Personnel | `transport@biotrack.in` | `BioTrack@2026` |
| Treatment Facility Staff | `facility@greendispose.in` | `BioTrack@2026` |
| Government Authority | `gov@mpcb.gov.in` | `BioTrack@2026` |
| Super Admin | `admin@biotrack.in` | `BioTrack@2026` |

### 5 — Start the Backend

```powershell
cd backend
npm run start:dev
```

Backend runs at: **http://localhost:3001/api**

The backend will fail fast with a clear error if any required environment variable is missing.

### 6 — Start the Frontend

Open a **second terminal**:

```powershell
cd frontend
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## MySQL Notes

### Connection

| Setting | Development value |
|---|---|
| Host | `localhost` |
| Port | `3306` |
| Database | `biotrack_dev` |
| User | `biotrack` |
| Password | *(from backend .env)* |

> **Why `localhost` (not `mysql`)?**
> `localhost` is correct because NestJS runs **on your host machine**.
> The Docker container exposes MySQL's port 3306 to the host.
> If NestJS were itself running in Docker, you'd use the service name `mysql`.

### Inspect database

```powershell
# Open Prisma Studio (visual DB browser)
cd backend
npm run db:studio
```

Or connect with any MySQL client using the credentials above.

---

## Redis Notes

| Setting | Development value |
|---|---|
| Host | `localhost` |
| Port | `6379` |
| URL | `redis://localhost:6379` |

---

## Docker Compose Commands

```powershell
# Start infrastructure
docker compose up -d

# Stop infrastructure (data is preserved)
docker compose down

# View container status and health
docker compose ps

# View logs
docker compose logs            # all services
docker compose logs -f mysql   # MySQL live logs
docker compose logs -f redis   # Redis live logs

# Restart a specific service
docker compose restart mysql

# ⚠️  DESTRUCTIVE: Stop AND delete all data volumes
# Only use this to intentionally reset the development database.
docker compose down -v
```

---

## Prisma Commands

All run from `backend/`:

```powershell
npm run db:generate    # Regenerate Prisma Client after schema changes
npm run db:migrate     # Apply pending migrations to MySQL
npm run db:seed        # Seed demo data (safe to run multiple times — uses upsert)
npm run db:studio      # Open Prisma Studio (visual DB browser)
```

### Resetting the development database

```powershell
# 1. Stop containers and remove volumes (⚠️ destroys all data)
docker compose down -v

# 2. Restart containers
docker compose up -d

# 3. Wait for MySQL health check
docker compose ps

# 4. Re-apply migrations and seed
cd backend
npm run db:migrate
npm run db:seed
```

---

## MySQL Compatibility Notes

The original Prisma schema targeted PostgreSQL. The following changes were made
for MySQL compatibility:

| Change | Reason |
|---|---|
| Provider: `postgresql` → `mysql` | Target correct database |
| `authorizedCategoryIds String[]` → `Json` | MySQL has no native array type. Stored as JSON array. Application reads/writes it as a string[]. |

No other schema changes were required. All other types used (`String`, `Int`, `Float`,
`Boolean`, `DateTime`, `Decimal`, `Json`, enums, UUIDs via `uuid()` default) are
fully compatible with MySQL.

---

## Security Summary

| Concern | Resolution |
|---|---|
| `.env` files tracked in git | Root `.gitignore` + backend `.gitignore` block all `.env` files |
| `.env.example` templates needed | Both gitignore files use `!.env.example` negation |
| Wildcard CORS on Socket.IO | Fixed — now reads `CORS_ORIGIN` env var |
| Fallback JWT secret in code | Removed — `ConfigService.getOrThrow` enforces required var |
| Missing env var at startup | `validateEnvironment()` in `main.ts` exits with clear error message |

---

## Production Deployment & Operations

VyomCare / BioTrack includes a complete, production-grade containerization architecture with Nginx reverse proxy, multi-stage Docker builds, persistent storage volumes, automated migrations, and database backups.

### Architecture Overview

```text
               Client (HTTPS :443 / HTTP :80)
                             │
                      Nginx Reverse Proxy
                     ┌───────┴───────┐
              / (Next.js)      /api/ & /socket.io/ (NestJS)
                     │               │
                     │         ┌─────┴─────┐
                     │         │           │
                     │       MySQL       Redis
```

### Quick Production Deployment

```bash
# 1. Prepare production environment
cp .env.production.example .env.production
nano .env.production

# 2. Build and launch production stack
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 3. Verify container health
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# 4. Check API status
curl -i http://localhost/healthz
```

For comprehensive instructions on host hardening, Let's Encrypt TLS setup, automated nightly backups, disaster recovery, observability, and rollbacks, see the complete runbook:

👉 **[DEPLOYMENT.md](file:///d:/web%20project/vyomcare/DEPLOYMENT.md)**

