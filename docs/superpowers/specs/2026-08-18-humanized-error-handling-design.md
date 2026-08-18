# Humanized Error Handling Design

**Tanggal**: 2026-08-18

## Tujuan
Menyediakan pengalaman pengguna (UX) yang lebih baik saat terjadi error di sisi klien, menggunakan bahasa Indonesia yang ramah (humanized) dan mudah dipahami, tanpa menambahkan dependensi baru (menggunakan ekosistem SJA dan Tailwind yang sudah ada).

## Pendekatan
1. **Toast UI System**: Membuat context provider kustom (`ToastProvider`) dan UI Toast melayang di pojok kanan bawah menggunakan token desain bawaan SJA (`bg-surface-elevated`, `shadow-lvl-3`, dll).
2. **Error Humanizer**: Membuat fungsi utilitas (`lib/error-humanize.ts`) yang memetakan kode status HTTP dan error bawaan sistem (seperti pesan Prisma/Network yang bocor ke frontend) menjadi kalimat deskriptif dalam Bahasa Indonesia.
3. **Global Error Boundaries**: Menambahkan `app/error.tsx` dan `app/not-found.tsx` untuk mencegah layar putih (crash) dan menampilkan UI "Oops" yang cantik.

## Arsitektur
- `components/ui/Toast.tsx`: Komponen visual individual untuk notifikasi.
- `components/providers/ToastProvider.tsx`: Context API untuk menampung state array of toasts. Membungkus `app/layout.tsx`.
- `lib/error-humanize.ts`: Berisi kamus pemetaan dan fungsi `humanizeError(error: unknown): string` yang mengembalikan pesan yang aman dan ramah untuk dibaca user.
- `app/error.tsx`, `app/not-found.tsx`: Error boundary bawaan App Router, mendukung reset (`reset()`).
