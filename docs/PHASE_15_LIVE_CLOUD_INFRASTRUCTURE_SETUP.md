# Phase 15 — Live Cloud Host Provisioning & Production Environment Setup Report

**Project:** BioTrack / VyomCare  
**Phase:** 15 — Live Cloud Host Provisioning & Production Environment Setup  
**Date:** September 6, 2026  
**Status:** **PARTIAL / BLOCKED — USER ACTION REQUIRED** (Repository-Side Validation Complete; Live VPS/DNS/TLS Configuration Awaiting User Infrastructure Provisioning)  

---

## 1. Executive Summary

Phase 15 transitions the BioTrack/VyomCare biomedical waste compliance and tracking platform from local/LAN development and preparation into live cloud host provisioning and production environment readiness.

All repository-side assets, production container definitions ([`docker-compose.prod.yml`](file:///d:/web%20project/vyomcare/docker-compose.prod.yml)), reverse proxy configurations ([`nginx/nginx.conf`](file:///d:/web%20project/vyomcare/nginx/nginx.conf)), database migration histories ([`backend/prisma/migrations/`](file:///d:/web%20project/vyomcare/backend/prisma/migrations)), backup automation scripts ([`scripts/backup-db.sh`](file:///d:/web%20project/vyomcare/scripts/backup-db.sh), [`scripts/restore-db.sh`](file:///d:/web%20project/vyomcare/scripts/restore-db.sh)), and environment variable specifications ([`.env.production.example`](file:///d:/web%20project/vyomcare/.env.production.example)) have been rigorously audited and validated.

Because live cloud infrastructure provisioning requires external physical/cloud assets (a dedicated VPS, public IPv4 address, registered domain, and administrative contact email), this phase enforces strict safety controls:
1. **No simulated or fictitious cloud host details were assumed.**
2. **No development secrets or default credentials were used.**
3. **No destructive database operations (`prisma db push`, `migrate reset`, `DROP`, `TRUNCATE`) were run.**
4. **No production application containers were started.**
5. **Exact, step-by-step infrastructure provisioning instructions have been compiled to guide the live VPS deployment.**

---

## 2. VPS Information & Requirements

### Target Specification
| Resource | Minimum Requirement | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS (Jammy) | Ubuntu 24.04 LTS (Noble) |
| **CPU Architecture** | x86_64 | x86_64 |
| **vCPU** | 2 vCPU | 4 vCPU |
| **Memory (RAM)** | 4.0 GB | 8.0 GB (with 2 GB swapfile configured) |
| **Storage** | 40 GB NVMe/SSD | 80 GB NVMe SSD |
| **Network** | Dedicated Public IPv4, 1 Gbps port | Dedicated Public IPv4 |
| **Timezone / Sync** | UTC / `systemd-timesyncd` active | UTC / NTP synchronized |

### Live Host Status
- **VPS Provider:** `TBD` (Pending User Selection: e.g., Hetzner, DigitalOcean, AWS EC2, Linode)
- **VPS Public IPv4:** `TBD`
- **Current Verification State:** `BLOCKED — USER ACTION REQUIRED` (VPS not yet connected)

### Verification Commands for Target Host
```bash
# Execute immediately upon initial SSH connection
cat /etc/os-release
uname -m
nproc
free -h
df -h
timedatectl status
```

---

## 3. SSH Configuration & Hardening

### Administrative Access Policy
- **Deployment User:** Dedicated non-root deployer (e.g., `deploy` or `ubuntu`) with `sudo` privileges.
- **Authentication Method:** Ed25519 / RSA 4096-bit public-key authentication ONLY.
- **Root Login:** `PermitRootLogin prohibit-password` or `no` (after deployer key verification).
- **Password Authentication:** `PasswordAuthentication no`.

### Hardening Sequence (`/etc/ssh/sshd_config.d/50-cloud-init.conf` or `/etc/ssh/sshd_config`)
```bash
# 1. Authorize SSH Key for deploy user
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
echo "<ADMIN_PUBLIC_KEY>" > /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# 2. Add deploy user to sudo and docker groups
usermod -aG sudo deploy
usermod -aG docker deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

# 3. Apply SSH Hardening
cat <<'EOF' > /etc/ssh/sshd_config.d/99-hardening.conf
PermitRootLogin prohibit-password
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 4
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# 4. Test SSH daemon configuration syntax
sshd -t

# 5. Restart SSH service
systemctl restart sshd

# CRITICAL: Verify new session in a separate terminal before closing the current session!
```

---

## 4. Docker & Compose Installation

### Target Packages
- **Docker Engine:** `25.x` or `26.x` (Official Docker Community Edition)
- **Docker Compose Plugin:** `v2.x` (`docker compose`)
- **System Tools:** `git`, `ufw`, `curl`, `gnupg`, `certbot`, `gzip`, `tar`

### Automated Installation Commands
```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git ufw certbot

sudo systemctl enable docker
sudo systemctl start docker
```

---

## 5. Firewall Configuration (UFW)

### Ingress & Network Security Policy
Only edge proxy ports and secure shell are exposed publicly. All internal databases, caches, and application runtimes are strictly bound to internal Docker bridge networks with zero host interface bindings.

| Port / Protocol | Direction | Source | Service | Status |
| :--- | :--- | :--- | :--- | :--- |
| **22 / TCP** | Inbound | `0.0.0.0/0` (or Admin IP CIDR) | OpenSSH Management | **ALLOWED** |
| **80 / TCP** | Inbound | `0.0.0.0/0` | HTTP / ACME Challenge | **ALLOWED** |
| **443 / TCP** | Inbound | `0.0.0.0/0` | HTTPS / Secure Realtime | **ALLOWED** |
| **3000 / TCP** | Inbound | `0.0.0.0/0` | Next.js Frontend | **BLOCKED (Internal Only)** |
| **3001 / TCP** | Inbound | `0.0.0.0/0` | NestJS API Runtime | **BLOCKED (Internal Only)** |
| **3306 / TCP** | Inbound | `0.0.0.0/0` | MySQL 8.0 Database | **BLOCKED (Internal Only)** |
| **6379 / TCP** | Inbound | `0.0.0.0/0` | Redis 7.0 Cache/Queue | **BLOCKED (Internal Only)** |

### UFW Configuration Commands
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment "SSH Management"
sudo ufw allow 80/tcp comment "Nginx HTTP"
sudo ufw allow 443/tcp comment "Nginx HTTPS"
sudo ufw --force enable
sudo ufw status numbered
```

---

## 6. Port and Service Conflict Verification

Prior to running application containers, the host must be audited for existing processes listening on critical ports:
```bash
sudo ss -tulpn | grep -E ':(22|80|443|3000|3001|3306|6379)\b'
```

### Expected State
- `22`: `sshd`
- `80`: Unbound (or temporary standalone certbot during issuance)
- `443`: Unbound
- `3000`, `3001`, `3306`, `6379`: Unbound

---

## 7. Repository Deployment Location

- **Standard Target Directory:** `/opt/vyomcare`
- **Ownership:** `deploy:deploy` (mode `0755`)
- **Repository Setup Commands:**
```bash
sudo mkdir -p /opt/vyomcare
sudo chown -R $USER:$USER /opt/vyomcare
cd /opt/vyomcare
git clone https://github.com/KalendraYadav/vyomcare.git .
git checkout main  # Or documented release tag
git status
git rev-parse HEAD
```

---

## 8. Production Environment Configuration Matrix

The production configuration file `/opt/vyomcare/.env.production` must be created on the host with restrictive permissions (`chmod 600`).

### Variable Verification Matrix
| Variable Name | Required | Internal / External Context | Security Policy |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Immutable production mode |
| `PORT` | Yes | `3001` (Internal NestJS port) | Container internal |
| `NEXT_PUBLIC_API_URL` | Yes | `/api` | Relative proxy path |
| `NEXT_PUBLIC_SOCKET_URL` | Yes | `/notifications` | WebSocket gateway path |
| `HTTP_PORT` | Yes | `80` | Nginx edge listener |
| `HTTPS_PORT` | Yes | `443` | Nginx TLS listener |
| `MYSQL_DATABASE` | Yes | `biotrack_prod` | Dedicated production schema |
| `MYSQL_USER` | Yes | `biotrack_app` | Least-privilege application user |
| `MYSQL_PASSWORD` | Yes | Cryptographic Random (32+ chars) | Generated via `openssl rand -hex 32` |
| `MYSQL_ROOT_PASSWORD` | Yes | Cryptographic Random (32+ chars) | Generated via `openssl rand -hex 32` |
| `DATABASE_URL` | Yes | `mysql://biotrack_app:<PASS>@mysql:3306/biotrack_prod` | Internal service hostname (`mysql`) |
| `REDIS_URL` | Yes | `redis://redis:6379` | Internal service hostname (`redis`) |
| `JWT_SECRET` | Yes | Cryptographic Random (64+ chars) | Generated via `openssl rand -hex 64` |
| `JWT_EXPIRY` | Yes | `15m` | Token lifecycle |
| `REFRESH_TOKEN_SECRET` | Yes | Cryptographic Random (64+ chars) | Generated via `openssl rand -hex 64` |
| `REFRESH_TOKEN_EXPIRY` | Yes | `7d` | Token lifecycle |
| `CORS_ORIGIN` | Yes | `https://<REAL_PRODUCTION_DOMAIN>` | Exact HTTPS origin |
| `SSL_CERT_PATH` | Yes | `/etc/letsencrypt/live/<DOMAIN>/fullchain.pem` | Container read-only mount |
| `SSL_KEY_PATH` | Yes | `/etc/letsencrypt/live/<DOMAIN>/privkey.pem` | Container read-only mount |

> [!CAUTION]
> Under NO circumstances should development passwords (e.g. `BioTrack_Dev_2026!`, `dev_jwt_secret_*`) be used in production. All secrets must be generated locally on the VPS.

---

## 9. DNS Configuration

- **Target Record Type:** `A` Record
- **Host / Name:** `biotrack` (or `@` for apex domain)
- **Target Value:** `<VPS_PUBLIC_IPV4_ADDRESS>`
- **TTL:** 300 seconds (during migration/launch)

### DNS Verification (External & Host)
```bash
# Verify authoritative public DNS propagation
dig +short A biotrack.<YOUR_DOMAIN>.com @8.8.8.8
nslookup biotrack.<YOUR_DOMAIN>.com 1.1.1.1
```

---

## 10. TLS Configuration & Certbot

### Certificate Issuance Prerequisites
1. DNS `A` record resolved to host IPv4.
2. Port `80` accessible from Let's Encrypt validation servers.
3. Administrator email provided.

### Standalone Issuance
```bash
sudo certbot certonly --standalone \
  -d biotrack.<YOUR_DOMAIN>.com \
  --agree-tos \
  --email <ADMIN_EMAIL> \
  --non-interactive
```

### Volume Mount in Compose
In [`docker-compose.prod.yml`](file:///d:/web%20project/vyomcare/docker-compose.prod.yml):
```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

### Automated Renewal Configuration
`/etc/cron.d/certbot-biotrack`:
```cron
0 3 * * * root certbot renew --quiet --deploy-hook "docker exec vyomcare-nginx-1 nginx -s reload"
```

---

## 11. Backup Infrastructure Preparation

### Local Backup Storage
- **Target Path:** `/opt/vyomcare/backups`
- **Ownership:** `deploy:deploy` (mode `0700`)
- **Scripts:** [`scripts/backup-db.sh`](file:///d:/web%20project/vyomcare/scripts/backup-db.sh), [`scripts/restore-db.sh`](file:///d:/web%20project/vyomcare/scripts/restore-db.sh)

### Verification Commands
```bash
sudo mkdir -p /opt/vyomcare/backups
sudo chmod 700 /opt/vyomcare/backups
sudo chown -R deploy:deploy /opt/vyomcare/backups
chmod +x /opt/vyomcare/scripts/*.sh
```

---

## 12. Offsite Backup Status

- **Status:** `BLOCKED / USER CONFIGURATION REQUIRED`
- **Supported Backends:** AWS S3, Cloudflare R2, Backblaze B2 (S3 API compatible)
- **Required Configuration:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_ENDPOINT`

---

## 13. Automation & Cron Setup

The following system cron jobs are planned for the production host:

| Frequency | Job Command | Purpose |
| :--- | :--- | :--- |
| **0 2 * * *** | `/opt/vyomcare/scripts/backup-db.sh >> /var/log/biotrack-backup.log 2>&1` | Nightly automated database dump & gzip |
| **0 3 * * *** | `certbot renew --quiet --deploy-hook "docker exec vyomcare-nginx-1 nginx -s reload"` | Automated TLS renewal check |
| **0 4 * * 0** | `docker system prune -f --volumes` | Weekly Docker cache clean (retaining active data volumes) |

---

## 14. Network Isolation & Topology

```
Public Internet
   │
   ├── Port 22 (SSH) ───> Host SSH Daemon (Key-based auth)
   ├── Port 80 (HTTP) ──> Nginx Gateway (301 Redirect -> HTTPS / ACME Challenge)
   └── Port 443 (HTTPS) ─> Nginx Gateway (TLS 1.2/1.3 Termination, Security Headers, Rate Limiting)
                                │
          ┌─────────────────────┴─────────────────────┐
          │ (Docker Internal Network: vyomcare-prod)  │
          ▼                                           ▼
   Next.js (App) :3000                         NestJS (API) :3001
   (Server-Rendered UI)                               │
                                        ┌─────────────┴─────────────┐
                                        ▼                           ▼
                                 MySQL 8.0 :3306             Redis 7.0 :6379
                                 (Data Volume: mysql_data)   (Data Volume: redis_data)
                                 (NO HOST PORTS)             (NO HOST PORTS)
```

---

## 15. Production Compose Validation

Repository compose configuration validated successfully:
```powershell
docker compose --env-file .env.production.example -f docker-compose.prod.yml config
```
- **Result:** **PASS** (0 configuration errors, valid service definitions, correct secret interpolations, exact volume declarations).

---

## 16. Remaining Blockers

1. **VPS Provisioning:** User has not yet provided the live VPS IP address and SSH credentials.
2. **Domain Registration & DNS Delegation:** User has not yet supplied the production domain name (`biotrack.<YOUR_DOMAIN>.com`) and pointed the `A` record to the VPS IP.
3. **Let's Encrypt Admin Email:** User has not yet provided the administrator email address.
4. **Offsite Backup Credentials:** Cloud storage S3/R2 credentials for offsite replication are pending.

---

## 17. User Actions Required

Before proceeding to **Phase 16 (Controlled First Production Deployment)**, please supply:
1. **VPS Public IPv4 Address**
2. **SSH Connection Details** (User, Port, Key verification)
3. **Production Domain / Subdomain** (e.g., `biotrack.vyomcare.com`)
4. **Let's Encrypt Administrator Email** (for SSL certificates)
5. **(Optional) S3 / R2 Bucket Credentials** (for offsite database backups)

---

## 18. Commands Executed During Phase 15

| Command | Purpose | Result |
| :--- | :--- | :--- |
| `docker compose --env-file .env.production.example -f docker-compose.prod.yml config` | Validate production Compose schema and volume mounts | **PASSED** |
| `npm run test` (in `backend/`) | Verify backend test suite integrity prior to production prep | **PASSED** (19/19 tests) |
| `npm run build` (in `backend/`) | Verify NestJS compilation | **PASSED** |
| `npm run lint` (in `backend/`) | Verify backend ESLint compliance | **PASSED** (0 errors) |
| `npx tsc --noEmit` (in `frontend/`) | Verify frontend TypeScript type-safety | **PASSED** (0 errors) |

---

## 19. Security Confirmation

We explicitly confirm and certify:
- **No development secrets reused** in production templates or documentation.
- **No production secrets committed** to version control.
- **No production secrets exposed** in terminal outputs or Phase 15 reports.
- **No destructive database commands executed** (`prisma db push`, `migrate reset`, `DROP`, `TRUNCATE`).
- **No production database modified.**
- **No production migration executed.**
- **No production seed executed.**
- **No production application stack started.**

---
*Report compiled and certified for BioTrack / VyomCare Phase 15.*
