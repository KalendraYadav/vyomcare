# Phase 13 — Production Deployment Runbook & Operational Guide
**BioTrack / VyomCare Biomedical Waste Governance Platform**  
**Document Version**: 1.0.0 (Production Release Candidate)  
**Target Environment**: Ubuntu 22.04 / 24.04 LTS VPS  
**Security Classification**: Authoritative Operations Runbook  

---

## 1. Purpose

This runbook provides the authoritative, step-by-step, beginner-safe operational procedure for deploying **BioTrack / VyomCare** to a live production Ubuntu server.

Every command in this document is labeled with its target execution context:
- `[VPS COMMAND]` — Run inside the remote Ubuntu production server terminal (via SSH).
- `[WINDOWS COMMAND]` — Run locally on a Windows development machine.
- `[WSL COMMAND]` — Run locally inside Windows Subsystem for Linux.

---

## 2. Current Production Readiness Status

Following the Phase 11 Audit and Phase 12 Production Hardening:
- **P0 Blockers**: **0**
- **P1 High Issues**: **0**
- **P2 Medium Issues**: **0**
- **P3 Low Issues**: **0**
- **Backend Quality**: 100% clean NestJS build, 0 ESLint warnings, 19/19 unit tests passing.
- **Frontend Quality**: 100% clean Next.js standalone build, 0 TypeScript type errors.
- **Docker Compose**: Production configuration (`docker-compose.prod.yml`) fully validated.

---

## 3. Exact Production Architecture & Network Isolation

```text
                                INTERNET (Browsers, Mobile Drivers & CBWTF Scanners)
                                                        |
                                              HTTPS (:443) / HTTP (:80)
                                                        |
                                          +---------------------------+
                                          | Nginx Reverse Proxy & TLS |
                                          |    Container (Port 80/443)|
                                          +---------------------------+
                                            /           |           \
                    HTTP Proxy (/api/)     /            |            \    HTTP Proxy (/*)
                                          /             |             \
            +-----------------------------------+       |      +-----------------------------------+
            | NestJS Backend API (Container)    |       |      | Next.js 16 Standalone (Container) |
            | Port: 3001 (Internal Only)        |       |      | Port: 3000 (Internal Only)        |
            +-----------------------------------+       |      +-----------------------------------+
                   |                    |               | WebSocket (/socket.io/)
         TCP (3306)|          TCP (6379)|               |
                   v                    v               v
        +--------------------+   +------------------------------------+
        | MySQL 8.0 Database |   | Redis 7.0 In-Memory Store & Queue  |
        | (Internal Only)    |   | (BullMQ / Rate Limiting / WSS)     |
        +--------------------+   +------------------------------------+
                   |                                |
            Named Volume                     Named Volume
       (biotrack_mysql_prod_data)       (biotrack_redis_prod_data)
```

### Strict Service Isolation Matrix
| Service | Container Name | Internal Port | Public Port | Direct Public Exposure? |
|---|---|:---:|:---:|:---:|
| **Nginx Proxy** | `biotrack_prod_proxy` | 80, 443 | 80, 443 | **YES (Sole Public Ingress)** |
| **Next.js Web** | `biotrack_prod_frontend` | 3000 | None | ❌ **NO (Proxied by Nginx)** |
| **NestJS API** | `biotrack_prod_backend` | 3001 | None | ❌ **NO (Proxied by Nginx)** |
| **MySQL 8.0** | `biotrack_prod_mysql` | 3306 | None | ❌ **NO (Internal Network Only)** |
| **Redis 7.0** | `biotrack_prod_redis` | 6379 | None | ❌ **NO (Internal Network Only)** |

---

## 4. Minimum Server Requirements

| Resource | Minimum (Single Facility / Staging) | Recommended (Multi-Facility Production) |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS / 24.04 LTS (x86_64) | Ubuntu 24.04 LTS (x86_64) |
| **CPU** | 2 vCPUs | 4 vCPUs |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 40 GB NVMe SSD | 80 GB+ NVMe SSD |
| **Docker Engine** | v24.0+ / v27.x+ | v27.x+ |
| **Docker Compose** | Compose Plugin v2.20+ (`docker compose`) | Compose Plugin v2.28+ |

---

## 5. Domain & DNS Requirements

Before issuing SSL certificates, create the following DNS records at your domain registrar/DNS provider (Cloudflare, Namecheap, Route53, etc.):

| Record Type | Host / Name | Target Value | TTL | Purpose |
|---|---|---|---|---|
| **A** | `biotrack.YOUR_DOMAIN.com` | `YOUR_SERVER_IP` | 300 (or Auto) | Main application & API traffic |
| **A** (Optional) | `api.YOUR_DOMAIN.com` | `YOUR_SERVER_IP` | 300 (or Auto) | Dedicated API subdomain (if chosen) |

> [!IMPORTANT]
> Ensure the `A` record has fully propagated before attempting Let's Encrypt certificate generation. Verify with: `dig +short biotrack.YOUR_DOMAIN.com`.

---

## 6. Firewall & Network Security (UFW)

The production firewall must strictly expose only SSH, HTTP, and HTTPS:

```bash
# [VPS COMMAND]
# 1. Allow OpenSSH before enabling firewall to prevent lockout
sudo ufw allow OpenSSH

# 2. Allow Web Traffic (Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 3. Enable Firewall
sudo ufw --force enable

# 4. Verify Status (Must show 22, 80, 443 ALLOWED; all others blocked)
sudo ufw status verbose
```

---

## 7. Production Environment Variables Reference

Create `/opt/vyomcare/.env.production` on the production server.

| Variable | Used By | Purpose | Required? | Safe Example / Format | Generation Method |
|---|---|---|:---:|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend | API endpoint for client requests | **Yes** | `/api` | Hardcoded relative path |
| `NEXT_PUBLIC_SOCKET_URL` | Frontend | WebSocket namespace for notifications | **Yes** | `/notifications` | Hardcoded relative path |
| `HTTP_PORT` | Compose / Nginx | Public HTTP listener port | **Yes** | `80` | Standard default |
| `HTTPS_PORT` | Compose / Nginx | Public HTTPS listener port | **Yes** | `443` | Standard default |
| `MYSQL_DATABASE` | MySQL / Backend | Production database name | **Yes** | `biotrack_prod` | Descriptive name |
| `MYSQL_USER` | MySQL / Backend | Unprivileged database application user | **Yes** | `biotrack_app` | Descriptive username |
| `MYSQL_PASSWORD` | MySQL / Backend | Application user database password | **Yes** | 32-character random hex string | `openssl rand -hex 32` |
| `MYSQL_ROOT_PASSWORD` | MySQL | Database root superuser password | **Yes** | 32-character random hex string | `openssl rand -hex 32` |
| `JWT_SECRET` | Backend | Secret key for signing access tokens | **Yes** | 64-character base64 string | `openssl rand -base64 48` |
| `JWT_EXPIRY` | Backend | Access token lifetime | **Yes** | `15m` | Standard short duration |
| `REFRESH_TOKEN_SECRET` | Backend | Secret key for refresh token hashing | **Yes** | 64-character base64 string | `openssl rand -base64 48` |
| `REFRESH_TOKEN_EXPIRY` | Backend | Refresh token lifetime | **Yes** | `7d` | Standard 7-day duration |
| `CORS_ORIGIN` | Backend | Allowed browser origins for CORS | **Yes** | `https://biotrack.YOUR_DOMAIN.com` | Derived from production domain |

---

## 8. Secret Generation Requirements

Execute these commands directly on the server to generate strong production secrets:

```bash
# [VPS COMMAND]
# Generate MySQL Passwords (32-character hex)
echo "MYSQL_PASSWORD=$(openssl rand -hex 32)"
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -hex 32)"

# Generate JWT & Refresh Secrets (64-character base64)
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "REFRESH_TOKEN_SECRET=$(openssl rand -base64 48)"
```

---

## 9. TLS / SSL Certificate Setup (Let's Encrypt / Certbot)

### Step 9.1: Install Certbot
```bash
# [VPS COMMAND]
sudo apt update
sudo apt install -y certbot
```

### Step 9.2: Obtain Initial Certificate (Standalone Mode)
Before starting Nginx for the first time, obtain the initial certificate while port 80 is free:
```bash
# [VPS COMMAND]
sudo certbot certonly --standalone \
  --preferred-challenges http \
  -d biotrack.YOUR_DOMAIN.com \
  --email YOUR_EMAIL@domain.com \
  --agree-tos \
  --no-eff-email
```

### Step 9.3: Mount Certificates in Docker Compose
In `docker-compose.prod.yml`, update the `nginx` service volumes to mount `/etc/letsencrypt`:
```yaml
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - nginx_logs:/var/log/nginx
```

### Step 9.4: Enable HTTPS in `nginx/nginx.conf`
Uncomment the HTTPS `server` block in `nginx/nginx.conf` and update `server_name` and certificate paths to match `biotrack.YOUR_DOMAIN.com`.

### Step 9.5: Automated Certificate Renewal Cron
```bash
# [VPS COMMAND]
# Adds automatic renewal and Nginx reload at 03:00 AM daily
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker exec biotrack_prod_proxy nginx -s reload") | crontab -
```

---

## 10. Complete Step-by-Step Deployment Sequence

### Step 1: Initial Server Setup
```bash
# [VPS COMMAND]
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install essential dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release git ufw

# 3. Install official Docker Engine & Docker Compose plugin
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 4. Enable Docker service
sudo systemctl enable --now docker
```

### Step 2: Clone Repository
```bash
# [VPS COMMAND]
sudo mkdir -p /opt/vyomcare
sudo chown -R $USER:$USER /opt/vyomcare
git clone https://github.com/KalendraYadav/vyomcare.git /opt/vyomcare
cd /opt/vyomcare
```

### Step 3: Configure Production Environment
```bash
# [VPS COMMAND]
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
# Paste generated secrets and set CORS_ORIGIN=https://biotrack.YOUR_DOMAIN.com
```

### Step 4: Build Production Containers
```bash
# [VPS COMMAND]
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

### Step 5: Start Stack in Background
```bash
# [VPS COMMAND]
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Step 6: Verify Service Health
```bash
# [VPS COMMAND]
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```
*Expected Output*: All 5 containers must show status `Up (healthy)`.

---

## 11. Database Migration & Initialization

### Prisma Migration Deploy (Safe Production Command)
The backend container entrypoint automatically executes `prisma migrate deploy` upon startup.  
To verify or run migrations manually from the host:

```bash
# [VPS COMMAND]
docker exec -it biotrack_prod_backend npx prisma migrate deploy
```

> [!CAUTION]
> **NEVER RUN `prisma db push` OR `prisma migrate reset` IN PRODUCTION.**  
> `prisma migrate deploy` is strictly additive and applies only verified, unapplied migrations from `prisma/migrations/`.

---

## 12. Initial Super Admin & Reference Data Setup

To initialize base categories, compliance rules, and the initial `SUPER_ADMIN` account on a fresh database:

```bash
# [VPS COMMAND]
docker exec -it biotrack_prod_backend npx ts-node prisma/seed.ts
```

> [!IMPORTANT]
> Immediately after running the seed script on a live production instance, log in as `admin@biotrack.in` and change the administrator password.

---

## 13. Backup & Disaster Recovery Setup

### Step 13.1: Configure Automated Daily Backup Cron
```bash
# [VPS COMMAND]
chmod +x /opt/vyomcare/scripts/backup-db.sh
chmod +x /opt/vyomcare/scripts/restore-db.sh

# Add nightly backup at 02:00 UTC to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/vyomcare/scripts/backup-db.sh >> /var/log/biotrack-backup.log 2>&1") | crontab -
```

### Step 13.2: Manual Backup Execution
```bash
# [VPS COMMAND]
/opt/vyomcare/scripts/backup-db.sh
```

### Step 13.3: Database Restoration Procedure
```bash
# [VPS COMMAND]
/opt/vyomcare/scripts/restore-db.sh /var/backups/biotrack/biotrack_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Step 13.4: Offsite Backup Replication (Recommended)
Sync local `/var/backups/biotrack` to AWS S3 or Cloudflare R2:
```bash
# [VPS COMMAND]
# Example using rclone or AWS CLI:
# aws s3 sync /var/backups/biotrack s3://biotrack-production-backups/ --delete
```

---

## 14. Monitoring, Health Checks & Observability

### Endpoint Health Checks
```bash
# [VPS COMMAND]
# Check Nginx Gateway
curl -i https://biotrack.YOUR_DOMAIN.com/healthz

# Check Backend API
curl -i https://biotrack.YOUR_DOMAIN.com/api

# Check Frontend Web App
curl -i https://biotrack.YOUR_DOMAIN.com/
```

### Real-Time Container Logging
```bash
# [VPS COMMAND]
# Tail logs for all containers
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Tail specific backend container logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

---

## 15. Post-Deployment Production Smoke Test Checklist

Execute this verification checklist immediately after launch:

- [ ] **SSL / Security**: Browser displays valid Let's Encrypt certificate padlock without mixed content warnings.
- [ ] **HTTP to HTTPS Redirection**: Visiting `http://biotrack.YOUR_DOMAIN.com` automatically redirects to `https://`.
- [ ] **Authentication**:
  - [ ] Log in as `admin@biotrack.in` (Super Admin).
  - [ ] Log in as Hospital Staff / Admin.
  - [ ] Verify access token in-memory retention and secure `httpOnly` refresh token cookie.
- [ ] **Mobile Camera Scanner (HTTPS)**:
  - [ ] Open `https://biotrack.YOUR_DOMAIN.com/scan` on an actual Android and iOS smartphone.
  - [ ] Tap **Open Camera Scanner**.
  - [ ] Verify browser prompts for camera permission and displays live video feed without secure context errors.
  - [ ] Scan a sample physical barcode and verify instant identification.
- [ ] **Chain-of-Custody Lifecycle**:
  - [ ] Create a new Waste Batch manifest as Hospital Staff (`/waste-batches/new`).
  - [ ] Generate and print QR Code adhesive label (`/waste-batches/:id/print-qr`).
  - [ ] Accept custody as Collection Staff (`/scan`).
  - [ ] Start transport as Driver (`/transport/driver-mode`).
  - [ ] Verify real-time GPS telemetry pings appear on Government Authority dashboard (`/government/map`).
  - [ ] Execute 5-Step Gate Arrival Verification as Treatment Facility Staff (`/scan`).
  - [ ] Confirm destruction with photo proof and close batch (`/treatment/dashboard`).
- [ ] **Audit Trail**: Super Admin inspects `/admin/audit-log` and verifies all custody actions are recorded with IP addresses and timestamps.
- [ ] **Persistence Test**: Run `docker compose restart`, refresh browser, and verify all batches and user sessions persist intact.

---

## 16. Rollback Procedures

### Scenario A: Application Code Rollback
If a newly deployed Git commit contains a frontend or backend bug:
```bash
# [VPS COMMAND]
cd /opt/vyomcare
git checkout <PREVIOUS_STABLE_COMMIT_HASH>
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Scenario B: Database Restoration Rollback
If data corruption occurred:
```bash
# [VPS COMMAND]
/opt/vyomcare/scripts/restore-db.sh /var/backups/biotrack/biotrack_backup_<TIMESTAMP>.sql.gz
```

---

## 17. Security Checklist for Production

- [x] MySQL port 3306 is **NOT** bound to public host.
- [x] Redis port 6379 is **NOT** bound to public host.
- [x] Application containers execute as dedicated non-root users (`nestjs`, `nextjs`).
- [x] Passwords hashed with bcrypt (10 rounds).
- [x] Refresh tokens stored in hashed form with SHA-256 and unique index.
- [x] Failed logins rate-limited via Redis with 15-minute lockout.
- [x] Security headers active in Nginx (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`).
- [x] `.env.production` file permissions locked to `chmod 600`.

---

## 18. NOT EXECUTED IN PHASE 13

To preserve repository safety and honor project boundaries, the following live infrastructure actions were **intentionally NOT executed** during Phase 13:
- ❌ No cloud server VPS provisioned.
- ❌ No live SSH connections established.
- ❌ No real domain DNS records modified.
- ❌ No live Let's Encrypt TLS certificates issued.
- ❌ No production database created or migrated.
- ❌ No production containers started.

---

## 19. Exact Execution Order for Phase 14 (Live Staging / Production Launch)

When proceeding to live server deployment:
1. **Server Setup**: Launch Ubuntu VPS, apply security updates, install Docker Engine & Compose.
2. **DNS Pointing**: Point `A` record `biotrack.domain.com` -> `SERVER_IP`.
3. **Firewall**: Configure UFW (Allow 22, 80, 443; Deny all others).
4. **Clone Code**: `git clone ... /opt/vyomcare`.
5. **Secret Generation**: Run `openssl` to generate passwords/keys into `.env.production`.
6. **SSL Issuance**: Run `certbot certonly --standalone -d biotrack.domain.com`.
7. **Nginx SSL Configuration**: Enable HTTPS server block in `nginx/nginx.conf`.
8. **Container Build & Launch**: `docker compose --env-file .env.production -f docker-compose.prod.yml up -d`.
9. **Database Bootstrap**: Run `prisma migrate deploy` and `seed.ts`.
10. **Post-Launch Smoke Tests**: Complete Section 15 verification checklist on real mobile devices.
