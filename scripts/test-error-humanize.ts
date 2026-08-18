import assert from "node:assert";
import { humanizeError } from "../lib/error-humanize";

function runTests() {
    console.log("Menjalankan test humanizeError...");

    // 1. String teknis
    assert.strictEqual(
        humanizeError("Failed to fetch"),
        "Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi."
    );

    // 2. Prisma P2002 duplicate
    assert.strictEqual(
        humanizeError("Unique constraint failed on the fields: (`slug`)"),
        "Data dengan nama atau kode ini sudah terdaftar. Silakan gunakan yang lain."
    );

    // 3. HTTP status code object
    assert.strictEqual(
        humanizeError({ status: 401 }),
        "Sesi login Anda telah berakhir. Silakan masuk kembali."
    );
    assert.strictEqual(
        humanizeError({ status: 403 }),
        "Anda tidak memiliki hak akses untuk melakukan tindakan ini."
    );
    assert.strictEqual(
        humanizeError({ status: 500 }),
        "Terjadi gangguan pada server internal. Silakan coba beberapa saat lagi."
    );

    // 4. Object dengan message/error field
    assert.strictEqual(
        humanizeError({ message: "Invalid credentials" }),
        "Email atau kata sandi yang Anda masukkan tidak sesuai."
    );

    // 5. Fallback custom
    assert.strictEqual(
        humanizeError(null, "Pesan bawaan"),
        "Pesan bawaan"
    );

    // 6. Action option
    assert.strictEqual(
        humanizeError({}, { action: "menyimpan data" }),
        "Gagal saat menyimpan data. Terjadi kendala yang tidak terduga. Silakan coba lagi."
    );

    console.log("✅ Semua assertion lulus 100%!");
}

runTests();
