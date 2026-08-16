/**
 * Kunci scroll body dengan hitungan referensi.
 *
 * Kenapa perlu hitungan: pola lama di tiap modal adalah
 *
 *     document.body.style.overflow = "hidden";   // saat buka
 *     document.body.style.overflow = "";         // saat tutup
 *
 * Begitu ada dua lapisan sekaligus — misal ConfirmDialog dibuka DI ATAS
 * MediaPickerModal, atau drawer admin masih terbuka saat modal muncul — lapisan
 * yang ditutup lebih dulu membuka kunci scroll padahal lapisan di bawahnya masih
 * aktif. Halaman jadi bisa di-scroll di belakang modal yang masih terbuka.
 *
 * Dengan hitungan referensi, scroll baru dibuka setelah pengunci terakhir lepas.
 * Nilai `overflow` semula juga disimpan dan dikembalikan apa adanya.
 */
let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): void {
    if (typeof document === "undefined") return;

    if (lockCount === 0) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    lockCount += 1;
}

export function unlockBodyScroll(): void {
    if (typeof document === "undefined") return;
    if (lockCount === 0) return;

    lockCount -= 1;
    if (lockCount === 0) {
        document.body.style.overflow = previousOverflow ?? "";
        previousOverflow = null;
    }
}
