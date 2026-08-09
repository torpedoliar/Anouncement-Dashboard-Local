# Laporan Investigasi Kendala SSO Reroute Oracle EBS

## Latar Belakang
Implementasi SSO untuk aplikasi Oracle EBS (appsprod.santos.co.id) menggunakan mode `REROUTE` (Server-Side Relay) bertujuan untuk mem-bypass form login Oracle. Namun, selama proses pengujian, ditemukan beberapa batasan teknis tingkat lanjut dari sisi sekuritas browser maupun sekuritas arsitektur Oracle (OAF) itu sendiri.

## Detail Temuan Investigasi

### 1. Blokir Origin pada Client-Side POST
Percobaan melakukan pengiriman kredensial secara langsung dari browser pengguna ke server Oracle selalu gagal dan ditolak (dikembalikan ke halaman form login kosong). Hal ini dikarenakan browser modern secara otomatis mengirimkan header `Origin` (192.168.2.3) pada metode POST lintas domain. Oracle EBS memvalidasi header ini sebagai proteksi *Cross-Site Request Forgery (CSRF)* dan memblokir request yang berasal dari luar domainnya.

### 2. Kewajiban Header Kustom (X-Service) & Kegagalan Trik CORS
Trik bypass menggunakan auto-submit form melalui URI `data:text/html` (untuk menghasilkan `Origin: null` yang sering diabaikan oleh WAF) terbukti **tidak bisa digunakan**. 
Alasannya: Endpoint login Oracle (`AppsLocalLogin.jsp`) mewajibkan adanya HTTP Header kustom yaitu `X-Service: AuthenticateUser`.
- Browser **tidak mengizinkan** penambahan header kustom pada tag `<form>` HTML biasa.
- Jika menggunakan AJAX (`fetch` / `XMLHttpRequest`) untuk menyisipkan header tersebut, browser akan mengirimkan *CORS Preflight (OPTIONS)*. Server Oracle tidak memiliki konfigurasi `Access-Control-Allow-Origin`, sehingga request langsung ditolak sebelum sempat dikirim.

### 3. Batasan Keamanan Cookie (Cross-Domain)
Melakukan login melalui *Backend Portal* (Server-to-Server) berhasil mendapatkan respon sukses dan cookie `JSESSIONID`. Namun, *Backend Portal* tidak bisa membagikan cookie sesi tersebut ke browser pengguna. 
Berdasarkan aturan keamanan standar (*Same-Origin Policy*), server dengan host `192.168.2.3` tidak memiliki wewenang untuk men-set cookie untuk domain `.santos.co.id`. Akibatnya, browser pengguna tetap dianggap belum login saat diarahkan ke URL asli Oracle.

### 4. Reverse Proxy Mentok pada OAF MAC (State Validation)
Sebagai solusi dari poin 3, dikembangkan mekanisme *Reverse Proxy* (`/portal/proxy/...`) agar browser berkomunikasi satu pintu melalui IP portal, dan portal meneruskannya ke Oracle.
Meskipun halaman Home Oracle berhasil dimuat, menu Navigator (dan fungsi AJAX lainnya) rusak dan memunculkan error: **"Unexpected error while processing the request."**
- **Akar Masalah:** Oracle Application Framework (OAF) menerapkan fitur keamanan *Message Authentication Code (MAC) / State Validation*. Oracle mengenkripsi dan memberi "tanda tangan" (signature) pada setiap URL di halamannya.
- Karena Proxy portal **harus** melakukan *rewrite* (mengubah URL asli Oracle menjadi URL proxy agar bisa diakses), tanda tangan digital URL tersebut menjadi **berubah dan tidak valid/rusak**.
- Saat pengguna mengklik menu, server Oracle mendeteksi adanya manipulasi (karena signature gagal diverifikasi) dan langsung menggagalkan request tersebut.
- Selain itu, penggunaan form jadul berbasis *Java Applet (Java Web Start / .jnlp)* tidak dapat berjalan stabil di balik *Reverse Proxy* karena Java memerlukan koneksi langsung (dan terkadang *socket* khusus) ke server aslinya.

## Kesimpulan Akhir
Secara arsitektur, Oracle EBS 12.2 (dengan OAF) **100% tidak kompatibel** untuk di-proxy atau di-bypass dari beda domain. Upaya manipulasi URL melalui Reverse Proxy dipastikan akan selalu merusak integritas *MAC Signature* bawaan Oracle.

## Rekomendasi Solusi Tunggal
Satu-satunya cara yang terjamin berhasil dan aman untuk merealisasikan REROUTE / SSO Oracle tanpa memicu error OAF MAC maupun error Cookie adalah dengan **menyamakan domain portal dengan domain Oracle**.

**Tindakan yang Dibutuhkan:**
Tim Jaringan/Infrastruktur perlu mendaftarkan *DNS lokal* untuk IP Server Portal (192.168.2.3) menjadi subdomain `.santos.co.id` (misalnya: **`portal.santos.co.id`**).

**Mengapa ini menyelesaikan masalah?**
1. Portal (`portal.santos.co.id`) dan Oracle (`appsprod.santos.co.id`) berada dalam satu kelompok *Top-Level Domain* yang sama.
2. Saat *Backend Portal* sukses login ke Oracle, portal **sangat diizinkan** menyuntikkan cookie sesi langsung ke browser pengguna dengan parameter `Domain=.santos.co.id`.
3. Setelah cookie tertanam, Portal cukup me-*redirect* browser pengguna langsung ke URL **asli** Oracle tanpa perlu *Reverse Proxy*.
4. Karena mengakses URL asli, OAF MAC Signature tidak rusak, fitur AJAX/Navigator berfungsi 100%, dan *Java Forms (.jnlp)* dapat ter-download serta berjalan dengan sempurna.
