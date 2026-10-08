#!/usr/bin/env bash
# ============================================================
# Org Chart Generator — VPS Hardening Script
# Run once on a fresh Ubuntu 22.04/24.04 VPS as root:
#   curl -sSL <raw-url> | bash
#   OR
#   chmod +x scripts/harden-vps.sh && sudo ./scripts/harden-vps.sh
#
# What this does:
#   1. System updates + unattended security upgrades
#   2. Firewall (UFW) — only 22, 80, 443 open
#   3. SSH hardening — disable root login, password auth
#   4. Fail2ban — brute-force protection for SSH + Nginx
#   5. Docker install (if missing)
#   6. Certbot/HTTPS with auto-renewal
#   7. Automated daily backups (SQLite + uploads)
#   8. Log rotation
#   9. Generate SESSION_SECRET
# ============================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

# --- Pre-flight ---
if [ "$(id -u)" -ne 0 ]; then
  err "Run as root: sudo ./scripts/harden-vps.sh"
fi

# Prompt for required info
read -rp "Domain name (e.g., orgchart.romega.ph): " DOMAIN
if [ -z "$DOMAIN" ]; then err "Domain is required for HTTPS"; fi

read -rp "Email for Let's Encrypt (e.g., ken@romega.ph): " CERT_EMAIL
if [ -z "$CERT_EMAIL" ]; then err "Email is required for Certbot"; fi

read -rp "Project directory [/opt/orgchart]: " PROJECT_DIR
PROJECT_DIR="${PROJECT_DIR:-/opt/orgchart}"

log "Starting VPS hardening for $DOMAIN..."

# ============================================================
# 1. System updates + unattended upgrades
# ============================================================
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

log "Installing unattended-upgrades..."
apt-get install -y -qq unattended-upgrades apt-listchanges
cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# Enable security updates only
sed -i 's|//.*"${distro_id}:${distro_codename}-security";|        "${distro_id}:${distro_codename}-security";|' \
  /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null || true

log "Automatic security updates enabled."

# ============================================================
# 2. Firewall (UFW)
# ============================================================
log "Configuring firewall..."
apt-get install -y -qq ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable

log "Firewall active — only SSH (22), HTTP (80), HTTPS (443) open."

# ============================================================
# 3. SSH hardening
# ============================================================
log "Hardening SSH..."
SSHD_CONFIG="/etc/ssh/sshd_config"
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%s)"

# Disable root login
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONFIG"
# Disable password auth (require SSH keys)
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
# Disable empty passwords
sed -i 's/^#*PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONFIG"
# Limit auth attempts
sed -i 's/^#*MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CONFIG"
# Idle timeout
grep -q "^ClientAliveInterval" "$SSHD_CONFIG" || echo "ClientAliveInterval 300" >> "$SSHD_CONFIG"
grep -q "^ClientAliveCountMax" "$SSHD_CONFIG" || echo "ClientAliveCountMax 2" >> "$SSHD_CONFIG"

systemctl restart sshd

warn "SSH: Root login disabled, password auth disabled. Make sure your SSH key is added!"

# ============================================================
# 4. Fail2ban
# ============================================================
log "Installing Fail2ban..."
apt-get install -y -qq fail2ban

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
banaction = ufw

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3

[nginx-limit-req]
enabled  = true
port     = http,https
filter   = nginx-limit-req
logpath  = /var/log/nginx/*error.log
maxretry = 10
findtime = 1m
bantime  = 30m

[nginx-botsearch]
enabled  = true
port     = http,https
filter   = nginx-botsearch
logpath  = /var/log/nginx/*access.log
maxretry = 5
EOF

systemctl enable fail2ban
systemctl restart fail2ban

log "Fail2ban active — SSH (3 attempts), Nginx rate limit (10), bot scan (5)."

# ============================================================
# 5. Docker (install if missing)
# ============================================================
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  log "Docker installed."
else
  log "Docker already installed."
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
  log "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi

# ============================================================
# 6. Generate SESSION_SECRET
# ============================================================
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ] && grep -q "SESSION_SECRET" "$ENV_FILE"; then
  log "SESSION_SECRET already set in .env"
else
  SECRET=$(openssl rand -base64 32)
  mkdir -p "$PROJECT_DIR"
  if [ -f "$ENV_FILE" ]; then
    echo "SESSION_SECRET=$SECRET" >> "$ENV_FILE"
  else
    cat > "$ENV_FILE" <<EOF2
SESSION_SECRET=$SECRET
DIRECTORY_DATABASE_URL=
EOF2
  fi
  log "Generated SESSION_SECRET in $ENV_FILE"
fi

# ============================================================
# 7. HTTPS — Nginx config with Certbot
# ============================================================
log "Setting up HTTPS with Certbot..."
apt-get install -y -qq certbot

# Update Nginx config for the domain + HTTPS
NGINX_CONF="$PROJECT_DIR/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
  # Create HTTPS-ready config
  cat > "$PROJECT_DIR/nginx-ssl.conf" <<NGINXEOF
# DDoS-hardened Nginx with HTTPS — auto-generated by harden-vps.sh

limit_req_zone \$binary_remote_addr zone=general:10m rate=30r/s;
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=3r/m;
limit_req_zone \$binary_remote_addr zone=upload:10m rate=5r/m;
limit_conn_zone \$binary_remote_addr zone=connlimit:10m;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name $DOMAIN;

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # TLS certificates (Certbot)
    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Modern TLS config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS (1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Global protections
    limit_conn connlimit 20;
    client_max_body_size 10m;
    client_body_timeout 10s;
    client_header_timeout 10s;
    send_timeout 10s;
    keepalive_timeout 30s;
    server_tokens off;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Login — strict rate limit
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://orgchart:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Upload — moderate rate limit
    location /api/upload {
        limit_req zone=upload burst=10 nodelay;
        limit_req_status 429;
        client_max_body_size 5m;
        proxy_pass http://orgchart:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API — moderate rate limit
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://orgchart:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static assets — cached
    location /_next/static/ {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://orgchart:3000;
        proxy_set_header Host \$host;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        limit_req zone=general burst=30 nodelay;
        proxy_pass http://orgchart:3000;
        proxy_set_header Host \$host;
        expires 7d;
        add_header Cache-Control "public";
    }

    # All other routes
    location / {
        limit_req zone=general burst=40 nodelay;
        limit_req_status 429;
        proxy_pass http://orgchart:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Block attack paths
    location ~ /\. { deny all; }
    location ~ ^/(wp-admin|wp-login|xmlrpc|phpmyadmin|\.env|\.git) { return 444; }
}
NGINXEOF

  log "HTTPS Nginx config written to $PROJECT_DIR/nginx-ssl.conf"
fi

# Update docker-compose to mount SSL certs and certbot webroot
cat > "$PROJECT_DIR/docker-compose.prod.yaml" <<'DCEOF'
# Production override — adds HTTPS, certbot, backups
version: "3.8"
services:
  nginx:
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot_certs:/etc/letsencrypt:ro
      - certbot_www:/var/www/certbot:ro
    ports:
      - "80:80"
      - "443:443"

  # Certbot auto-renewal sidecar
  certbot:
    image: certbot/certbot
    volumes:
      - certbot_certs:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: /bin/sh
    command:
      - -c
      - |
        trap exit TERM
        while :; do
          certbot renew --quiet --webroot -w /var/www/certbot
          sleep 12h &
          wait $$!
        done
    restart: unless-stopped

  # Daily backup sidecar
  backup:
    image: alpine:3.20
    volumes:
      - orgchart_data:/data:ro
      - orgchart_uploads:/uploads:ro
      - orgchart_backups:/backups
    entrypoint: /bin/sh
    command:
      - -c
      - |
        apk add --no-cache sqlite > /dev/null 2>&1
        while true; do
          sleep 86400
          STAMP=$(date +%Y-%m-%d_%H%M)
          mkdir -p /backups
          # SQLite safe backup (not just file copy)
          sqlite3 /data/orgchart.db ".backup '/backups/orgchart-$${STAMP}.db'"
          # Compress uploads
          tar czf /backups/uploads-$${STAMP}.tar.gz -C /uploads .
          # Keep only last 14 days
          find /backups -name "*.db" -mtime +14 -delete
          find /backups -name "*.tar.gz" -mtime +14 -delete
          echo "[backup] Created backup: $${STAMP}"
        done
    restart: unless-stopped

volumes:
  certbot_certs:
  certbot_www:
  orgchart_backups:
DCEOF

log "Production docker-compose override written."

# ============================================================
# 8. Initial cert provisioning
# ============================================================
log "Obtaining initial SSL certificate..."
mkdir -p /var/www/certbot

# First, start the HTTP-only nginx temporarily for certbot challenge
# We need a minimal nginx config for this
cat > /tmp/certbot-init.conf <<INITEOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / { return 444; }
}
INITEOF

# Install nginx temporarily for cert provisioning
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
fi
cp /tmp/certbot-init.conf /etc/nginx/conf.d/certbot-init.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl restart nginx

certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERT_EMAIL" \
  --agree-tos \
  --non-interactive \
  --force-renewal || warn "Certbot failed — you may need to run it manually after DNS is pointed."

# Stop system nginx (Docker will handle it)
systemctl stop nginx
systemctl disable nginx

# Set up certbot auto-renewal timer
cat > /etc/systemd/system/certbot-renew.timer <<EOF3
[Unit]
Description=Certbot renewal timer

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=3600

[Install]
WantedBy=timers.target
EOF3

cat > /etc/systemd/system/certbot-renew.service <<EOF4
[Unit]
Description=Certbot renewal

[Service]
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "docker exec \$(docker ps -qf name=nginx) nginx -s reload"
EOF4

systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer

# ============================================================
# 9. Log rotation for Docker
# ============================================================
log "Configuring Docker log rotation..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF5
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF5
systemctl restart docker

# ============================================================
# Done
# ============================================================
echo ""
echo "============================================================"
log "VPS hardening complete!"
echo "============================================================"
echo ""
echo "  Domain:       $DOMAIN"
echo "  Project dir:  $PROJECT_DIR"
echo "  .env file:    $PROJECT_DIR/.env"
echo ""
echo "  Next steps:"
echo "    1. cd $PROJECT_DIR"
echo "    2. git pull (or copy project files)"
echo "    3. docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build"
echo ""
echo "  What was configured:"
echo "    [x] UFW firewall (22, 80, 443 only)"
echo "    [x] SSH hardened (no root, no password, key-only)"
echo "    [x] Fail2ban (SSH + Nginx)"
echo "    [x] Unattended security updates"
echo "    [x] HTTPS via Let's Encrypt (auto-renewal)"
echo "    [x] Docker log rotation (10MB x 3)"
echo "    [x] SESSION_SECRET generated"
echo "    [x] Daily backups (SQLite + uploads, 14-day retention)"
echo ""
warn "IMPORTANT: Change default passwords after first login!"
warn "  admin/admin123, editor/editor123, viewer/viewer123"
echo ""
