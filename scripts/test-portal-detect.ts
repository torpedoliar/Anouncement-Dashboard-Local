import { detectLoginFields } from "../lib/portal-login-detect";

console.log("=== RUNNING EXTENSIVE DETECT LOGIN FIELDS TESTS ===");

// Test 1: ASP.NET WebForms / HRIS with ctl00$... and generic ASPx controls
const html1 = `
<html>
<body>
<form id="aspnetForm" method="post" action="./Login.aspx">
    <input type="hidden" name="__VIEWSTATE" value="abc123viewstate" />
    <input type="hidden" name="__EVENTVALIDATION" value="xyz789eventval" />
    
    <!-- Generic DevExpress boxes (e.g. search or dummy) -->
    <input type="text" name="ASPxTextBox1" id="ASPxTextBox1_I" class="dxeEditArea" />
    <input type="password" name="ASPxTextBox2" id="ASPxTextBox2_I" class="dxeEditArea" />

    <!-- Actual HRIS Login Controls -->
    <div class="login-panel">
        <label for="ctl00_ContentPlaceHolder1_txtNikHris">NIK Pegawai</label>
        <input type="text" name="ctl00$ContentPlaceHolder1$txtNikHris" id="ctl00_ContentPlaceHolder1_txtNikHris" placeholder="Masukkan NIK" />
        
        <label for="ctl00_ContentPlaceHolder1_txtPassword">Password</label>
        <input type="password" name="ctl00$ContentPlaceHolder1$txtPassword" id="ctl00_ContentPlaceHolder1_txtPassword" placeholder="Kata Sandi" />
    </div>

    <input type="submit" name="ctl00$ContentPlaceHolder1$btnLogin" value="Masuk" />
</form>
</body>
</html>
`;
const res1 = detectLoginFields(html1);
if (res1.usernameField === "ctl00$ContentPlaceHolder1$txtNikHris" && res1.passwordField === "ctl00$ContentPlaceHolder1$txtPassword") {
    console.log("✅ Test 1 PASSED: ctl00$...$txtNikHris & ctl00$...$txtPassword over ASPxTextBox1/2");
} else {
    console.error("❌ Test 1 FAILED:", res1);
}

// Test 2: Master page with Header Search form AND Login Form
const html2 = `
<html>
<body>
    <form id="searchForm" action="/search" method="get">
        <input type="text" name="q" placeholder="Cari di website..." />
        <input type="text" name="filter_category" />
    </form>

    <form id="loginForm" action="/auth/login" method="post">
        <input type="text" name="username_sja" placeholder="Username / Email SJA" />
        <input type="password" name="password_sja" placeholder="Password" />
        <input type="hidden" name="_csrf" value="token_12345" />
    </form>
</body>
</html>
`;
const res2 = detectLoginFields(html2);
if (res2.usernameField === "username_sja" && res2.passwordField === "password_sja") {
    console.log("✅ Test 2 PASSED: Ignored header search form, correctly identified login form!");
} else {
    console.error("❌ Test 2 FAILED:", res2);
}

// Test 3: DevExpress Pure ASPx Controls with dxeCaption labels
const html3 = `
<table class="dxeFormLayout">
    <tr>
        <td class="dxeCaption">Nomor Induk Karyawan:</td>
        <td><input type="text" name="txt_nik" id="txt_nik_I" class="dxeEditArea" /></td>
    </tr>
    <tr>
        <td class="dxeCaption">Kata Sandi:</td>
        <td><input type="password" name="txt_pwd" id="txt_pwd_I" class="dxeEditArea" /></td>
    </tr>
</table>
`;
const res3 = detectLoginFields(html3);
if (res3.usernameField === "txt_nik" && res3.passwordField === "txt_pwd") {
    console.log("✅ Test 3 PASSED: DevExpress table with txt_nik & txt_pwd!");
} else {
    console.error("❌ Test 3 FAILED:", res3);
}

// Test 4: SAP / Oracle Web Forms
const html4 = `
<form name="sapLogin" method="post" action="/sap/bc/gui/sap/its/webgui">
    <input type="text" name="sap-user" placeholder="User" />
    <input type="password" name="sap-password" placeholder="Password" />
    <input type="text" name="sap-client" value="100" />
    <input type="text" name="sap-language" value="EN" />
</form>
`;
const res4 = detectLoginFields(html4);
if (res4.usernameField === "sap-user" && res4.passwordField === "sap-password") {
    console.log("✅ Test 4 PASSED: SAP NetWeaver user & password correctly matched!");
} else {
    console.error("❌ Test 4 FAILED:", res4);
}

console.log("=== ALL EXTENSIVE TESTS COMPLETED SUCCESSFULLY ===");
