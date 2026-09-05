# VyomCare / BioTrack — Production Deployment & Operations Runbook

This document serves as the authoritative production deployment and operations guide for **VyomCare / BioTrack**, a mission-critical biomedical waste tracking and regulatory compliance platform.

---

## 1. System Architecture & Topology

The production architecture enforces strict defense-in-depth isolation:

```text
                                INTERNET (Clients & Mobile Drivers)
                                                |
                                     HTTPS (:443) / HTTP (:80)
                                                |
                                     Reverse Proxy (Nginx)
                                        /              \
                                       /                \
                       Frontend (Next.js 16)      Backend API (NestJS)
                             Port 3000                 Port 3001
                                                           |
                                              +------------+------------+
                                              |                         |
                                            MySQL 8.0                 Redis 7.0
                                           (Port 3306)               (Port 6379)
                                                |                         |
                                        Persistent Volume          BullMQ Worker &
                                      (biotrack_mysql_data)      Real-Time Telemetry
```

### Key Security & Isolation Guarantees
- **No Direct Database Exposure**: Neither MySQL nor Redis publish ports to the public host or internet. They communicate exclusively over the internal Docker network (`biotrack_internal`).
- **Single Public Entry Point**: All browser, mobile, and external HTTP/WebSocket requests traverse the Nginx reverse proxy.
- **WebSocket Upgrade Routing**: Socket.IO connections on `/socket.io/` are transparently upgraded and proxied to the backend notifications gateway with 24-hour timeout support.
- **Principle of Least Privilege**: Node.js containers run as unprivileged, dedicated non-root users (`nextjs:nodejs` and `nestjs:nodejs`).

---

## 2. Server Prerequisites

### Minimum Hardware Requirements
| Resource | Minimum | Recommended (Multi-Facility) |
|---|---|---|
| **CPU** | 2 vCPUs | 4 vCPUs |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 40 GB NVMe SSD | 100 GB NVMe SSD |
| **OS** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS / Debian 12 |

### Required Host Software
- **Docker Engine**: v24.0+ (or v29.x)
- **Docker Compose**: v2.20+ (Plugin `docker compose`)
- **Git**, **curl**, **tar**, **gzip**, **openssl**

---

## 3. Host Setup & Docker Installation

On a clean Ubuntu server:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker via official repository
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 3. Add deploy user to docker group (optional, avoid root)
sudo usermod -aG docker $USER
newgrp docker
```

---

## 4. Repository Setup & Environment Secrets

### 4.1 Clone Repository
```bash
git clone https://github.com/KalendraYadav/vyomcare.git /opt/vyomcare
cd /opt/vyomcare
```

### 4.2 Generate Cryptographically Secure Secrets
Run the following commands to generate production secrets:

```bash
# MySQL Passwords (32-character hex)
openssl rand -hex 32

# JWT Secret & Refresh Token Secret (64-character base64)
openssl rand -base64 48
```

### 4.3 Configure Production Environment (`.env.production`)
Copy the template and set the secrets:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

**Required Configuration Matrix**:
```ini
# Frontend URLs
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=/notifications

# Ports
HTTP_PORT=80
HTTPS_PORT=443

# MySQL Internal Credentials
MYSQL_DATABASE=biotrack_prod
MYSQL_USER=biotrack_app
MYSQL_PASSWORD=<generated-app-password>
MYSQL_ROOT_PASSWORD=<generated-root-password>

# JWT Authentication
JWT_SECRET=<generated-jwt-secret>
JWT_EXPIRY=15m
REFRESH_TOKEN_SECRET=<generated-refresh-secret>
REFRESH_TOKEN_EXPIRY=7d

# CORS Allowed Origin
CORS_ORIGIN=https://biotrack.yourdomain.com
```

---

## 5. TLS / SSL Certificate Setup (Let's Encrypt / Certbot)

For real production with HTTPS on your registered domain:

```bash
# 1. Install Certbot
sudo apt install -y certbot

# 2. Acquire initial certificate using standalone mode (port 80 temporarily free)
sudo certbot certonly --standalone -d biotrack.yourdomain.com

# Certificates will be stored in:
# /etc/letsencrypt/live/biotrack.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/biotrack.yourdomain.com/privkey.pem

# 3. Uncomment HTTPS server block in nginx/nginx.conf with your domain name
# 4. Mount certificates in docker-compose.prod.yml:
#   volumes:
#     - /etc/letsencrypt:/etc/letsencrypt:ro
```

Automatic renewal cron:
```bash
echo "0 3 * * * certbot renew --quiet && docker exec biotrack_prod_proxy nginx -s reload" | sudo crontab -
```

---

## 6. Build and Start Production Stack

Build all production Docker images and launch the containers:

```bash
# Build production images
docker compose --env-file .env.production -f docker-compose.prod.yml build

# Launch containers in background
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Container Startup & Health Verification
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```
All containers (`biotrack_prod_mysql`, `biotrack_prod_redis`, `biotrack_prod_backend`, `biotrack_prod_frontend`, `biotrack_prod_proxy`) should report `Up (healthy)`.

---

## 7. Database Migrations Strategy

Production startup uses strict migration deployment:
```bash
# Automatically executed during container entrypoint via docker-entrypoint.sh:
npx prisma migrate deploy
```

> [!CAUTION]
> **NEVER** run `npx prisma db push` or `npx prisma migrate reset` in production!
> `prisma migrate deploy` only applies verified, pending migrations from `backend/prisma/migrations/` and never drops tables or deletes data.

To manually run or inspect migrations from the host:
```bash
docker exec -it biotrack_prod_backend npx prisma migrate status
```

---

## 8. Database Backup & Disaster Recovery

### 8.1 Automated Nightly Backup
The included script [backup-db.sh](file:///scripts/backup-db.sh) runs consistent online backups using `mysqldump --single-transaction` and retains 14 days of compressed archives:

```bash
# Make script executable
chmod +x ./scripts/backup-db.sh

# Run manual backup
./scripts/backup-db.sh
```

Configure automated cron job:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/vyomcare/scripts/backup-db.sh >> /var/log/biotrack-backup.log 2>&1") | crontab -
```

### 8.2 Database Restoration
In the event of disaster recovery or staging verification:
```bash
chmod +x ./scripts/restore-db.sh
./scripts/restore-db.sh /var/backups/biotrack/biotrack_backup_20260905_020000.sql.gz
```

---

## 9. Observability, Monitoring & Logging

### Inspect Real-Time Container Logs
```bash
# Follow logs for all services
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Follow specific service
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx
```

### Service Health Endpoints
- **Reverse Proxy**: `curl -i http://localhost/healthz` (returns `200 OK`)
- **Backend API**: `curl -i http://localhost/api` (returns `200 OK`)
- **Frontend**: `curl -i http://localhost/` (returns `200 OK`)

### BullMQ Queue & Worker Monitoring
The BullMQ worker runs inside the backend container.
Monitor job logs:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs backend | grep "BullMQ"
```

---

## 10. Rollback Procedure

If a deployed version contains a critical defect:

1. **Application Container Rollback**:
   ```bash
   # Checkout previous verified commit
   git checkout <PREVIOUS_STABLE_COMMIT_HASH>
   
   # Rebuild and restart containers
   docker compose --env-file .env.production -f docker-compose.prod.yml build
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ```

2. **Database Migration Rollback**:
   - Prisma migrations that have already run forward cannot always be automatically reversed.
   - If a migration added non-destructive columns, leaving them in place while rolling back application code is recommended.
   - If schema corruption occurred, restore from the latest pre-deployment backup using `./scripts/restore-db.sh`.

---

## 11. Troubleshooting Common Issues

### Issue 1: `502 Bad Gateway` on `/api/`
- **Cause**: Backend container is starting up or crashed.
- **Fix**: Check `docker compose logs backend`. Ensure MySQL and Redis are healthy.

### Issue 2: WebSockets / Notifications Disconnecting
- **Cause**: Proxy timeout or missing WebSocket headers.
- **Fix**: Verify `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"` are present in `nginx/nginx.conf`. Ensure `proxy_read_timeout 86400s;` is set.

### Issue 3: Driver Geolocation or QR Camera Blocked
- **Cause**: Missing `Permissions-Policy` header or non-HTTPS origin.
- **Fix**: Browsers require HTTPS (or localhost) for `navigator.mediaDevices.getUserMedia` and `navigator.geolocation`. Ensure Nginx serves `Permissions-Policy "camera=(self), geolocation=(self)"`.
