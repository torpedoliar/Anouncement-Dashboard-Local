# Desain: Deteksi Login Otomatis Berlapis + Bermemori (A + B + C)

Tanggal: 2026-09-03
Status: disetujui per seksi oleh user
Tujuan: deteksi otomatis jarang butuh config manual ("pintar" = cakupan),
untuk campuran aplikasi internal + appliance vendor, dengan probe tetap
**pasif** (hanya baca; tanpa submit dummy / interaksi browser otomatis).

## Masalah

Classifier generik saat ini memaksa tiap aplikasi "unik" (UniFi, MantisBT,
Microsoft) diajari lewat `if` baru di kode — usaha skala linear dengan
jumlah aplikasi. Dua aset tidak dimanfaatkan: (1) data hasil deteksi sukses
(profile + koreksi admin menumpuk di DB tanpa dipakai deteksi berikutnya),
(2) lapis browser yang mati diam-diam di production sehingga semua SPA jatuh
ke heuristik HTML-kosong.

## Seksi 1 — Arsitektur pipeline

Urutan lapis di `detect-fields`, tiap lapis independen dan fail-closed:

1. MEMORI: profile sukses + koreksi admin + registry produk (baru)
2. LADDER: HTTP → BROWSER, Browserless distabilkan (B)
3. PROBE: OpenAPI → endpoint dikenal (sudah ada)
4. ANALISIS: heuristik + product match + voting LLM (C ditingkatkan)
5. GABUNG: satu rekomendasi + bukti per lapis → kandidat profile

Lapis awal yang kuat membuat lapis akhir jarang dipanggil. Registry produk
adalah **data** (daftar pola + marker), bukan cabang classifier — tambah
produk = tambah satu entri.

## Seksi 2 — A: Memori

1. **Product fingerprint**: petakan halaman ke produk dikenal (`unifi-os`,
   `oracle-ebs`, `mantisbt`, `hris-internal`, `generic`) via marker title,
   meta generator, path khas (`/api/auth/login`, `login_password_page.php`),
   teks khas. Produk baru = satu entri registry.
2. **Recall dulu**: sebelum ladder, cek (a) koreksi admin terbaru di origin
   ini, (b) profile sukses di produk yang sama, (c) entri registry. Recall
   cocok langsung jadi kandidat confidence tinggi; ladder hanya validasi.
3. **Registry tumbuh tanpa coding**: produk tak dikenal yang lolos Uji Login
   admin otomatis terdaftar sebagai fingerprint generik ("struktur form ini
   valid") — aplikasi internal kedua yang mirip langsung dikenali.
4. Recall selalu berlabel sumber (`MEMORY: koreksi admin <tanggal>` /
   `REGISTRY: unifi-os v1`) agar bisa diaudit dan dihapus bila salah.

## Seksi 3 — B: Browser-first yang stabil

1. **Health check eksplisit**: ping `PORTAL_BROWSER_URL` dengan timeout
   pendek saat deteksi mulai; gagal → alasan spesifik (container mati /
   timeout / kontrak tak dikenal), bukan "render tidak tersedia".
2. **Render-awal paralel**: bila HTML mentah terlihat shell SPA, render
   browser jalan paralel dengan probe (bukan menunggu HTTP gagal).
3. **Snapshot diperkaya**: proyeksi browser menyertakan endpoint fetch/XHR
   login yang terlihat di network bila didukung; fallback DOM seperti kini.
4. **Degradasi jujur**: browser mati total → `browserUnavailable: true` +
   alasan di hasil; tidak ada lagi kesimpulan "tidak ada form" dari HTML
   kosong.
5. Infra (non-kode): service `browserless` ikut `docker-compose up` di
   production dengan memory cukup untuk Chromium di Hyper-V.

## Seksi 4 — C: LLM ditingkatkan

1. **Kontrak respons ketat**: kirim `response_format: json_object` bila
   provider mendukung (OpenAI/OpenRouter; Ollama diabaikan aman), fallback
   parsing toleran tetap ada.
2. **Normalisasi reasoning**: content kosong + reasoning_content ada →
   ekstrak JSON dari reasoning, bukan tampilkan mentah.
3. **Konteks bukti penuh**: prompt menerima hasil ladder + kontrak probe +
   recall memori — LLM menilai bukti, bukan menebak dari DOM mentah.
4. **Voting terbatas transparan**: heuristik + product-match + LLM memberi
   suara berbobot; bobot ditampilkan (mis. `heuristik 0.8 + registry 1.0 +
   llm 0.6 → FORM`). Tanpa kotak hitam.
5. **Budget per model**: `max_tokens` per penyedia di konfigurasi AI
   (default 2500, reasoning model disarankan ≥4000).

## Seksi 5 — Privasi LLM (syarat keras)

1. BOLEH keluar: struktur DOM terpangkas (tag/nama field, atribut semantik),
   nama field terdeteksi, origin+path URL (sudah ada `stripUrlSecrets`), nama
   produk registry.
2. TIDAK BOLEH keluar: nilai input apa pun, token/CSRF, cookie, kredensial,
   data HRIS (NIK, email, departemen, jabatan), query URL, HTML mentah.
3. Penegakan berlapis: (a) `assertSafePrompt()` memindai payload sebelum
   kirim — pola `value="..."`, email, NIK digit, token panjang → kirim
   dibatalkan + error eksplisit; (b) self-check regresi dengan data sensitif
   tiruan; (c) audit log tiap pemanggilan LLM (waktu, model, ukuran payload,
   tanpa isi).
4. Endpoint lokal didukung penuh (Ollama/LiteLLM) tanpa ubah kode.

Penerimaan: test dengan NIK/email/token palsu HARUS gagal terkirim
(dibatalkan guard) dan lolos setelah dibersihkan.

## Di luar cakupan

- Runtime SSO JSON otomatis (JSON tetap → VAULT + Uji JSON).
- Probe aktif (submit dummy / klik otomatis) — tetap pasif sesuai keputusan.
- Perbaikan P0/P1 semantic-review credential relay (jalur terpisah).
