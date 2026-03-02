#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# IPAM Portal — Automated Setup Script
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║       IPAM Portal — Setup Wizard             ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check prerequisites ───────────────────────────────────────────────
echo -e "${BOLD}[1/7] Checking prerequisites...${NC}"

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        echo -e "${RED}✗ $1 is not installed. Please install it and re-run.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $1 found${NC}"
}

check_cmd docker
check_cmd openssl

# Check Docker daemon is running
if ! docker info &>/dev/null; then
    echo -e "${RED}✗ Docker daemon is not running. Start Docker and re-run.${NC}"
    exit 1
fi

# Check docker compose (v2 plugin)
if ! docker compose version &>/dev/null; then
    echo -e "${RED}✗ Docker Compose v2 plugin not found. Install it and re-run.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose v2 found${NC}"

echo ""

# ── Step 2: Create .env from template ─────────────────────────────────────────
echo -e "${BOLD}[2/7] Configuring environment...${NC}"

if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠  .env already exists. Skipping generation (delete it to re-run).${NC}"
else
    cp .env.example .env

    # Generate strong random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    MONGO_ROOT_PASS=$(openssl rand -base64 24 | tr -d '/+=')
    MONGO_APP_PASS=$(openssl rand -base64 24 | tr -d '/+=')

    # Prompt for admin credentials
    echo ""
    echo -e "${YELLOW}Set the initial administrator account credentials:${NC}"
    read -rp "  Admin username [admin]: " ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"

    while true; do
        read -rsp "  Admin password (min 12 chars): " ADMIN_PASS
        echo ""
        if [ ${#ADMIN_PASS} -ge 12 ]; then
            break
        fi
        echo -e "${RED}  Password must be at least 12 characters.${NC}"
    done

    # Write values into .env
    sed -i.bak \
        -e "s|CHANGE_ME_ROOT_PASSWORD|${MONGO_ROOT_PASS}|g" \
        -e "s|CHANGE_ME_APP_PASSWORD|${MONGO_APP_PASS}|g" \
        -e "s|CHANGE_ME_JWT_SECRET_64_HEX_CHARS|${JWT_SECRET}|g" \
        -e "s|CHANGE_ME_ADMIN_PASSWORD|${ADMIN_PASS}|g" \
        -e "s|INITIAL_ADMIN_USERNAME=admin|INITIAL_ADMIN_USERNAME=${ADMIN_USER}|g" \
        -e "s|mongodb://ipam_app:CHANGE_ME_APP_PASSWORD|mongodb://ipam_app:${MONGO_APP_PASS}|g" \
        .env
    rm -f .env.bak

    chmod 600 .env
    echo -e "${GREEN}✓ .env generated with secure random secrets${NC}"
fi

echo ""

# ── Step 3: Generate SSL certificate ──────────────────────────────────────────
echo -e "${BOLD}[3/7] Setting up SSL certificate...${NC}"

mkdir -p nginx/ssl

if [ -f "nginx/ssl/cert.pem" ] && [ -f "nginx/ssl/key.pem" ]; then
    echo -e "${YELLOW}⚠  SSL cert already exists. Skipping generation.${NC}"
else
    echo ""
    echo "  Choose SSL certificate option:"
    echo "  1) Self-signed certificate (for development / testing)"
    echo "  2) I have my own cert.pem and key.pem — copy them manually"
    echo ""
    read -rp "  Choice [1]: " SSL_CHOICE
    SSL_CHOICE="${SSL_CHOICE:-1}"

    if [ "$SSL_CHOICE" = "1" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=AZ/ST=Baku/L=Baku/O=IPAM Portal/CN=ipam-portal.com" \
            -addext "subjectAltName=DNS:ipam-portal.com,DNS:localhost,IP:127.0.0.1" \
            2>/dev/null
        chmod 600 nginx/ssl/key.pem
        echo -e "${GREEN}✓ Self-signed certificate generated (valid 365 days)${NC}"
        echo -e "${YELLOW}  Note: Browser will show a security warning — this is normal for self-signed certs.${NC}"
    else
        echo -e "${YELLOW}  Please copy cert.pem and key.pem into nginx/ssl/ then re-run setup.${NC}"
        exit 0
    fi
fi

echo ""

# ── Step 4: Build Docker images ───────────────────────────────────────────────
echo -e "${BOLD}[4/7] Building Docker images...${NC}"
echo "  This may take a few minutes on first run."
echo ""
docker compose build 2>&1 | sed 's/^/  /'
echo -e "${GREEN}✓ Images built${NC}"
echo ""

# ── Step 5: Start the stack ───────────────────────────────────────────────────
echo -e "${BOLD}[5/7] Starting services...${NC}"
docker compose up -d
echo ""

# ── Step 6: Wait for health checks ────────────────────────────────────────────
echo -e "${BOLD}[6/7] Waiting for services to become healthy...${NC}"

wait_healthy() {
    local service=$1
    local max_wait=60
    local elapsed=0
    printf "  Waiting for ${service}"
    while true; do
        status=$(docker compose ps --format json "$service" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health','') if isinstance(d,dict) else '')" 2>/dev/null || echo "")
        if [ "$status" = "healthy" ]; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        if [ "$elapsed" -ge "$max_wait" ]; then
            echo -e " ${RED}✗ Timed out${NC}"
            docker compose logs --tail=20 "$service"
            return 1
        fi
        printf "."
        sleep 3
        elapsed=$((elapsed + 3))
    done
}

wait_healthy mongodb
wait_healthy api
echo ""

# ── Step 7: Print summary ─────────────────────────────────────────────────────
echo -e "${BOLD}[7/7] Setup complete!${NC}"
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║                    IPAM Portal is Ready                      ║${NC}"
echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}${BOLD}║${NC}  URL:       ${GREEN}https://ipam-portal.com${NC} (or https://localhost)  ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  Username:  $(grep INITIAL_ADMIN_USERNAME .env | cut -d= -f2)                                           ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  Password:  (as entered during setup)                          ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}${BOLD}║${NC}  IMPORTANT NEXT STEPS:                                         ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  1. Open https://localhost and accept the SSL warning           ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  2. Log in with the admin credentials above                    ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  3. Go to Profile → Change Password                            ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  4. Remove INITIAL_ADMIN_PASSWORD from .env                    ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}║${NC}  5. Add subnets, then add IP records                           ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}${BOLD}║${NC}  Commands:  make logs | make shell-api | make backup            ${CYAN}${BOLD}║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
