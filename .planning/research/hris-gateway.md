# Riset HRIS Gateway API Integration

**Tiket:** TASK-27  
**Tanggal:** 2026-08-27  
**Mode:** Riset  
**Verdict:** researched

---

## Pertanyaan

Bagaimana cara mengkonsumsi HRIS Gateway REST API untuk integrasi portal SSO dengan aman, efisien, dan sesuai best practice?

## Sudah pernah diputuskan?

Tidak ada ADR terkait HRIS gateway. Roadmap menandai "SSO modes REDIRECT/PROXY/TOKEN" sebagai future work. Ini riset pertama untuk integrasi eksternal API.

## Temuan

### 1. Cara Panggil Tiap Endpoint

**Base URL:** `http://10.10.6.51:27080`  
**Headers wajib:** `X-API-Key: {apiKey}`, `Content-Type: application/json`

#### GET /ping
```bash
curl -H "X-API-Key: ${API_KEY}" \
     -H "Content-Type: application/json" \
     http://10.10.6.51:27080/ping
```
Response: `200 OK` (health check)

#### POST /auth/lookup
```bash
curl -X POST \
     -H "X-API-Key: ${API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"nik":"12345"}' \
     http://10.10.6.51:27080/auth/lookup
```
Response:
```json
{
  "valid": true,
  "eligible": true,
  "nama_karyawan": "John Doe",
  "email": "john.doe@company.com",
  "nik_hris": "12345",
  "nik_santos": "EMP001"
}
```

#### POST /auth/verify
```bash
curl -X POST \
     -H "X-API-Key: ${API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"nik":"12345","password":"secret123"}' \
     http://10.10.6.51:27080/auth/verify
```
Response:
```json
{
  "valid": true,
  "match": true
}
```

### 2. Response Shape & Error Codes

| Endpoint | Status | Response |
|----------|--------|----------|
| GET /ping | 200 | `{ "status": "ok" }` |
| POST /auth/lookup | 200 | `{ valid, eligible, nama_karyawan, email, nik_hris, nik_santos }` |
| POST /auth/verify | 200 | `{ valid, match }` |
| - | 401 | `{ error: "Invalid API key" }` |
| - | 404 | `{ error: "NIK not found" }` |
| - | 500 | `{ error: "Internal server error" }` |

### 3. Best Practice: Timeout, Retry, Rate-Limit, Idempotency

**Timeout:** 10 detik (align dengan `portal-fetch-html.ts` existing pattern)
```typescript
signal: AbortSignal.timeout(10000)
```

**Retry Policy:** Exponential backoff untuk 5xx errors only
- 1st retry: 1s
- 2nd retry: 2s  
- 3rd retry: 4s
- Max retries: 3
- Never retry 4xx (client error)

**Rate Limit:** Respect server-side limits; implement client-side throttle max 10 req/min per API key

**Idempotency:** 
- GET /ping: idempotent (safe)
- POST /auth/lookup: idempotent (read-only)
- POST /auth/verify: NOT idempotent (side effect: may trigger lockout counter on HRIS side)

### 4. Keamanan

**DO:**
- Simpan API key di database terenkripsi (AES-256-GCM via `lib/portal-crypto.ts`)
- Log request/response tanpa sensitive fields
- Sanitize NIK dari log (mask: `123**`)

**DON'T:**
- Jangan log API key, password, atau full NIK
- Jangan expose HRIS error messages langsung ke user (bisa leak info)
- Jangan bypass HTTPS untuk production (HTTP only untuk internal dev)

### 5. Rekomendasi Library/Pattern

**Rekomendasi:** Native `fetch` dengan helper pattern dari `lib/portal-fetch-html.ts`

Alasan:
- Sudah ada pola timeout + manual redirect handling
- Tidak perlu dependency baru (axios, node-fetch)
- Consistent dengan codebase existing
- Support AbortSignal untuk cancellation

Pattern:
```typescript
async function callHrisApi(endpoint: string, body: object) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  
  if (!res.ok) throw new HrisError(`HTTP ${res.status}`);
  return res.json();
}
```

### 6. Implikasi API Key + BaseURL di DB Terenkripsi

**Storage:**
- `PortalApp.apiKey` → encrypted via `encrypt()` dari `lib/portal-crypto.ts`
- `PortalApp.baseUrl` → encrypted (jika sensitive) atau plain (jika public endpoint)

**Runtime:**
- Decrypt saat server-side render/API call only
- Never expose decrypted key ke client
- Cache decrypted key di memory dengan TTL 5 menit (avoid decrypt per request)

**Rotation:**
- Support multiple keys per app (key versioning)
- Graceful fallback jika key expired

## Pilihan

### A — Native fetch dengan helper (Recommended)
- Berubah: Tambah `lib/hris-gateway.ts` dengan `callHrisApi()` function
- Positif: No new deps, consistent dengan existing code, full control
- Negatif: Perlu implement retry logic manual
- Sulit dibalik: Tidak (pure function, easy to refactor)

### B — Axios dengan interceptors
- Berubah: Tambah dependency axios, setup interceptors untuk auth/retry
- Positif: Built-in retry, timeout, error handling
- Negatif: New dependency, overkill untuk 3 endpoints
- Sulit dibalik: Sedang (harus remove dep)

### C — tRPC / GraphQL wrapper
- Berubah: Setup tRPC router untuk HRIS endpoints
- Positif: Type-safe, auto-generated client
- Negatif: Overkill untuk simple REST, setup complexity
- Sulit dibalik: Ya (architectural commitment)

## Rekomendasi

**Pilih A — Native fetch dengan helper**, karena:
1. Hanya 3 endpoints sederhana, tidak butuh framework complexity
2. Sudah ada pola `portal-fetch-html.ts` sebagai referensi
3. Zero new dependencies (align dengan constraint D6)
4. Easy to test dengan mock fetch

## Belum saya verifikasi

- Response time aktual dari gateway (tidak bisa probe dari sesi ini)
- Rate limit spesifik dari server side
- Apakah ada endpoint tambahan tidak terdokumentasi
- Behavior lockout counter di HRIS side setelah failed verify
- Format error response detail (hanya assume standard JSON error)

## Sumber

| # | Klaim | Sumber | Terverifikasi? |
|---|-------|--------|----------------|
| 1 | Endpoint URLs & request/response shape | Task dispatch dari Director | ya |
| 2 | Timeout 10s pattern | `lib/portal-fetch-html.ts:129` | ya, dibaca |
| 3 | AES-256-GCM encryption | `lib/portal-crypto.ts` | ya, dibaca |
| 4 | No new dependencies constraint | PROJECT.md D6 | ya |
| 5 | Fetch retry best practice | MDN Web Docs (general knowledge) | tidak perlu verifikasi eksternal |
| 6 | API key storage pattern | Inferred dari existing credential storage | ya, analogi |

---

*Dokumen ini untuk keputusan arsitektur, bukan implementasi.*
