# Deployment Guide - Announcement Dashboard

## 🚀 Quick Start (Server Baru)

```bash
# 1. Clone repository
git clone https://github.com/torpedoliar/Anouncement-Dashboard-Local.git
cd Anouncement-Dashboard-Local

# 2. Deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# 3. Akses
# http://[IP-SERVER]:3100
```

**Default Login:** `admin@example.com` / `admin123`

---

## 📦 Backup & Restore

### Backup (Server Lama)
```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
# Output: backup_YYYY-MM-DD_HH-MM-SS.tar.gz
```

### Transfer ke Server Baru
```bash
scp backup_*.tar.gz user@new-server:/path/to/project/
```

### Restore (Server Baru)
```bash
chmod +x scripts/restore.sh
./scripts/restore.sh backup_YYYY-MM-DD_HH-MM-SS.tar.gz
```

---

## ⚙️ Konfigurasi

Edit `docker-compose.yml`:

```yaml
# Port (default: 3100)
ports:
  - "8080:3000"

# Secret (GANTI untuk production!)
environment:
  - NEXTAUTH_SECRET=your-super-secret-key
  - NEXTAUTH_URL=http://your-domain.com:8080
```

> **Catatan Reverse Proxy (Nginx / Nginx Proxy Manager):**
> Jika menggunakan Nginx / NPM di depan aplikasi, pastikan menambahkan direktif `client_max_body_size 100M;` pada konfigurasi Nginx/NPM Anda agar upload video (hingga 100MB) tidak ditolak dengan status *413 Request Entity Too Large*.


---

## 📁 Data Storage

| Lokasi | Isi |
|--------|-----|
| Docker Volume `postgres_data` | Database PostgreSQL |
| `./public/uploads/` | File upload |

---

## 🔧 Commands

| Command | Deskripsi |
|---------|-----------|
| `docker-compose up -d` | Start containers |
| `docker-compose down` | Stop containers |
| `docker-compose logs -f web` | View logs |
| `docker-compose up -d --build` | Rebuild & restart |

---

## 🔄 Update Aplikasi

```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

Database otomatis ter-migrasi via `prisma db push`.
