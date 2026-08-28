# TASK-28: SSO-HRIS Gateway Sync — Architectural Design

**Owner:** jim-mtbo7l8z (Architect)  
**Status:** DRAFT — awaiting sign-off before Wave 2 build  
**Depends on:** kevin-mtbodn7f’s research (TASK-27) — uses assumed API shapes where research not available  

---

## Executive Summary

Design for integrating **Portal SSO ↔ HRIS gateway** to enable:
1. **JIT provisioning**: auto-create PortalUser when NIK found in HRIS but missing locally
2. **Periodic sync**: refresh employee eligibility/name/email status from HRIS
3. **Admin-configurable gateway**: store baseURL/API key encrypted in DB, test connectivity
4. **Eligibility-aware deactivation**: employees marked non-eligible/non-active in HRIS → `isActive=false` in PortalUser

**Non-goals** (out of scope):  
- Changing existing password validation flow in `lib/portal-auth.ts` (gateway NOT for password auth)
- Onboarding wizard UI changes (visibility logic unchanged)
- Password resets or credential management via HRIS

---

## 1) Schema Diff: Prisma Models & Migration Strategy

### 1.1 Add Fields to `PortalUser`

| Field | Type | Nullable | Unique? | Default | Notes |
|---|---|---|---|---|---|
| `email` | `String` | yes | no | — | From HRIS lookup; may differ from portal login NIK |
| `nikHris` | `String` | yes | no | — | Aliasing field used by some HRIS instances; denormalized from response |
| `nikSantos` | `String` | yes | no | — | Primary SANTOS identifier from HRIS response (`nik_santos`) |
| `eligible` | `Boolean` | no | no | `true` | Sync source-of-truth flag from HRIS `eligible`; `false` = block access |
| `lastSyncAt` | `DateTime` | yes | no | — | Timestamp of last successful HRIS sync |

> **Rationale**: Keep `nik` as portal-login primary key (existing). Add explicit HRIS identifiers separately to support cross-reference audits and migration paths. `eligible` mirrors HRIS “active employee” status; combined with global `isActive`, both must be true to access portal.

**Migration approach**: **ADDITIVE ONLY** — all columns nullable+defaulting where safe. Zero-downtime pattern:
1. Add columns (nullable, no defaults that break inserts)
2. Backfill if historical mapping available (optional phase 2)
3. Application gates check both `isActive AND eligible`
4. Optional later: make `eligible` non-null with default `true` after backfill complete

### 1.2 New Model: `HrisGatewayConfig`

Option A (recommended): **New singleton model** `HrisGatewayConfig` replacing config entries currently stored in `Settings` (global) or per-site in `SiteSettings`. Rationale: HRIS gateway is enterprise-wide, scoped globally (null siteId), with audit fields required.

```prisma
model HrisGatewayConfig {
  id           Int         @id @default(1) // Singleton like Settings/EmailSettings
  baseUrl      String
  apiKeyEncrypted String    // AES-256-GCM blob via lib/portal-crypto.ts encryptCredential
  enabled      Boolean     @default(false)
  lastSyncAt   DateTime?
  lastPingAt   DateTime?
  pingError    String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@map("hris_gateway_config")
}
```

**Why singleton?**  
- One HRIS gateway per organization
- No per-site variation needed
- Aligns with existing singleton patterns: `Settings`, `EmailSettings`

Option B (alternate): extend `Settings` model with nullable HRIS fields. **Rejected** due to cross-domain coupling (brand settings vs integration configs) and audit trail requirements.

### 1.3 Indexes & Constraints

- `HrisGatewayConfig`: none beyond PK (singleton)
- `PortalUser`: index on `(nikHris)`, `(nikSantos)`, `(eligible)` for filter performance
- Optional unique constraint on `(nikSantos)` once data validated (phase 2)

### 1.4 Migration Steps (Additive)

```
1. ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS email TEXT NULL;
2. ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS nik_hris TEXT NULL;
3. ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS nik_santos TEXT NULL;
4. ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS eligible BOOLEAN DEFAULT TRUE NOT NULL;
5. ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE NULL;
6. CREATE TABLE hris_gateway_config (id 1 PK, ...);
```

Prisma steps (schema change only, no code):
- Run `prisma migrate dev --name add_hris_fields_to_portaluser_and_new_config`
- Run `prisma generate`

---

## 2) JIT (Just-in-Time) Provisioning Flow

### 2.1 Trigger Points

JIT activates when:
- User attempts portal login via NIK
- Backend calls HRIS gateway `/auth/lookup` endpoint with NIK
- Response: `{ valid: true, eligible: true }` (or equivalent success shape)
- **Condition**: user exists in `portal_users`? If NO → proceed to JIT creation

### 2.2 PortalUser Creation Logic

Fields populated from lookup response:
- `nik`: from request (login attempt)
- `name`: from `nama_karyawan` in response
- `email`: from `email` in response
- `nikHris`: from `nik_hris`
- `nikSantos`: from `nik_santos`
- `passwordHash`: **NOT SET** (see decision below)
- `eligible`: set to `true` from response
- `isActive`: set to `true` (assumption; gate by both `isActive && eligible`)

### 2.3 Critical Decision: Password Handling for JIT Accounts

**Decision: JIT accounts created without `passwordHash` (NULL), requiring first-time password setup before login.**

**Reasoning:**
1. HRIS gateway does NOT provide password; passwords are owned by HRIS users independently
2. Portal authentication (`lib/portal-auth.ts`) remains **unchanged** — it validates `passwordHash`. Setting one via gateway would imply HRIS password exposure (security risk).
3. Two-phase account lifecycle:
   - **Phase A (JIT)**: user created with `eligible=true`, `passwordHash=NULL`
   - **Phase B (Activation)**: user visits “set password” page post-JIT or during first login attempt, sets their password securely
4. UX fallback on login attempt when `passwordHash=NULL`:
   - Show friendly message: “Akun Anda terdaftar namun belum aktif. Silakan atur kata sandi terlebih dahulu.” + link to set-password flow
   - Do NOT allow login until password set

**Alternative considered (rejected):**
- Auto-generate ephemeral password + email invitation: higher friction, external mail dependency, adds complexity (token expiry, reset flows). Not required for MVP.

### 2.4 Sequence Diagram (JIT Provisioning)

```
Browser                    Portal App                  HRIS Gateway          DB
  |                        |                           |                     |
  |-- Login(NIK,Pwd) ----->|                           |                     |
  |                        |-- POST /auth/lookup ------>|                     |
  |                        |<- {valid:true,eligible:true,name,email...} -     |
  |                        |                             |                     |
  |                        |-- Check PortalUser(NIK)?--|                     |
  |                        |                             |                     |
  |                        +--[NO] Create PortalUser---+                     |
  |                        |   • name,email,nikHris,            |             |
  |                        |     nikSantos,eligible=true        |             |
  |                        |   • passwordHash=NULL              |             |
  |                        |                              <--[INSERT]       |
  |                        |                             |                     |
  |                        |                             |                     |
  |                        <--[Return:needs_password_setup]               |
  |--"Set password first">-|                           |                     |
  |                        |                             |                     |
```

### 2.5 Edge Cases & Guardrails

| Case | Behavior |
|---|---|
| Lookup returns `valid: false` | Reject login: “NIK tidak valid di HRIS” |
| Lookup returns `eligible: false` | Reject login: “Akun belum terverifikasi di sistem HR. Hubungi admin.” |
| Lookup network timeout | Fallback to local check; log error; do NOT create JIT unless explicit retry policy confirms HRIS validity |
| Duplicate creation race condition | Use `nik UNIQUE` at DB level + transactional guard; idempotent by NIK check |

---

## 3) Periodic Sync Job

### 3.1 Sync Scope & Frequency

**What to sync (periodic job):**
- `name` (from `nama_karyawan`)
- `email` (primary corporate email)
- `nikHris` (if different from NIK)
- `nikSantos`
- `eligible` (maps directly to `isActive` gating; non-eligible → deactivate)

**Frequency options:**
1. **Scheduled cron**: every 6 hours (recommended for MVP)
2. **Admin-triggered manual run**: via Admin UI button (operational need)
3. **Event-driven** (future): webhook from HRIS on employee state change (not MVP)

### 3.2 Conflict Resolution Policy

When HRIS data conflicts with manual edits in portal:

**Decision: HRIS authoritative (overwrite).** Rationale:
- HRIS is system-of-record for employment status and identity
- Manual portal edits should be temporary/localized; long-term fidelity requires HRIS wins
- Mitigation: log all overrides in `AuditLog` with category `CONFIG` or `USER_MGMT`

Conflict handling:
- Sync upserts: update existing `PortalUser` where `nik` matches
- Only overwrite fields listed in scope above
- Preserve portal-specific fields: `avatar`, `role`, `onboardingDone` (not touched)
- Deactivation rule: if HRIS `eligible=false` → set `PortalUser.isActive = false AND PortalUser.eligible = false`

### 3.3 Implementation Pattern

**Job file**: `scripts/hris-sync.ts` (one-off executable via cron or manual trigger)

Steps:
1. Fetch `HrisGatewayConfig` (enabled=true, decrypted `apiKey`, `baseUrl`)
2. For each batch of NIKs to sync (full table or incremental by `lastSyncAt`):
   - Call `POST /auth/lookup` with `{nik}`
   - Apply updates using conflict policy above
   - Record errors individually; continue batch
3. Update `lastSyncAt` per row; record aggregate stats in metadata
4. Log summary audit event via `logAudit`

Optional: expose `/api/hris-sync/run` protected by `CRON_SECRET` for internal scheduling systems.

### 3.4 Error Handling & Idempotency

- Retries with exponential backoff (max 3 retries) on transient HTTP 5xx
- Rate-limit aware: respect gateway rate headers if present; otherwise throttle to 10 req/sec to avoid overloading
- Idempotent: re-running same sync produces identical results; no duplicate entries

### 3.5 Audit & Observability

Per-run `AuditLog`:
- `category`: `SYSTEM`
- `action`: `HRIS_SYNC_RUN`
- `metadata`: `{ totalProcessed, updated, deactivated, failedCount, errors: [...] }`
- Severity: `INFO` on success, `WARNING` on partial, `ERROR` on failure

---

## 4) Admin Configuration: Endpoint + UI Hooks

### 4.1 Data Access

- Config stored in `HrisGatewayConfig` singleton
- `baseUrl`: plain text
- `apiKey`: encrypted via `encryptCredential()` wrapper around `PORTAL_CREDENTIAL_KEY`
- Decryption happens server-side at runtime; never return plaintext key to client

### 4.2 API Endpoints (Builder will implement)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hris/config` | SuperAdmin only | Read config (baseUrl masked partially, encryption status) |
| POST | `/api/hris/config` | SuperAdmin only | Save/update config (accepts raw `apiKey`; server encrypts) |
| POST | `/api/hris/ping` | SuperAdmin only | Test connectivity: call HRIS `/ping`, store `healthStatus` in config |
| POST | `/api/hris/sync` | SuperAdmin only | Trigger manual sync run (async) |

Request body shapes:
```json
{ "baseUrl": "http://10.10.6.51:27080", "apiKey": "plain-text-key-to-encrypt" }
```

Response includes:
```json
{ "id": 1, "baseUrl": "http://10.10.6.51:27080", "apiKeyEncrypted": "...", "enabled": true, "lastPingAt": ..., "pingError": null }
```

Note: In responses, optionally show `baseUrlFull` (clear) and hide `apiKey` entirely; UI should require re-entry on edit.

### 4.3 UI Hooks (Designer/Builder handoff)

Admin panel area: **Settings > HRIS Gateway Integration** (new section under Admin)

Sections:
1. **Connection Settings**
   - Base URL input (text)
   - API Key input (password type; shows asterisks)
   - Save button (POST `/api/hris/config`)
   - Show encryption note: “API key dienkripsi dengan AES-256-GCM menggunakan PORTAL_CREDENTIAL_KEY”

2. **Health Status**
   - Last ping timestamp
   - Status badge: ONLINE / DEGRADED / OFFLINE
   - “Test Connection” button (POST `/api/hris/ping`)
   - Error message display

3. **Sync Controls**
   - Next scheduled time (if cron configured externally)
   - “Run Sync Now” button (POST `/api/hris/sync`)
   - Last sync result summary

### 4.4 Encryption Responsibilities

Use `lib/portal-crypto.ts`:
- On save: `encryptCredential({ username: "hris-admin", password: apiKey })` — aligns with existing credential model, future-proofing
- On use (ping/sync): decrypt to retrieve `apiKey`
- Never log plaintext credentials; reuse `logAudit` redaction behavior

---

## 5) Authentication Boundary: What Stays Unchanged

### 5.1 PortalAuth.ts Contract Preserved

**Invariant:** `lib/portal-auth.ts` continues to be sole password validator for existing accounts. Gateway integration does NOT bypass or replace this.

Changes to `portalAuthOptions.authorize()`:
- No modifications to `compare(credentials.password, user.passwordHash)` path
- No new password validation via HRIS
- New early-check branch (after NIK lookup):
  - If `!PortalUser` AND lookup indicates `valid+eligible` → **return special marker** indicating JIT creation required
  - Builder routes that marker to JIT creation service layer before returning auth token

### 5.2 Access Gating Rules

For any authenticated session to access protected portal resources:
```
PortalUser.active == true AND PortalUser.eligible == true
```

If `eligible=false`:
- Block: reject login even if password correct (but password checked locally first)
- Error: “Akun dinonaktifkan karena tidak aktif di HRIS. Hubungi administrator.”

### 5.3 Session Lifecycle

Unchanged:
- JWT strategy with DB-backed session revocation
- Cookie names: `portal-auth.session-token`, etc.
- MaxAge defaults: 12 hours

New session audit event:
- `action: PORTAL_JIT_PROVISIONED` (when JIT account created)
- `actorType: SYSTEM` (since triggered by user-initiated login flow)

---

## Decisions Log

| ID | Topic | Decision | Rationale | Owner | Date |
|---|---|---|---|---|---|
| D1 | PortalUser schema additions | Add `email`, `nikHris`, `nikSantos`, `eligible`, `lastSyncAt` fields | Enable JIT provision data population and eligibility gates | Architect | 2026-08-27 |
| D2 | HrisGatewayConfig location | New singleton model vs extending Settings | Cleaner separation of concerns; aligned with audit needs | Architect | 2026-08-27 |
| D3 | JIT password strategy | No `passwordHash` at JIT creation; require first-set flow | Security: no HRIS password exposure; minimal friction MVP | Architect | 2026-08-27 |
| D4 | Conflict resolution | HRIS authoritative (overwrite) on sync | HRIS is system of record; maintain data integrity | Architect | 2026-08-27 |
| D5 | Sync frequency | Cron every 6h + manual trigger | Operational simplicity; acceptable staleness window | Architect | 2026-08-27 |
| D6 | Password validation boundary | Keep `lib/portal-auth.ts` unchanged; gateway = lookup/provision only | Avoid password transport risks; preserve proven auth flow | Architect | 2026-08-27 |

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| HRIS downtime blocks JIT | High | Medium | Cache recent valid lookups briefly (15 min); degrade gracefully with admin contact note |
| Credential storage misconfiguration | Critical | Low | Enforce mandatory `PORTAL_CREDENTIAL_KEY` at startup; fail-closed |
| Race condition on concurrent JIT creation | Medium | Low | DB unique constraint on `nik`; transactional guard in service layer |
| Over-deactivation due to sync errors | Medium | Low | Partial sync failures logged per-user; manual override UI path |
| Legacy data mismatches (old NIKs) | Low | Medium | Phase 2: bulk import mapping table; migration script |

---

## Open Questions

1. Does HRIS provide historical snapshots for auditing (name/email changes over time)? If yes, consider `PortalUserHistory` model for full lineage.
2. Should we store `eligibilitySource` enum (“HRIS”, “ADMIN”) for audit transparency? Optional enhancement.
3. Do we want a visible “HRIS Verified” badge in profile UI post-JIT? (Designer scope.)

---

## Next Steps

1. Kevin (Scholar) completes TASK-27 research to confirm exact API shapes, response codes, and rate limits → update Section 2–3 assumptions
2. Jim (Architect) signs off this draft → mark PLANNED
3. Oscar (Builder) implements in wave:
   - Phase 1: Schema migrations + backend service layers (lookup/provision/sync/ping)
   - Phase 2: Admin UI hooks
   - Phase 3: Scheduler wiring (cron/manual)
4. Angela (Verifier) writes UAT criteria and tests against HRIS staging (if available)
5. Kelly (Reviewer) audits security posture (encryption, secrets, audit coverage)

---

**Document status:** DRAFT  
**Awaiting:** Kevin’s research findings (TASK-27) for refinement; then Director sign-off to proceed to implementation.
