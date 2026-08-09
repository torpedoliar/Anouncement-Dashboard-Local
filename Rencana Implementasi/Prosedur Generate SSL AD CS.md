# Prosedur Pembuatan Sertifikat SSL Internal (AD CS) untuk Nginx Proxy Manager

## 1. Pendahuluan
Dokumen ini berisi panduan langkah-demi-langkah untuk menghasilkan sertifikat SSL (HTTPS) dari *Windows Server Active Directory Certificate Services (AD CS)* yang akan dipasang pada *Nginx Proxy Manager (NPM)*. Tujuannya agar portal (contoh: `portal.santos.co.id`) mendapatkan status "Secure / Gembok Hijau" di semua browser PC/Laptop yang tergabung dalam domain kantor tanpa bentrok dengan sertifikat Oracle.

## 2. Persiapan (Generate Private Key & CSR)
Langkah ini dilakukan di server Linux/NPM, atau PC Anda menggunakan Git Bash/OpenSSL.

1. Buka terminal (Terminal Linux, SSH, atau Git Bash di Windows).
2. Jalankan perintah pembuatan Private Key (`.key`) dan Certificate Signing Request (`.csr`):
   ```bash
   openssl req -new -newkey rsa:2048 -nodes -keyout portal_santos.key -out portal_santos.csr
   ```
3. Terminal akan meminta Anda mengisi beberapa informasi. Isi dengan profil perusahaan Anda. 
   > [!IMPORTANT]
   > Pada isian **Common Name (e.g. server FQDN or YOUR name)**, isi dengan FQDN portal Anda, contoh: `portal.santos.co.id` (atau wildcard `*.santos.co.id` jika ingin dipakai massal). Isian ini sangat krusial dan tidak boleh salah.
4. Jangan mengisi *challenge password*, biarkan kosong lalu tekan Enter.
5. Anda sekarang memiliki dua file:
   - `portal_santos.key` (Kunci rahasia, simpan baik-baik).
   - `portal_santos.csr` (File teks yang akan disetor ke AD CS).

## 3. Proses Request ke Active Directory CA

Anda dapat melakukan *submit request* menggunakan dua pilihan metode. Pilih salah satu yang paling mudah bagi Anda:

### Opsi A: Via Web Enrollment (Browser)
Gunakan opsi ini jika Anda sudah menginstall fitur *Certification Authority Web Enrollment* di Server AD Anda.
1. Buka file `portal_santos.csr` (dari Langkah 2) menggunakan *Notepad* atau editor teks sederhana.
2. *Copy* **seluruh isinya** (Wajib mencakup baris `-----BEGIN CERTIFICATE REQUEST-----` hingga `-----END CERTIFICATE REQUEST-----`).
3. Buka web browser, lalu akses halaman Web Enrollment AD CS Anda (URL standarnya adalah `http://<IP-SERVER-AD>/certsrv`).
4. Login menggunakan akun Administrator Domain.
5. Pada halaman utama Web Enrollment, klik link **Request a certificate**.
6. Kemudian klik **Advanced certificate request**.
7. Pada kotak teks berlabel **Saved Request (Base-64-encoded certificate request)**, *paste* isi file `.csr` yang sudah Anda copy.
8. Pada dropdown **Certificate Template**, pilih **Web Server**.
9. Klik tombol **Submit**.
10. Anda akan dialihkan ke halaman *Certificate Issued*. Pastikan memilih format **Base 64 encoded** (bukan DER).
11. Klik link **Download certificate**. File akan terdownload (biasanya bernama `certnew.cer`).
12. Ubah nama (rename) dan ekstensi file tersebut menjadi **`portal_santos.crt`**.

### Opsi B: Via Command Prompt (`certreq`)
Jika fitur web IIS belum aktif atau sulit diakses, gunakan metode *Command Prompt* bawaan Windows dari PC mana saja yang sudah *Join Domain*.
1. Buka aplikasi **Command Prompt** (Wajib *Run as Administrator*).
2. Jalankan perintah berikut (sesuaikan lokasi path ke tempat Anda menaruh file `.csr`):
   ```cmd
   certreq -submit -attrib "CertificateTemplate:WebServer" C:\path\to\portal_santos.csr
   ```
3. Sebuah jendela *popup* (CA List) akan muncul. Pilih nama server CA internal kantor Anda, lalu klik **OK**.
4. Command Prompt akan memunculkan jendela *Save As*.
5. Pilih lokasi penyimpanan, lalu beri nama filenya **`portal_santos.crt`** (atau simpan sebagai `.cer` lalu rename manual).

## 4. Instalasi di Nginx Proxy Manager (NPM)
1. Buka dashboard web Nginx Proxy Manager Anda.
2. Pindah ke tab **SSL Certificates** di menu atas.
3. Klik tombol **Add SSL Certificate**, lalu pilih **Custom**.
4. Isi kelengkapan kolom sebagai berikut:
   - **Name:** Sertifikat AD Portal Santos (bebas).
   - **Certificate Key:** Upload file `portal_santos.key` (dari Langkah 2).
   - **Certificate:** Upload file `portal_santos.crt` (dari Langkah 4).
   - **Intermediate Certificate:** Biarkan kosong (kecuali infrastruktur AD CS Anda mewajibkan sertifikat rantai Sub-CA).
5. Klik **Save**.

## 6. Penerapan ke Proxy Host
1. Saat Anda menambahkan atau mengedit *Proxy Host* untuk domain `portal.santos.co.id` di NPM, buka tab **SSL**.
2. Pada dropdown SSL Certificate, pilih sertifikat custom yang baru saja Anda buat.
3. Centang opsi **Force SSL** agar *traffic* selalu dialihkan ke HTTPS yang aman.
4. Simpan perubahan.

> [!TIP]
> Dengan selesainya tahap ini, URL `https://portal.santos.co.id` akan dikenali berstatus "Aman" oleh seluruh PC di kantor. Fitur **SSO Oracle REROUTE** kini bisa menempelkan cookie sesi secara mulus lintas domain!
