#!/bin/bash
# ===========================================
# DEPLOY SCRIPT - Announcement Dashboard
# ===========================================
# Jalankan di server baru: ./deploy.sh
# 

set -e

echo "=========================================="
echo "  Deploy Announcement Dashboard"
echo "=========================================="

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker tidak terinstall!"
    echo "Install dengan: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose tidak terinstall!"
    exit 1
fi

echo "✓ Docker detected"

# Check if already running
if docker ps | grep -q "announcement-dashboard"; then
    echo ""
    read -p "Container sudah berjalan. Stop dan rebuild? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        echo "Stopping containers..."
        docker-compose down
    else
        echo "Deploy dibatalkan."
        exit 0
    fi
fi

# Build and start
echo ""
echo "[1/2] Building containers..."
docker-compose build

echo ""
echo "[2/2] Starting containers..."
docker-compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 15

# Check status
echo ""
echo "=========================================="
echo "  ✓ Deploy Complete!"
echo "=========================================="
echo ""
docker-compose ps
echo ""
echo "Akses aplikasi di: http://$(hostname -I | awk '{print $1}'):3100"
echo ""
echo "Default login:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo ""
echo "⚠️  Jangan lupa ganti password setelah login!"
echo ""
