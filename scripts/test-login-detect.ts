/**
 * Self-check untuk lib/portal-login-detect.ts (tanpa DB).
 * Run: npx tsx scripts/test-login-detect.ts
 */
import { detectLoginFields } from "../lib/portal-login-detect";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// 1. Form klasik: username + password
const r1 = detectLoginFields(`<form><input name="username" type="text"><input name="password" type="password"><button>Login</button></form>`);
assertEq(r1.usernameField, "username", "1a username name detected");
assertEq(r1.passwordField, "password", "1b password detected");
assertEq(r1.extraFields, {}, "1c no extra fields");

// 2. autocomplete="username" menang atas urutan DOM
const r2 = detectLoginFields(`<form><input name="email" type="email"><input name="username" autocomplete="username" type="text"><input name="pass" type="password"></form>`);
assertEq(r2.usernameField, "username", "2 autocomplete username wins");

// 3. Tanpa autocomplete → nama mengandung 'user'/'email' menang
const r3 = detectLoginFields(`<form><input name="first_name" type="text"><input name="user_id" type="text"><input name="pw" type="password"></form>`);
assertEq(r3.usernameField, "user_id", "3 keyword user wins");

// 4. Email field sebagai username
const r4 = detectLoginFields(`<form><input name="email" type="email"><input name="password" type="password"></form>`);
assertEq(r4.usernameField, "email", "4 email as username");

// 5. Hidden CSRF terdeteksi sebagai extraFields
const r5 = detectLoginFields(`<form><input type="hidden" name="_token" value="abc123"><input name="username" type="text"><input name="password" type="password"></form>`);
assertEq(r5.extraFields, { _token: "abc123" }, "5 hidden csrf captured");

// 6. Tanpa password → usernameField null
const r6 = detectLoginFields(`<form><input name="username" type="text"></form>`);
assertEq(r6.usernameField, null, "6 no password → null username");
assertEq(r6.passwordField, null, "6b no password → null password");

// 7. Tanpa form sama sekali
const r7 = detectLoginFields(`<html><body><p>Hello</p></body></html>`);
assertEq(r7.usernameField, null, "7 no form → null");
assertEq(r7.extraFields, {}, "7b no form → empty extra");

// 8. Multipel form — hanya form berisi password yang dipertimbangkan
const r8 = detectLoginFields(`<form><input name="search" type="search"></form><form><input name="username" type="text"><input type="password" name="pass"></form>`);
assertEq(r8.usernameField, "username", "8 picks login form not search");
assertEq(r8.passwordField, "pass", "8b password from login form");

// 9. Fallback: tanpa keyword → input non-password pertama
const r9 = detectLoginFields(`<form><input name="a" type="text"><input name="b" type="text"><input name="pw" type="password"></form>`);
assertEq(r9.usernameField, "a", "9 first text input fallback");

// 10. Input tanpa type (default text) bisa jadi username
const r10 = detectLoginFields(`<form><input name="login" value=""><input name="passwd" type="password"></form>`);
assertEq(r10.usernameField, "login", "10 no-type input as username");

console.log("\n=== ALL PASS ===");
