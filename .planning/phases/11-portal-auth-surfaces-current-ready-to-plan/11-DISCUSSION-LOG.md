# Phase 11: Portal & Auth Surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 11-portal-auth-surfaces
**Areas discussed:** Portal grid presentation, Auth frame design, Portal ledgers family, Visual verification

---

## Portal grid presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Restyle in-place | Pertahankan struktur DOM/grouping GroupedAppGrid, skin token-only — risiko kecil | |
| Restructure grouping | Chips kategori + grid responsive, lebih bebas visual | ✓ |

**User's choice:** Restructure grouping
**Notes:** Access semantics tetap frozen (OPD-1) — hanya presentasi yang direstruktur.

---

## Auth frame design

| Option | Description | Selected |
|--------|-------------|----------|
| Centered card brand | portal-login & admin-login: centered card + brand mark + app name + inline error | ✓ |
| Split panel | Layout side-brand panel | |

**User's choice:** Centered card brand
**Notes:** Termasuk admin-login, sesuai keputusan boundary yang diperluas.

---

## Portal ledgers family

| Option | Description | Selected |
|--------|-------------|----------|
| Table kit family | Seragam Table kit seluruh 5 desk portal | ✓ |
| Hybrid timeline | Timeline rail untuk portal-audit | |

**User's choice:** Table kit family
**Notes:** Menjaga konsistensi dengan desk admin; hybrid did defer.

---

## Verification direction

| Option | Description | Selected |
|--------|-------------|----------|
| Gates + dokumentasi | tsc/eslint/static grep sebagai gate; screenshot bila environment memungkinkan | ✓ |
| Upaya screenshot wajib | Paksa render dev walau env rusak | |

**User's choice:** Gates + dokumentasi
**Notes:** Environment dev/build broken (PRE-1); verifikasi visual bersifat bonus, bukan awal.

---

## Claude's Discretion

- Card composition (icon square, hover raise), skeleton shapes, breakpoint pilihan dalam 2/3/4.
- Micro-copy Indonesian sekunder.

## Deferred Ideas

- Timeline rail untuk portal-audit (jika kemudian diinginkan) — fase tersendiri.
- Split-panel login — tidak diambil.
- OPD-2 REROUTE/VAULT enum officialization.