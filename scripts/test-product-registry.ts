/**
 * Self-check registry produk + fingerprint matcher login (modul murni).
 * Run: npx tsx scripts/test-product-registry.ts
 */
import { fingerprintLoginProduct } from "../lib/portal-product-registry";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

const unifi = `<html><head><title>UniFi OS</title></head><body><div ui-view></div><script src="/angular/app.js"></script></body></html>`;
check(fingerprintLoginProduct(unifi, "https://192.168.1.1/")?.product === "unifi-os", "registry: UniFi dikenali");
const mantis = `<html><body><form action="login_password_page.php"><input name="username"></form></body></html>`;
check(fingerprintLoginProduct(mantis, "https://bugs.example.com/login_page.php")?.product === "mantisbt", "registry: MantisBT dikenali");
const hris = `<html><head><meta name="generator" content="HRIS Portal v2"></head><body><form action="/login"><input name="nik"></form></body></html>`;
check(fingerprintLoginProduct(hris, "https://nikhris.example.com/login")?.product === "hris-internal", "registry: HRIS internal dikenali");
check(fingerprintLoginProduct("<html><body><h1>halo</h1></body></html>", "https://x.example/") === null, "registry: halaman asing -> null");
console.log(failed === 0 ? "Semua lolos." : `${failed} gagal.`);
if (failed > 0) process.exit(1);
