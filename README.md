# Professional Announcement Dashboard

Dashboard pengumuman profesional dengan desain terinspirasi dari **Santos Jaya Abadi** (santosjayaabadi.co.id).

![Santos Theme](https://santosjayaabadi.co.id/assets/images/logo-white.png)

## ✨ Features

- 🎨 **Dark Premium Theme** - Desain elegan dengan warna Deep Red (#ED1C24)
- 📝 **Rich Content Management** - CRUD pengumuman dengan HTML support
- 🖼️ **Image Upload** - Upload gambar dengan validasi
- 📌 **Pinned Posts** - Pin pengumuman penting
- ⭐ **Hero Section** - Featured announcements slider
- 🏷️ **Categories** - Filter berdasarkan kategori (News, Event, Career, Internal)
- 📅 **Scheduled Publishing** - Jadwalkan publikasi otomatis
- 📊 **Analytics** - View count per pengumuman
- 🔐 **Admin Authentication** - Secure admin panel

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Styling | Tailwind CSS |
| Auth | NextAuth.js |
| Container | Docker + Compose |

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone repository
git clone <repo-url>
cd announcement-dashboard

# Start with Docker Compose
docker-compose up --build

# Access the app
open http://localhost:3000
```

### Manual Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Setup database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev
```

## 🔐 Default Credentials

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `admin123` |

> ⚠️ **Important**: Change the password after first login!

## 📁 Project Structure

```
announcement-dashboard/
├── app/
│   ├── (public)/page.tsx     # Homepage
│   ├── admin/                 # Admin CMS
│   └── api/                   # API routes
├── components/                # React components
├── lib/                       # Utilities
├── prisma/                    # Database schema
├── Dockerfile
└── docker-compose.yml
```

## 🎨 Design System

### Colors
- **Primary**: `#ED1C24` (Santos Red)
- **Background**: `#0A0A0A` (Dark)
- **Text**: `#FFFFFF` (White)

### Fonts
- **Headings**: Montserrat
- **Body**: Inter

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/announcements` | List announcements |
| POST | `/api/announcements` | Create announcement |
| GET | `/api/announcements/[id]` | Get single |
| PUT | `/api/announcements/[id]` | Update |
| DELETE | `/api/announcements/[id]` | Delete |
| POST | `/api/upload` | Upload image |
| GET/PUT | `/api/settings` | Site settings |

## 🐳 Docker Commands

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Reset database
docker-compose down -v
docker-compose up --build
```

## 📄 License

MIT © Santos Jaya Abadi Dashboard
