# PulseDNS — Deployment Guide

This guide covers production deployment scenarios for Docker Compose, standalone Linux VPS hosts, and reverse proxies (Nginx, Caddy, Cloudflare Tunnel).

---

## 1. Docker Compose Deployment (Recommended)

### Directory Structure
```
/opt/pulsedns/
├── docker-compose.yml
├── .env
└── data/
    └── pulsedns.db
```

### Installation Steps
```bash
# 1. Create deployment directory
sudo mkdir -p /opt/pulsedns/data
cd /opt/pulsedns

# 2. Download docker-compose.yml and .env.example
curl -sSL https://raw.githubusercontent.com/your-repo/DDNS-Dashbroad/main/docker-compose.yml -o docker-compose.yml
curl -sSL https://raw.githubusercontent.com/your-repo/DDNS-Dashbroad/main/.env.example -o .env

# 3. Generate AES-256 encryption key for token vault
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Set encryption key in .env
sed -i "s/replace-with-64-char-hex-key-generate-via-openssl-rand-hex-32/$ENCRYPTION_KEY/" .env

# 4. Launch container
docker compose up -d --build
```

### Checking Container Health
```bash
docker compose ps
docker compose logs -f pulsedns
curl http://localhost:3000/api/health
```

---

## 2. Reverse Proxy Configuration

PulseDNS natively handles HTTP in local environments and HTTPS behind TLS-terminating proxies.

### Caddy (Recommended for Auto-HTTPS)
```caddy
ddns.yourdomain.com {
    reverse_proxy localhost:3000 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Real-IP {remote_host}
    }
}
```

### Nginx
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
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 3. Standalone Linux VPS (Systemd)

If running without Docker directly on an Ubuntu/Debian server:

### 1. Build Application
```bash
git clone https://github.com/your-repo/DDNS-Dashbroad.git /opt/pulsedns
cd /opt/pulsedns
npm ci
npm run build
```

### 2. Create Systemd Service (`/etc/systemd/system/pulsedns.service`)
```ini
[Unit]
Description=PulseDNS Dynamic DNS Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pulsedns
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
EnvironmentFile=/opt/pulsedns/.env

[Install]
WantedBy=multi-user.target
```

### 3. Enable and Start
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pulsedns
sudo systemctl status pulsedns
```

---

## 4. Backup & Disaster Recovery

All persistent data (user accounts, session history, encrypted tokens, synced zones, DDNS jobs, execution logs) is contained in the SQLite database file:

### Backup Command
```bash
# Online backup using sqlite3 CLI
sqlite3 /opt/pulsedns/data/pulsedns.db ".backup '/opt/pulsedns/backups/pulsedns_$(date +%Y%m%d_%H%M%S).db'"
```

### Restore Command
```bash
docker compose stop pulsedns
cp /opt/pulsedns/backups/pulsedns_backup.db /opt/pulsedns/data/pulsedns.db
docker compose start pulsedns
```
