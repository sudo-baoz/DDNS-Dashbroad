# PulseDNS Docker Production Deployment Guide

This guide covers deploying PulseDNS using the pre-built, verified multi-architecture Docker images published to **GitHub Container Registry (GHCR)**.

---

## 1. Quick Start with Docker Run

Run the verified production image directly:

```bash
# 1. Create a persistent data directory for SQLite
mkdir -p ./pulsedns-data

# 2. Run the container
docker run -d \
  --name pulsedns \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/pulsedns-data:/app/data" \
  -e NODE_ENV="production" \
  -e PORT="3000" \
  -e DATABASE_URL="file:/app/data/pulsedns.db" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e ENABLE_WORKER="true" \
  ghcr.io/sudo-baoz/ddns-dashbroad:latest
```

Open your browser at `http://localhost:3000` to complete the initial setup wizard.

---

## 2. Production Deployment with Docker Compose

For homelabs, VPS instances, or production servers, using `docker-compose.yml` is the recommended standard.

### 2.1 Prepare `docker-compose.yml`

```yaml
version: '3.8'

services:
  pulsedns:
    image: ghcr.io/sudo-baoz/ddns-dashbroad:latest
    container_name: pulsedns
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=file:/app/data/pulsedns.db
      - SESSION_SECRET=${SESSION_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - ENABLE_WORKER=true
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

Generate secure keys for cookie signing and provider token encryption:

```bash
# Generate secrets
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat <<EOF > .env
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
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

---

## 3. Reverse Proxy & SSL Setup

It is strongly recommended to place PulseDNS behind a reverse proxy for HTTPS termination.

### Caddy Example
```caddy
ddns.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Nginx Example
```nginx
server {
    listen 80;
    server_name ddns.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ddns.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/ddns.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ddns.yourdomain.com/privkey.pem;

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

# 2. Recreate container with zero downtime
docker compose up -d --remove-orphans

# 3. Clean up older unused image layers
docker image prune -f
```

### Automated Updates with Watchtower
If you use Watchtower to keep containers updated automatically:

```yaml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 3600 --cleanup pulsedns
    restart: unless-stopped
```

---

## 5. Backup & Disaster Recovery

PulseDNS stores all configuration, encrypted provider tokens, DNS zones, and sync history in a single SQLite database file:

- **Location**: `/app/data/pulsedns.db` (or `./pulsedns-data/pulsedns.db` on host).

### Backup:
```bash
# Use sqlite3 online backup command to guarantee safe atomic backup
sqlite3 ./pulsedns-data/pulsedns.db ".backup ./pulsedns_backup_$(date +%Y%m%d_%H%M%S).db"
```

### Restore:
```bash
docker compose down
cp ./pulsedns_backup_XXXX.db ./pulsedns-data/pulsedns.db
docker compose up -d
```
