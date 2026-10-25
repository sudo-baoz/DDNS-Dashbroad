# PulseDNS Docker Production Deployment Guide

This guide covers deploying PulseDNS using the pre-built, verified multi-architecture Docker images published to **GitHub Container Registry (GHCR)**.

> **Homelab Security Architecture**: PulseDNS is designed as a single-instance, trusted-network dashboard. No user login or registration is required. Deploy within a private LAN (RFC 1918), Tailscale / WireGuard VPN mesh, or behind an authenticated reverse proxy (e.g., Traefik, Caddy, Authelia). Do not bind the unauthenticated dashboard directly to a public IP without network-level access control.

---

## 1. Quick Start with Docker Run

Run the verified production image directly:

```bash
# 1. Create a persistent data directory for SQLite
mkdir -p ./pulsedns-data

# 2. Run the container (binding to 127.0.0.1 for local/reverse-proxy access)
docker run -d \
  --name pulsedns \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v "$(pwd)/pulsedns-data:/app/data" \
  -e NODE_ENV="production" \
  -e PORT="3000" \
  -e DATABASE_URL="file:/app/data/pulsedns.db" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e ENABLE_WORKER="true" \
  ghcr.io/sudo-baoz/ddns-dashbroad:latest
```

Open your browser at `http://localhost:3000` to immediately view your Operational Overview. No login or account creation required.

---

## 2. Production Deployment with Docker Compose

For homelabs, home servers, or private infrastructure, using `docker-compose.yml` is the recommended standard.

### 2.1 Prepare `docker-compose.yml`

```yaml
version: '3.8'

services:
  pulsedns:
    image: ghcr.io/sudo-baoz/ddns-dashbroad:latest
    container_name: pulsedns
    restart: unless-stopped
    ports:
      # Bind to localhost (127.0.0.1) or your private LAN interface
      - "${HOST_BIND:-127.0.0.1}:${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=file:/app/data/pulsedns.db
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - ENABLE_WORKER=true
      - TRUSTED_ORIGINS=${TRUSTED_ORIGINS:-}
    volumes:
      - pulsedns_data:/app/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

volumes:
  pulsedns_data:
    driver: local
```

### 2.2 Create `.env`

Generate an AES-256 encryption key for secure storage of your Cloudflare tokens:

```bash
# Generate 32-byte (64 hex characters) encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat <<EOF > .env
ENCRYPTION_KEY=${ENCRYPTION_KEY}
PORT=3000
HOST_BIND=127.0.0.1
# Optional: Comma-separated list of trusted hostnames or reverse-proxy URLs
# TRUSTED_ORIGINS="http://192.168.1.50:3000,http://pulsedns.home.arpa"
EOF

# Restrict file permissions
chmod 600 .env
```

### 2.3 Start the Service

```bash
docker compose pull
docker compose up -d
```

Check logs and health status:

```bash
docker compose logs -f pulsedns
docker compose ps
```

The container entrypoint automatically adjusts volume permissions on `/app/data` and drops privileges to user `node` (UID 1000) for least-privilege runtime security.

---

## 3. Reverse Proxy & Network Access

Place PulseDNS behind a reverse proxy for TLS encryption and access control.

### Caddy Example
```caddy
ddns.homelab.lan {
    reverse_proxy localhost:3000
}
```

### Nginx Example
```nginx
server {
    listen 80;
    server_name ddns.homelab.lan;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ddns.homelab.lan;

    ssl_certificate /etc/letsencrypt/live/ddns.homelab.lan/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ddns.homelab.lan/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Upgrading to New Releases

PulseDNS container images are versioned with semantic release tags and `:latest`.

To update your running installation:

```bash
# 1. Pull the newest image
docker compose pull

# 2. Recreate container
docker compose up -d --remove-orphans

# 3. Clean up older unused image layers
docker image prune -f
```

---

## 5. Backup & Disaster Recovery

PulseDNS stores all configuration, encrypted provider tokens, DNS zones, and sync history in a single SQLite database file:

- **Location**: `/app/data/pulsedns.db` (or volume `pulsedns_data`).

### Backup:
```bash
# Safe atomic SQLite backup
docker compose exec pulsedns sqlite3 /app/data/pulsedns.db ".backup /app/data/pulsedns_backup.db"
```

### Restore:
```bash
docker compose down
cp ./pulsedns_backup.db ./pulsedns-data/pulsedns.db
docker compose up -d
```
