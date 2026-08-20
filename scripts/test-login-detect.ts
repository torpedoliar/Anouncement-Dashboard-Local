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
const r10a = detectLoginFields(`<form><input name="login" value=""><input name="passwd" type="password"></form>`);
assertEq(r10a.usernameField, "login", "10 no-type input as username");

// 11. DevExpress WebForms (TR APPS): tombol submit bernama wajib ikut di extraFields,
//     kalau tidak handler klik server-side tidak pernah jalan.
const r10 = detectLoginFields(`<form method="post" action="#" id="Form1">
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="O6pKzp+liCG" />
<input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="B281DCD2" />
<input class="dxeEditArea_Moderno" id="ASPxTextBox1_I" name="ASPxTextBox1" type="text" />
<input class="dxeEditArea_Moderno" id="ASPxTextBox2_I" name="ASPxTextBox2" type="password" />
<input id="ASPxButton1_I" class="dxb-hb" value="LOGIN" type="submit" name="ASPxButton1" />
</form>`);
assertEq(r10.usernameField, "ASPxTextBox1", "10a DevExpress username");
assertEq(r10.passwordField, "ASPxTextBox2", "10b DevExpress password");
assertEq(r10.extraFields.ASPxButton1, "LOGIN", "10c submit button included");
assertEq((r10.warnings ?? []).length > 0, true, "10d volatile __VIEWSTATE warned");

// 11. ASP.NET MVC (K2): antiforgery token + submit <button>
const r11 = detectLoginFields(`<form method=post action="/Account/Login">
<input name="__RequestVerificationToken" type="hidden" value="jixmTfaCnkh" />
<input type="text" class="form-control" placeholder="Username" id="UserName" name="UserName">
<input type="password" class="form-control" placeholder="Password" id="Password" name="Password">
<button type="submit" name="submitBtn" class="btn">Submit</button>
</form>`);
assertEq(r11.usernameField, "UserName", "11a MVC username");
assertEq(r11.passwordField, "Password", "11b MVC password");
assertEq(r11.extraFields.submitBtn, "Submit", "11c <button> submit captured");
assertEq((r11.warnings ?? []).length > 0, true, "11d antiforgery token warned");

// 12. Tombol submit tanpa name TIDAK ditambahkan (tidak ada yang bisa di-POST)
const r12 = detectLoginFields(`<form><input name="username" type="text"><input name="password" type="password"><button type="submit">Go</button></form>`);
assertEq(r12.extraFields, {}, "12 unnamed submit not added");
assertEq((r12.warnings ?? []).length, 0, "12b no volatile token → no warning");

// 13. Tombol "Batal" TIDAK boleh dipilih — mengirim namanya = server menjalankan batal, bukan login
const r13 = detectLoginFields(`<form><input name="username" type="text"><input name="password" type="password">
<input type="submit" name="btnCancel" value="Batal"><input type="submit" name="btnLogin" value="Login"></form>`);
assertEq(r13.extraFields, { btnLogin: "Login" }, "13 cancel button rejected, login chosen");

// 13b. Tombol login muncul SETELAH tombol netral → tetap menang
const r13b = detectLoginFields(`<form><input name="u" type="text"><input name="p" type="password">
<input type="submit" name="btnHelp" value="Bantuan"><input type="submit" name="btnMasuk" value="Masuk"></form>`);
assertEq(r13b.extraFields.btnMasuk, "Masuk", "13b positive button wins over neutral");

// 14. user_id tidak boleh menyusut jadi "id" (underscore dipertahankan)
const r14 = detectLoginFields(`<form><input name="first_name" type="text"><input name="user_id" type="text"><input name="kata_sandi" type="password"></form>`);
assertEq(r14.usernameField, "user_id", "14 user_id beats first_name");
assertEq(r14.passwordField, "kata_sandi", "14b kata_sandi as password");

// 15. Label membungkus input tanpa atribut for=
const r15 = detectLoginFields(`<form><label>NIK Karyawan <input name="f1" type="text"></label><label>Kata Sandi <input name="f2" type="password"></label></form>`);
assertEq(r15.usernameField, "f1", "15 wrapping label gives username clue");

// 16. aria-labelledby menunjuk elemen lain
const r16 = detectLoginFields(`<form><span id="l1">Nomor Induk</span><span id="l2">Kata Sandi</span>
<input name="a1" type="text" aria-labelledby="l1"><input name="a2" type="password" aria-labelledby="l2"></form>`);
assertEq(r16.usernameField, "a1", "16 aria-labelledby resolved");

// 17. formaction pada tombol menimpa action <form>
const r17 = detectLoginFields(`<form action="/x"><input name="username" type="text"><input name="password" type="password">
<input type="submit" name="go" formaction="/real/login" value="Login"></form>`);
assertEq(r17.formAction, "/real/login", "17 formaction overrides form action");

console.log("=== ALL PASS ===");
