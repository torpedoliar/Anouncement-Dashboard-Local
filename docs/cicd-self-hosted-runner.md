# Panduan CI/CD GitHub → Server Produksi (Self-Hosted Runner)

Panduan generik untuk project lain yang saat ini di-update manual: push ke `main`,
lalu jalankan `update.ps1` / `update.bat` / `update.sh` di server. Setelah setup ini,
push ke `main` otomatis men-trigger deploy — script yang sama tetap dipakai, hanya
kini GitHub yang menjalankannya. Log & status terlihat di tab **Actions** di GitHub.

Contoh penerapan nyata di repo ini: `.github/workflows/ci.yml` + `deploy.yml`.

---

## 1. Konsep (30 detik)

```
git push origin main
  → [CI]  GitHub menjalankan lint + build di cloud. Gagal = berhenti, server tidak disentuh.
  → [CD]  CI hijau → runner kecil di server produksi menjalankan update script kamu.
```

- **Runner** = program kecil yang dipasang di server, mendengarkan GitHub lewat
  koneksi **outbound** — **tidak perlu buka port** di server.
- **Secret aman**: `.env.server` / credential tetap di server, tidak pernah dikirim ke GitHub.
  Runner menjalankan script lokal, persis seperti kamu menjalankannya manual.

---

## 2. Pasang runner di server (sekali saja, ±10 menit)

1. GitHub repo → **Settings → Actions → Runners → New self-hosted runner**.
2. Pilih OS server (contoh: Windows x64), ikuti wizard:
   ```powershell
   # download & extract (link dari wizard)
   ./config.cmd   # jawab pertanyaan; saat diminta LABELS isi: production
   ./svc install  # jadikan Windows service → jalan terus walau server restart
   ./svc start
   ```
3. Label `production` harus cocok dengan `runs-on: [self-hosted, production]` di deploy.yml.
4. Pastikan dari akun service runner bisa memanggil: `git`, `docker` / `docker-compose`
   (atau perintah lain yang dipakai update script), dan akses folder project.

> Linux server: wizard-nya sama (`./config.sh`, `./svc.sh install`).

---

## 3. File workflow

Buat `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate   # hapus jika project bukan Prisma
      - run: npm run lint
      - run: npm run build         # tambah env dummy bila build perlu secret
        env:
          NEXTAUTH_URL: http://localhost:3000
          NEXTAUTH_SECRET: ci-dummy-secret-build-only
```

Buat `.github/workflows/deploy.yml` — **pilih salah satu** sesuai script update kamu:

**Varian A — `update.ps1` (Windows):**

```yaml
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    if: >
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.head_branch == 'main'
    runs-on: [self-hosted, production]
    timeout-minutes: 30
    steps:
      - name: Deploy via update.ps1
        working-directory: 'C:\path\ke\project\di\server'   # ← SESUAIKAN
        shell: pwsh
        run: ./update.ps1
```

**Varian B — `update.bat` (cmd):** ganti step-nya saja:

```yaml
      - name: Deploy via update.bat
        working-directory: 'C:\path\ke\project\di\server'
        shell: cmd
        run: update.bat
```

**Varian C — `update.sh` (bash; runner Windows pakai Git Bash):**

```yaml
      - name: Deploy via update.sh
        working-directory: 'C:\path\ke\project\di\server'
        shell: bash
        run: ./update.sh
```

Runner Linux? Sama saja: `runs-on: [self-hosted, production]` tetap, `shell: bash`.

---

## 4. Sunting update script (opsional tapi disarankan: downtime 5 menit → 5 detik)

Pola umum script lama yang bikin downtime: `down → pull → build --no-cache → up`.
Selama build 2–5 menit, app mati. Urutan yang benar:

1. **Cek secret/backup dulu** (fail-fast sebelum menyentuh container)
2. `git pull` **sambil app masih jalan**
3. `build` **tanpa** `--no-cache` (pakai cache, jauh lebih cepat)
4. Swap **hanya container app** — `docker-compose up -d --no-deps web`
   (db & service pendukung tetap hidup; migrasi schema dijalankan container app
   lewat `prisma migrate deploy`, bukan container db)
5. Migrate + verifikasi

Contoh lengkap: `update.ps1` di repo ini. Build gagal = app lama tetap jalan, zero downtime.

---

## 5. Checklist go-live

- [ ] 3 file workflow ter-commit & ter-push ke `main`
- [ ] Runner hijau (Idle) di Settings → Actions → Runners
- [ ] `working-directory` di deploy.yml = path folder project **di server**
- [ ] Repo di server sudah set remote GitHub & `git pull` manual berhasil
- [ ] Test pertama: push commit kecil → pantau tab Actions → cek app di server

## Troubleshooting cepat

| Gejala | Sebab umum |
|---|---|
| Deploy job stuck di "Waiting for a runner" | Label runner tidak cocok dengan `runs-on`, atau service runner mati |
| `git pull` gagal saat deploy | File .git terkunci (Defender/antivirus) — lihat update.ps1 repo ini |
| Deploy jalan tapi script gagal | Baca log step di tab Actions; biasanya env/secret tidak terbaca dari akun service |
| Dua deploy bertumpuk | Sudah dicegah `concurrency` — deploy berikutnya antre, tidak tabrakan |
